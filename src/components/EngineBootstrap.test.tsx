import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { EnsureAccountOutcome } from "@/lib/ensureAccount";
import EngineBootstrap from "./EngineBootstrap";

/**
 * Pins W2-SURFACE: given an `ensureAccount` outcome, what does the person
 * actually see. `src/lib/ensureAccount.test.ts` separately pins that a real
 * failure actually reaches this component's `onOutcome` callback at all —
 * this file assumes that wiring works and mocks `wireEnsureAccountOnSignIn`
 * directly so it can drive every outcome shape without a fake Firebase Auth
 * session (same two-file split as this repo's existing
 * `CreateCompetitionGate.test.tsx` / `CreateCompetitionForm.test.tsx`).
 *
 * `vi.hoisted` is used (a first in this repo's test suite as of this
 * ticket) because the mock factory below needs to CAPTURE the `onOutcome`
 * callback `EngineBootstrap` passes in, not just stub a return value — a
 * plain `vi.fn()` declared above `vi.mock()` doesn't survive Vitest's mock
 * hoisting unless wrapped this way.
 */

const { mockWire, mockEnsureAccount } = vi.hoisted(() => ({
  mockWire: vi.fn(),
  mockEnsureAccount: vi.fn(),
}));

vi.mock("@/lib/ensureAccount", () => ({
  wireEnsureAccountOnSignIn: (onOutcome: (outcome: EnsureAccountOutcome) => void) => {
    mockWire(onOutcome);
    return () => {};
  },
  ensureAccount: (timeZone: string) => mockEnsureAccount(timeZone),
}));

vi.mock("@/lib/firebase", () => ({
  missingFirebaseConfigKeys: () => [],
}));

function latestOnOutcome(): (outcome: EnsureAccountOutcome) => void {
  const call = mockWire.mock.calls.at(-1);
  if (!call) throw new Error("wireEnsureAccountOnSignIn was never called — EngineBootstrap didn't wire up");
  return call[0] as (outcome: EnsureAccountOutcome) => void;
}

beforeEach(() => {
  mockWire.mockClear();
  mockEnsureAccount.mockReset();
});

describe("EngineBootstrap — ensureAccount outcomes surfaced to the user", () => {
  it("MUT-BOOT-1: renders nothing before any outcome lands, and nothing on a success outcome", () => {
    render(<EngineBootstrap />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    act(() => {
      latestOnOutcome()({ status: "success", result: { created: false, granted: false, coins: 0 } });
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("MUT-BOOT-2: a failure outcome with a mapped reason shows a visible banner naming that reason", () => {
    render(<EngineBootstrap />);

    act(() => {
      latestOnOutcome()({
        status: "failure",
        failure: { reason: "missing-game-state", message: "account not created yet", cause: {} as never },
      });
    });

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent(/couldn't finish setting up your account/i);
    expect(banner).toHaveTextContent("missing-game-state");
  });

  it("MUT-BOOT-3: a failure outcome with no mapped reason (failure: null) still shows the banner, with generic copy", () => {
    render(<EngineBootstrap />);

    act(() => {
      latestOnOutcome()({ status: "failure", failure: null });
    });

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent(/couldn't finish setting up your account/i);
    expect(banner).not.toHaveTextContent("(");
  });

  it("MUT-BOOT-4: clicking \"Try again\" calls ensureAccount again and clears the banner on success", async () => {
    mockEnsureAccount.mockResolvedValueOnce({ created: false, granted: false, coins: 0 });
    render(<EngineBootstrap />);
    act(() => {
      latestOnOutcome()({ status: "failure", failure: null });
    });

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(mockEnsureAccount).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("MUT-BOOT-5: a failed retry keeps the banner visible — it never disappears on a failed retry", async () => {
    mockEnsureAccount.mockRejectedValueOnce(new Error("still broken"));
    render(<EngineBootstrap />);
    act(() => {
      latestOnOutcome()({ status: "failure", failure: null });
    });

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => expect(mockEnsureAccount).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("MUT-BOOT-6 (WEB-3 item 5): the disabled 'Retrying…' button uses an explicit muted colour, not opacity, while a retry is in flight", async () => {
    let resolveRetry: (v: { created: boolean; granted: boolean; coins: number }) => void = () => {};
    mockEnsureAccount.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRetry = resolve;
      }),
    );
    render(<EngineBootstrap />);
    act(() => {
      latestOnOutcome()({ status: "failure", failure: null });
    });

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    const retryingButton = screen.getByRole("button", { name: /retrying/i });
    expect(retryingButton).toBeDisabled();
    expect(retryingButton.className).toContain("disabled:text-muted-foreground");
    expect(retryingButton.className).not.toContain("opacity-60");

    await act(async () => {
      resolveRetry({ created: false, granted: false, coins: 0 });
    });
  });
});
