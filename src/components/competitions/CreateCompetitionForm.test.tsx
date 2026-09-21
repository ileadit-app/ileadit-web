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
      "You don't have permission to create competitions. If you think this is wrong, email hello@ileadit.app.",
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
      "We couldn't create that competition. Please try again, or email hello@ileadit.app if it keeps happening.",
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
