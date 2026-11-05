import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateCompetitionForm } from "./CreateCompetitionForm";

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

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/competition name/i), {
    target: { value: "Marketing team step-off" },
  });
  fireEvent.change(screen.getByLabelText(/^starts/i), {
    target: { value: "2027-06-01T09:00" },
  });
  // Duration (7) and time zone (browser default) already have valid values.
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
    fireEvent.click(screen.getByRole("button", { name: /create competition/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /create competition/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /create competition/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /create competition/i }));

    const submittingButton = await screen.findByRole("button", { name: /creating/i });
    expect(submittingButton).toBeDisabled();
    expect(submittingButton.className).toContain("disabled:bg-cta-disabled");
    expect(submittingButton.className).toContain("disabled:text-cta-disabled-foreground");
    expect(submittingButton.className).not.toContain("opacity-60");

    resolveSubmit({ data: { competitionId: "comp_123" } });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });
});

describe("CreateCompetitionForm — sponsor name (WEB-SPONSOR-NAME)", () => {
  function setSponsor(value: string) {
    fireEvent.change(screen.getByLabelText(/sponsor name/i), { target: { value } });
  }
  function submit() {
    fireEvent.click(screen.getByRole("button", { name: /create competition/i }));
  }

  it("sends sponsorName trimmed", async () => {
    mockCallable.mockResolvedValueOnce({ data: { competitionId: "comp_123" } });
    render(<CreateCompetitionForm />);

    fillRequiredFields();
    setSponsor("   Acme Ltd  ");
    submit();

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(mockCallable).toHaveBeenCalledTimes(1);
    expect(mockCallable.mock.calls[0][0]).toMatchObject({ sponsorName: "Acme Ltd" });
  });

  it("omits sponsorName entirely when the field is empty", async () => {
    mockCallable.mockResolvedValueOnce({ data: { competitionId: "comp_123" } });
    render(<CreateCompetitionForm />);

    fillRequiredFields();
    submit();

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(mockCallable.mock.calls[0][0]).not.toHaveProperty("sponsorName");
  });

  it("omits sponsorName entirely when the field is only whitespace", async () => {
    mockCallable.mockResolvedValueOnce({ data: { competitionId: "comp_123" } });
    render(<CreateCompetitionForm />);

    fillRequiredFields();
    setSponsor("    ");
    submit();

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(mockCallable.mock.calls[0][0]).not.toHaveProperty("sponsorName");
  });

  it("rejects 41 characters: shows an error and never calls the callable", async () => {
    render(<CreateCompetitionForm />);

    fillRequiredFields();
    setSponsor("x".repeat(41));
    expect(screen.getByText("41/40")).toBeInTheDocument();
    submit();

    expect(await screen.findByText(/40 characters or fewer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sponsor name/i)).toHaveAttribute("aria-invalid", "true");
    expect(mockCallable).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("accepts exactly 40 characters (boundary)", async () => {
    mockCallable.mockResolvedValueOnce({ data: { competitionId: "comp_123" } });
    render(<CreateCompetitionForm />);

    fillRequiredFields();
    setSponsor("x".repeat(40));
    submit();

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(mockCallable.mock.calls[0][0]).toMatchObject({ sponsorName: "x".repeat(40) });
  });

  it("counts the trimmed length, so padding does not push a 40-char name over", async () => {
    mockCallable.mockResolvedValueOnce({ data: { competitionId: "comp_123" } });
    render(<CreateCompetitionForm />);

    fillRequiredFields();
    setSponsor(`  ${"x".repeat(40)}  `);
    expect(screen.getByText("40/40")).toBeInTheDocument();
    submit();

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("rejects control characters", async () => {
    render(<CreateCompetitionForm />);

    fillRequiredFields();
    setSponsor("AcmeLtd");
    submit();

    expect(await screen.findByText(/plain text only/i)).toBeInTheDocument();
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it("renders the sponsor help text", () => {
    render(<CreateCompetitionForm />);
    expect(
      screen.getByText("Shown in the app as 'Sponsored by …'. Leave blank if there's no sponsor."),
    ).toBeInTheDocument();
  });
});

describe("CreateCompetitionForm — image upload guidance (WEB-SPONSOR-NAME)", () => {
  it("renders the banner guidance verbatim", () => {
    render(<CreateCompetitionForm />);
    expect(
      screen.getByText(
        "Banner: 2400 × 800 px (3:1). Keep logos and text inside the centre area, away from the bottom-left corner, where the round logo sits. Don't put text in the image; the app shows the name and prize.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the logo guidance verbatim", () => {
    render(<CreateCompetitionForm />);
    expect(
      screen.getByText(
        "Logo: square, 512 × 512 px, ideally a transparent PNG. It's shown in full inside a circle.",
      ),
    ).toBeInTheDocument();
  });
});
