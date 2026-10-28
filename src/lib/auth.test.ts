import { describe, expect, it, vi, beforeEach } from "vitest";

/** WEB-AUTH-1: the reset request never reveals whether an account exists. */
const sendPasswordResetEmailMock = vi.fn();
vi.mock("firebase/auth", () => ({
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmailMock(...args),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  OAuthProvider: vi.fn(),
}));
vi.mock("./firebase", () => ({ getFirebaseAuth: () => ({}) }));

import { requestPasswordReset } from "./auth";

function authError(code: string) {
  return Object.assign(new Error(code), { code });
}

beforeEach(() => {
  sendPasswordResetEmailMock.mockReset();
});

describe("requestPasswordReset", () => {
  it("reports sent on success", async () => {
    sendPasswordResetEmailMock.mockResolvedValue(undefined);
    await expect(requestPasswordReset("a@b.co")).resolves.toEqual({ status: "sent" });
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith({}, "a@b.co");
  });

  it.each(["auth/user-not-found", "auth/user-disabled"])(
    "still reports sent for %s (account-existence secrecy)",
    async (code) => {
      sendPasswordResetEmailMock.mockRejectedValue(authError(code));
      await expect(requestPasswordReset("a@b.co")).resolves.toEqual({ status: "sent" });
    },
  );

  it("reports invalid-email only for a malformed address", async () => {
    sendPasswordResetEmailMock.mockRejectedValue(authError("auth/invalid-email"));
    await expect(requestPasswordReset("nope")).resolves.toEqual({ status: "invalid-email" });
  });

  it("reports a real error for too-many-requests, not sent", async () => {
    sendPasswordResetEmailMock.mockRejectedValue(authError("auth/too-many-requests"));
    const outcome = await requestPasswordReset("a@b.co");
    expect(outcome.status).toBe("error");
    expect((outcome as { status: "error"; message: string }).message).toMatch(/too many attempts/i);
  });

  it("reports a real error for a network failure, not sent", async () => {
    sendPasswordResetEmailMock.mockRejectedValue(authError("auth/network-request-failed"));
    const outcome = await requestPasswordReset("a@b.co");
    expect(outcome.status).toBe("error");
    expect((outcome as { status: "error"; message: string }).message).toMatch(/couldn't reach ileadit/i);
  });
});
