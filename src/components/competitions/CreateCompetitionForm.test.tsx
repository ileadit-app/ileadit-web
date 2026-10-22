import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateCompetitionForm } from "./CreateCompetitionForm";
import {
  DURATION_OUT_OF_RANGE_MESSAGE,
  ENGINE_INVALID_ARGUMENT_FALLBACK_MESSAGE,
  START_TIME_IN_PAST_MESSAGE,
  VISIBILITY_CONFIRM_LABEL,
  VISIBILITY_NOTICE,
} from "@/lib/createCompetitionGuard";

/**
 * Pins the THREE `createCompetition` wrapper outcomes named in ticket
 * W1-TESTS — success, permission-denied ("not authorised to create
 * competitions"), and a generic/unrecognised failure — by asserting what
 * `CreateCompetitionForm` actually puts on screen, never by asserting on
 * the resolved `CreateCompetitionOutcome` value directly. Per the ticket:
 * "a wrapper that resolves correctly while the UI shows nothing is the bug
 * worth catching" — so every mock below is at the same boundary a real
 * deploy would cross (the Cloud Functions callable itself), and
 * `src/lib/createCompetition.ts` + `src/lib/createCompetitionErrors.ts` run
 * for REAL, unmocked, in every test here.
 *
 * Two mocks, deliberately drawn at different boundaries for different
 * reasons:
 *
 * 1. `firebase/functions`'s `httpsCallable` — THE callable boundary itself
 *    (fact #6 in the ticket: nothing is deployed, so a test that needs a
 *    network can't run today). Configured per-test via
 *    `mockCallable.mockResolvedValueOnce` / `mockRejectedValueOnce` to drive
 *    each of the three outcomes through the real wrapper code.
 * 2. `@/lib/functions`'s `getFunctionsClient` — stubbed to a dummy object
 *    ONLY to avoid the real `getFirebaseApp()`/`getAppCheckClient()`
 *    initialisation path (which would need real `.env.local` values and can
 *    touch `window`-dependent App Check/reCAPTCHA setup). `httpsCallable` in
 *    this test never looks at its first argument beyond identity, so
 *    swapping it for `{}` does not change what's being pinned.
 *
 * WEB-CREATE-GUARD (ticket, 22 Oct 2026) adds a second describe block below
 * pinning the interim public-competition guard: the visibility notice, the
 * required confirmation checkbox, the zone-aware past-start-time check, the
 * duration range (1 to `MAX_COMPETITION_DAYS`), submit-time re-validation,
 * the engine `invalid-argument` → friendly-text mapping, and that none of
 * this adds a new field to the callable's payload.
 */

const mockCallable = vi.fn();

vi.mock("firebase/functions", () => ({
  httpsCallable: () => mockCallable,
}));

vi.mock("@/lib/functions", () => ({
  getFunctionsClient: () => ({}),
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function getConfirmCheckbox() {
  return screen.getByRole("checkbox", {
    name: VISIBILITY_CONFIRM_LABEL,
  });
}

function tickConfirmCheckbox() {
  fireEvent.click(getConfirmCheckbox());
}

function setTimeZone(zone: string) {
  fireEvent.change(screen.getByLabelText(/time zone/i), { target: { value: zone } });
}

function setStart(value: string) {
  fireEvent.change(screen.getByLabelText(/^starts/i), { target: { value } });
}

function setDuration(value: string) {
  fireEvent.change(screen.getByLabelText(/duration \(days\)/i), { target: { value } });
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/competition name/i), {
    target: { value: "Marketing team step-off" },
  });
  setStart("2027-06-01T09:00");
  // Duration (7) and time zone (browser default) already have valid values.
  tickConfirmCheckbox();
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /create competition/i }));
}

beforeEach(() => {
  mockCallable.mockReset();
  pushMock.mockReset();
});

describe("CreateCompetitionForm — createCompetition wrapper outcomes shown to the user", () => {
  it("success: navigates to /dashboard and shows no error banner", async () => {
    mockCallable.mockResolvedValueOnce({ data: { competitionId: "comp_123" } });
    render(<CreateCompetitionForm />);

    fillRequiredFields();
    submit();

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("permission-denied (not-authorized-to-create-competitions): shows the permission refusal copy, not a generic error", async () => {
    mockCallable.mockRejectedValueOnce({
      code: "functions/permission-denied",
      message: "not authorized",
      details: { reason: "not-authorized-to-create-competitions" },
    });
    render(<CreateCompetitionForm />);

    fillRequiredFields();
    submit();

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent(
      "You don't have permission to create competitions. If you think this is wrong, email hello@ileadit.co.uk.",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("generic failure (not a FunctionsError at all): shows the generic fallback copy, distinct from the permission message", async () => {
    mockCallable.mockRejectedValueOnce(new Error("network exploded"));
    render(<CreateCompetitionForm />);

    fillRequiredFields();
    submit();

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent(
      "We couldn't create that competition. Please try again, or email hello@ileadit.co.uk if it keeps happening.",
    );
    expect(banner).not.toHaveTextContent("You don't have permission");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("WEB-4 item 1: the disabled 'Creating…' submit button uses the named cta-disabled tokens, not opacity", async () => {
    let resolveSubmit: (v: { data: { competitionId: string } }) => void = () => {};
    mockCallable.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }),
    );
    render(<CreateCompetitionForm />);

    fillRequiredFields();
    submit();

    const submittingButton = await screen.findByRole("button", { name: /creating/i });
    expect(submittingButton).toBeDisabled();
    expect(submittingButton.className).toContain("disabled:bg-cta-disabled");
    expect(submittingButton.className).toContain("disabled:text-cta-disabled-foreground");
    expect(submittingButton.className).not.toContain("opacity-60");

    resolveSubmit({ data: { competitionId: "comp_123" } });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });
});

describe("CreateCompetitionForm — WEB-CREATE-GUARD (public-competition interim guard, WEB-H5/WEB-M6)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the visibility notice as plain visible text (not a tooltip), somewhere above the submit button", () => {
    render(<CreateCompetitionForm />);

    const notice = screen.getByText(VISIBILITY_NOTICE);
    // Plain text node, not an attribute a sighted user wouldn't otherwise
    // see without hovering (a tooltip would typically live in a `title`
    // attribute or be visually hidden until hover/focus).
    expect(notice.tagName).toBe("P");
    expect(notice).not.toHaveAttribute("title");

    const submitButton = screen.getByRole("button", { name: /create competition/i });
    // DOCUMENT_POSITION_PRECEDING (2) — the notice comes before the button.
    expect(notice.compareDocumentPosition(submitButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("never uses window.confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    mockCallable.mockResolvedValueOnce({ data: { competitionId: "comp_123" } });
    render(<CreateCompetitionForm />);

    fillRequiredFields();
    submit();

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("submit button is disabled until the confirmation checkbox is ticked", () => {
    render(<CreateCompetitionForm />);

    fireEvent.change(screen.getByLabelText(/competition name/i), {
      target: { value: "Marketing team step-off" },
    });
    setStart("2027-06-01T09:00");

    const submitButton = screen.getByRole("button", { name: /create competition/i });
    expect(submitButton).toBeDisabled();

    tickConfirmCheckbox();
    expect(submitButton).toBeEnabled();

    // Unticking re-disables it — this isn't a one-shot unlock.
    fireEvent.click(getConfirmCheckbox());
    expect(submitButton).toBeDisabled();
  });

  it("a raw form submit (bypassing the disabled button) with the checkbox unticked still refuses, with an announced error, and never calls the callable", () => {
    render(<CreateCompetitionForm />);

    fireEvent.change(screen.getByLabelText(/competition name/i), {
      target: { value: "Marketing team step-off" },
    });
    setStart("2027-06-01T09:00");
    // Deliberately never ticking the checkbox.

    const form = document.querySelector("form");
    if (!form) throw new Error("form not found");
    fireEvent.submit(form);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Confirm you understand before creating this competition.");
    expect(mockCallable).not.toHaveBeenCalled();
  });

  describe("start date must not be in the past, evaluated in the competition's own time zone", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2027-01-01T00:00:00.000Z"));
    });

    it("a time zone EAST of UTC: a wall-clock value that reads as 'future' if treated naively as UTC, but is actually already past once converted in Pacific/Auckland (+13), is rejected", () => {
      render(<CreateCompetitionForm />);
      fireEvent.change(screen.getByLabelText(/competition name/i), {
        target: { value: "Marketing team step-off" },
      });
      setTimeZone("Pacific/Auckland");
      // Naively-as-UTC this is 2027-01-01T10:00Z — AFTER "now". Converted
      // properly in Pacific/Auckland (UTC+13), the real instant is
      // 2026-12-31T21:00Z — BEFORE "now". Only a genuinely zone-aware check
      // rejects this; a naive one would wrongly accept it. This assertion
      // is synchronous — validation runs and `setFieldErrors` fires inside
      // the same click, before `handleSubmit` ever reaches an `await`.
      setStart("2027-01-01T10:00");
      tickConfirmCheckbox();
      submit();

      expect(screen.getByText(START_TIME_IN_PAST_MESSAGE)).toBeInTheDocument();
      expect(mockCallable).not.toHaveBeenCalled();
    });

    it("a time zone WEST of UTC: a wall-clock value that reads as 'past' if treated naively as UTC, but is actually still in the future once converted in America/Los_Angeles (-8), is accepted", async () => {
      mockCallable.mockResolvedValueOnce({ data: { competitionId: "comp_123" } });
      render(<CreateCompetitionForm />);
      fireEvent.change(screen.getByLabelText(/competition name/i), {
        target: { value: "Marketing team step-off" },
      });
      setTimeZone("America/Los_Angeles");
      // Naively-as-UTC this is 2026-12-31T20:00Z — BEFORE "now". Converted
      // properly in America/Los_Angeles (UTC-8), the real instant is
      // 2027-01-01T04:00Z — AFTER "now". A naive check would wrongly reject
      // this legitimate future start time.
      setStart("2026-12-31T20:00");
      tickConfirmCheckbox();
      submit();

      // `waitFor`'s own retry timer would be a FAKE timer here and never
      // fire on its own — flush pending microtasks/zero-delay timers
      // explicitly instead of polling for them.
      await vi.advanceTimersByTimeAsync(0);

      expect(pushMock).toHaveBeenCalledWith("/dashboard");
      expect(screen.queryByText(START_TIME_IN_PAST_MESSAGE)).not.toBeInTheDocument();
    });

    it("re-checks the start date freshly at submit time, not only on change: a value that was valid when typed is refused if 'now' has moved past it by the time submit is actually clicked", () => {
      render(<CreateCompetitionForm />);
      fireEvent.change(screen.getByLabelText(/competition name/i), {
        target: { value: "Marketing team step-off" },
      });
      // Europe/London is on GMT (UTC+0) in January — no DST offset to
      // account for, so the wall-clock value below is exactly the UTC
      // instant.
      setTimeZone("Europe/London");
      // Valid (future) at the moment it's typed: "now" is 2027-01-01T00:00Z.
      setStart("2027-01-01T01:00");
      tickConfirmCheckbox();

      // Time passes while the page sits open — "now" moves past the chosen
      // start time, with no further edits to the field itself.
      vi.setSystemTime(new Date("2027-01-01T02:00:00.000Z"));

      submit();

      expect(screen.getByText(START_TIME_IN_PAST_MESSAGE)).toBeInTheDocument();
      expect(mockCallable).not.toHaveBeenCalled();
    });
  });

  describe("duration must be a whole number from 1 to 90 (MAX_COMPETITION_DAYS)", () => {
    it.each([["0"], ["91"], ["1.5"]])("rejects %s days", async (value) => {
      render(<CreateCompetitionForm />);
      fillRequiredFields();
      setDuration(value);
      submit();

      expect(await screen.findByText(DURATION_OUT_OF_RANGE_MESSAGE)).toBeInTheDocument();
      expect(mockCallable).not.toHaveBeenCalled();
    });

    it.each([["1"], ["90"]])("accepts %s days", async (value) => {
      mockCallable.mockResolvedValueOnce({ data: { competitionId: "comp_123" } });
      render(<CreateCompetitionForm />);
      fillRequiredFields();
      setDuration(value);
      submit();

      await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
      expect(screen.queryByText(DURATION_OUT_OF_RANGE_MESSAGE)).not.toBeInTheDocument();
      expect(mockCallable).toHaveBeenCalledWith(
        expect.objectContaining({ durationDays: Number(value) }),
      );
    });
  });

  describe("engine invalid-argument rejections never show raw Firebase text", () => {
    it("a bare invalid-argument with no identifiable reason falls back to the neutral message, not the raw code/reason", async () => {
      mockCallable.mockRejectedValueOnce({
        code: "functions/invalid-argument",
        message: "Invalid request.",
      });
      render(<CreateCompetitionForm />);

      fillRequiredFields();
      submit();

      const banner = await screen.findByRole("alert");
      expect(banner).toHaveTextContent(ENGINE_INVALID_ARGUMENT_FALLBACK_MESSAGE);
      expect(banner).not.toHaveTextContent("functions/invalid-argument");
      expect(pushMock).not.toHaveBeenCalled();
    });

    it("an invalid-argument whose reason names the start time maps to the SAME friendly copy the client-side guard shows", async () => {
      mockCallable.mockRejectedValueOnce({
        code: "functions/invalid-argument",
        message: "startTime must not be in the past",
        details: { reason: "start-time-in-past" },
      });
      render(<CreateCompetitionForm />);

      fillRequiredFields();
      submit();

      const banner = await screen.findByRole("alert");
      expect(banner).toHaveTextContent(START_TIME_IN_PAST_MESSAGE);
      expect(banner).not.toHaveTextContent("functions/invalid-argument");
    });

    it("an invalid-argument whose reason names the duration maps to the SAME friendly copy the client-side guard shows", async () => {
      mockCallable.mockRejectedValueOnce({
        code: "functions/invalid-argument",
        message: "durationDays out of range",
        details: { reason: "duration-out-of-range" },
      });
      render(<CreateCompetitionForm />);

      fillRequiredFields();
      submit();

      const banner = await screen.findByRole("alert");
      expect(banner).toHaveTextContent(DURATION_OUT_OF_RANGE_MESSAGE);
      expect(banner).not.toHaveTextContent("functions/invalid-argument");
    });
  });

  it("the payload sent to the callable is unchanged by this guard — exactly name/startTime/durationDays/timeZone/description?/imageUrl?/backgroundImageUrl?, never a visibility/confirmation field", async () => {
    mockCallable.mockResolvedValueOnce({ data: { competitionId: "comp_123" } });
    render(<CreateCompetitionForm />);

    fillRequiredFields();
    submit();

    await waitFor(() => expect(mockCallable).toHaveBeenCalledTimes(1));
    const sentBody = mockCallable.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(sentBody).sort()).toEqual(
      ["durationDays", "name", "startTime", "timeZone"].sort(),
    );
    expect(sentBody).not.toHaveProperty("confirmed");
    expect(sentBody).not.toHaveProperty("confirm");
    expect(sentBody).not.toHaveProperty("visibilityConfirmed");
    expect(sentBody).not.toHaveProperty("visibility");
  });
});
