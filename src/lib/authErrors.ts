import type { AuthError } from "firebase/auth";

/**
 * Typed sign-in/sign-up failure reasons this web client knows how to
 * recognise, mirroring the shape of `src/lib/engineErrors.ts`'s
 * `EngineFailureReason` deliberately — same "distinct outcomes, not
 * booleans" spirit, same "unrecognised errors fall through to a real value
 * the caller must still handle" contract. This module is auth-specific (a
 * Firebase Auth `AuthError`), engineErrors.ts is engine-callable-specific (a
 * Functions `FunctionsError`) — they are not interchangeable and a
 * `FunctionsError` will never reach this module.
 *
 * `account-exists-with-different-credential` exists as its OWN reason,
 * never folded into `"unknown"`, because Paul's 2026-09-20 decision (see
 * automation-hub/docs/ileadit-web-accounts-BA-20260920.md, "PAUL'S
 * DECISIONS", Q1b) is "one account per email" across all three providers
 * (email/password, Google, Microsoft) — Firebase enforces that by refusing
 * the second sign-up with exactly this error code, and Lacey's sign-in
 * design needs a distinct case to hook a "sign in with Google to link
 * Microsoft" recovery screen onto. Folding it into a generic error would
 * make that recovery flow unbuildable.
 */
export type AuthFailureReason =
  | "account-exists-with-different-credential"
  | "email-already-in-use"
  | "invalid-credential"
  | "weak-password"
  | "invalid-email"
  | "too-many-requests"
  | "popup-closed-by-user"
  | "network-request-failed"
  | "unknown";

export interface AuthFailure {
  reason: AuthFailureReason;
  message: string;
  /**
   * The colliding email address, when Firebase includes one on
   * `auth/account-exists-with-different-credential`
   * (`error.customData.email`). Deliberately optional, not guaranteed: a
   * project with Identity Platform's email enumeration protection enabled
   * can withhold it. Callers (Lacey's link-account recovery screen) must
   * handle the `undefined` case — e.g. by asking the user to re-enter the
   * email themselves — rather than assuming it is always present.
   */
  email?: string;
  /** The original AuthError, for logging — never swallow it. */
  cause: AuthError;
}

function isAuthError(error: unknown): error is AuthError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    (error as { code: string }).code.startsWith("auth/")
  );
}

/**
 * Maps a thrown Firebase Auth error to one of the typed reasons above.
 * Unrecognised `auth/*` codes map to `"unknown"` (a real, handleable value)
 * rather than `null` — unlike `toEngineFailure` in engineErrors.ts, every
 * auth error the SDK can throw is still an auth error a sign-in form must
 * show *something* for, so there is no meaningful "not my problem" case
 * here. A non-Firebase error (e.g. a network exception with no `.code`)
 * also collapses to `"unknown"` for the same reason — the UI still needs a
 * message to show.
 */
export function toAuthFailure(error: unknown): AuthFailure {
  if (!isAuthError(error)) {
    return {
      reason: "unknown",
      message: error instanceof Error ? error.message : "Something went wrong signing you in.",
      cause: error as AuthError,
    };
  }

  const email = (error.customData as { email?: string } | undefined)?.email;

  switch (error.code) {
    case "auth/account-exists-with-different-credential":
      return { reason: "account-exists-with-different-credential", message: error.message, email, cause: error };
    case "auth/email-already-in-use":
      return { reason: "email-already-in-use", message: error.message, email, cause: error };
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      // Firebase intentionally does not distinguish "wrong password" from
      // "no such user" in newer SDK versions (email enumeration
      // protection) — both surface as `auth/invalid-credential`. The two
      // legacy codes are kept here in case a project has that protection
      // disabled and still returns them individually; all three mean the
      // same thing to a sign-in form: "check your email and password."
      return { reason: "invalid-credential", message: error.message, cause: error };
    case "auth/weak-password":
      return { reason: "weak-password", message: error.message, cause: error };
    case "auth/invalid-email":
      return { reason: "invalid-email", message: error.message, cause: error };
    case "auth/too-many-requests":
      return { reason: "too-many-requests", message: error.message, cause: error };
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      // The user closed the Google/Microsoft popup themselves — not a
      // failure worth alarming over, but still a distinct, non-generic
      // reason so a caller can choose to show nothing at all here instead
      // of an error banner.
      return { reason: "popup-closed-by-user", message: error.message, cause: error };
    case "auth/network-request-failed":
      return { reason: "network-request-failed", message: error.message, cause: error };
    default:
      return { reason: "unknown", message: error.message, cause: error };
  }
}
