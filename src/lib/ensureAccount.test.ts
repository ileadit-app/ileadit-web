import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import type { EnsureAccountResult } from "./ensureAccount";

/**
 * Pins the W2-SURFACE fix at the REAL callable boundary: before this
 * ticket, `wireEnsureAccountOnSignIn`'s `.catch` only ever reached
 * `console.error` - nothing else. This file answers "does a real
 * ensureAccount failure actually reach the `onOutcome` callback at all";
 * `EngineBootstrap.test.tsx` answers the separate question "given an
 * outcome, what does the user see" (same split as this repo's existing
 * `CreateCompetitionGate.test.tsx` vs. `CreateCompetitionForm.test.tsx`).
 *
 * Two mocks at the actual callable boundary, same discipline as
 * `CreateCompetitionForm.test.tsx`: `firebase/functions`'s `httpsCallable`
 * IS the boundary (nothing is deployed - a test that needs a network can't
 * run). `./functions` and `./firebase` (this module's own relative imports)
 * are stubbed only to avoid real Firebase app / App Check initialization in
 * jsdom - never inspected by the mocked `httpsCallable`, so they don't
 * shrink what's under test. `firebase/auth`'s `onAuthStateChanged` is
 * mocked to synthesize a sign-in event directly, since there is no real
 * Firebase Auth session available here.
 *
 * `wireEnsureAccountOnSignIn` has a module-level `wired` singleton (by
 * design - see its own doc comment) that only lets ONE registration happen
 * per module instance. `vi.resetModules()` + a dynamic re-import gives each
 * test below a clean instance rather than fighting that singleton.
 */

const mockCallable = vi.fn();
vi.mock("firebase/functions", () => ({
  httpsCallable: () => mockCallable,
}));

vi.mock("./functions", () => ({
  getFunctionsClient: () => ({}),
}));

vi.mock("./firebase", () => ({
  getFirebaseAuth: () => ({}),
}));

let capturedAuthCallback: ((user: { uid: string } | null) => void) | null = null;
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (user: { uid: string } | null) => void) => {
    capturedAuthCallback = cb;
    return vi.fn();
  },
}));

beforeEach(() => {
  vi.resetModules();
  mockCallable.mockReset();
  capturedAuthCallback = null;
});

describe("wireEnsureAccountOnSignIn — onOutcome is never left uncalled", () => {
  it("MUT-ENSURE-1: a successful call reaches onOutcome as status:success with the real result", async () => {
    const result: EnsureAccountResult = { created: true, granted: true, coins: 100 };
    mockCallable.mockResolvedValueOnce({ data: result });

    const { wireEnsureAccountOnSignIn } = await import("./ensureAccount");
    const onOutcome = vi.fn();
    wireEnsureAccountOnSignIn(onOutcome);

    capturedAuthCallback?.({ uid: "u1" });

    await waitFor(() => expect(onOutcome).toHaveBeenCalledTimes(1));
    expect(onOutcome).toHaveBeenCalledWith({ status: "success", result });
  });

  it("MUT-ENSURE-2: a failed call reaches onOutcome as status:failure — this is the fix; it used to only reach console.error", async () => {
    mockCallable.mockRejectedValueOnce(new Error("engine unreachable — nothing deployed"));

    const { wireEnsureAccountOnSignIn } = await import("./ensureAccount");
    const onOutcome = vi.fn();
    wireEnsureAccountOnSignIn(onOutcome);

    capturedAuthCallback?.({ uid: "u1" });

    await waitFor(() => expect(onOutcome).toHaveBeenCalledTimes(1));
    expect(onOutcome).toHaveBeenCalledWith({ status: "failure", failure: null });
  });

  it("MUT-ENSURE-3: no user in the auth event → the callable is never called and onOutcome is never called", async () => {
    const { wireEnsureAccountOnSignIn } = await import("./ensureAccount");
    const onOutcome = vi.fn();
    wireEnsureAccountOnSignIn(onOutcome);

    capturedAuthCallback?.(null);

    expect(mockCallable).not.toHaveBeenCalled();
    expect(onOutcome).not.toHaveBeenCalled();
  });
});
