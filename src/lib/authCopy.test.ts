import { describe, expect, it } from "vitest";
import { toAuthFailure } from "./authErrors";
import { GENERIC_FAILURE_MESSAGE, authFailureMessage, signInFailureMessage } from "./authCopy";

/** WEB-AUTH-1 review follow-up: raw Firebase text never reaches the UI. */
const RAW = "Firebase: Error (auth/some-internal-code).";

function failureFor(code: string) {
  return toAuthFailure(Object.assign(new Error(RAW), { code }));
}

describe("authFailureMessage", () => {
  it.each(["auth/some-internal-code", "auth/operation-not-allowed", "auth/internal-error"])(
    "falls back to generic copy for %s",
    (code) => {
      expect(authFailureMessage(failureFor(code))).toBe(GENERIC_FAILURE_MESSAGE);
    },
  );

  it("falls back to generic copy for a non-Firebase error", () => {
    expect(authFailureMessage(toAuthFailure(new Error(RAW)))).toBe(GENERIC_FAILURE_MESSAGE);
  });

  it("keeps the specific network copy", () => {
    expect(authFailureMessage(failureFor("auth/network-request-failed"))).toBe(
      "We couldn't reach ileadit. Check your connection and try again.",
    );
  });
});

describe("signInFailureMessage", () => {
  it("never returns the raw Firebase message", () => {
    expect(signInFailureMessage(failureFor("auth/some-internal-code"))).not.toContain("Firebase");
  });
});
