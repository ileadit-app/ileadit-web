import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useStrictAdmin } from "./useStrictAdmin";

/**
 * Direct tests of the strict admin hook (WEB-PORTAL-USAGE-1 QA). Only the
 * boundaries are mocked: who the auth context says is signed in, and the
 * Firebase SDK getters / token listener. The hook, `hasStrictAdminClaim` and
 * their state machine run for real.
 */

const useUserMock = vi.fn();
vi.mock("@/context/AuthContext", () => ({ useUser: () => useUserMock() }));
vi.mock("./firebase", () => ({ getFirebaseAuth: () => ({}) }));
vi.mock("firebase/auth", () => ({ onIdTokenChanged: () => () => {} }));

type Claims = Record<string, unknown>;
function userWith(uid: string, tokenResult: () => Promise<{ claims: Claims }>) {
  return { uid, getIdTokenResult: vi.fn(tokenResult) };
}

beforeEach(() => {
  useUserMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("useStrictAdmin", () => {
  it("is allowed only for claims.admin === true, after a forced refresh", async () => {
    const user = userWith("a", async () => ({ claims: { admin: true } }));
    useUserMock.mockReturnValue({ status: "signed-in", user });
    const { result } = renderHook(() => useStrictAdmin());
    expect(result.current).toBe("checking");
    await waitFor(() => expect(result.current).toBe("allowed"));
    expect(user.getIdTokenResult).toHaveBeenCalledWith(true);
  });

  it("a different user on the same tab starts again from checking, never inheriting the last user's answer", async () => {
    const admin = userWith("admin-uid", async () => ({ claims: { admin: true } }));
    useUserMock.mockReturnValue({ status: "signed-in", user: admin });
    const { result, rerender } = renderHook(() => useStrictAdmin());
    await waitFor(() => expect(result.current).toBe("allowed"));

    // Someone else signs in; their token check never resolves.
    const other = userWith("other-uid", () => new Promise(() => {}));
    useUserMock.mockReturnValue({ status: "signed-in", user: other });
    rerender();
    await waitFor(() => expect(other.getIdTokenResult).toHaveBeenCalled());
    expect(result.current).toBe("checking");
  });

  it("is never allowed unless the session status is signed-in, even with a user object and a good token", async () => {
    const user = userWith("a", async () => ({ claims: { admin: true } }));
    useUserMock.mockReturnValue({ status: "signed-in", user });
    const { result, rerender } = renderHook(() => useStrictAdmin());
    await waitFor(() => expect(result.current).toBe("allowed"));

    for (const status of ["loading", "signed-out"]) {
      useUserMock.mockReturnValue({ status, user });
      rerender();
      expect(result.current, status).toBe("checking");
    }
  });
});
