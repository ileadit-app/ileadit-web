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

  // WEB-CR1-FIX3: before this ticket, ANY reason other than invalid-email/
  // network-request-failed/too-many-requests fell through to a false "sent"
  // — including config failures, internal errors, and any other unrecognised
  // code, all of which map to toAuthFailure's "unknown" reason. None of
  // those reveal account existence, so none may be reported as a successful
  // send.
  it.each(["auth/internal-error", "auth/configuration-not-found", "auth/something-nobody-has-seen-yet"])(
    "reports a real, generic error for an unrecognised failure (%s), not sent",
    async (code) => {
      sendPasswordResetEmailMock.mockRejectedValue(authError(code));
      const outcome = await requestPasswordReset("a@b.co");
      expect(outcome.status).toBe("error");
      const message = (outcome as { status: "error"; message: string }).message;
      // Never the raw Firebase code, and never claims a link was sent.
      expect(message).not.toMatch(new RegExp(code.replace(/[/-]/g, ".")));
      expect(message.toLowerCase()).not.toMatch(/sent a reset link/);
    },
  );
});
