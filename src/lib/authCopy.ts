import type { AuthFailure } from "./authErrors";
import type { EngineFailure } from "./engineErrors";

/** Human label for a Firebase sign-in-method string, used throughout the
 * account-linking collision flow (sign-in design spec §5). */
export function providerLabelForMethod(method: string): string {
  switch (method) {
    case "google.com":
      return "Google";
    case "microsoft.com":
      return "Microsoft";
    case "password":
      return "your email and password";
    default:
      return method;
  }
}

export function providerLabel(provider: "google" | "microsoft" | "email"): string {
  switch (provider) {
    case "google":
      return "Google";
    case "microsoft":
      return "Microsoft";
    case "email":
      return "your email and password";
  }
}

/**
 * Page-level banner copy for an `AuthFailure` that isn't handled as a
 * field-level error or the collision flow — spec §4.5's "generic" case.
 * `popup-closed-by-user` is handled by callers before this is ever reached
 * (it's silent, per spec §4.2) and is not given copy here.
 */
export function authFailureMessage(failure: AuthFailure): string {
  if (failure.cause?.code === "auth/popup-blocked") {
    return "Your browser blocked the sign-in popup. Allow pop-ups for this site and try again.";
  }
  switch (failure.reason) {
    case "too-many-requests":
      return "Too many attempts — please wait a moment and try again.";
    case "network-request-failed":
      return CONNECTION_FAILED_MESSAGE;
    case "account-exists-with-different-credential":
      // Should always be intercepted into the collision flow before this is
      // shown — kept as a safe fallback in case the email/credential
      // couldn't be recovered from the error (see AuthCard's collision
      // handler).
      return "This email is already linked to a different sign-in method. Try the original method, or email hello@ileadit.co.uk.";
    default:
      // Never the raw Firebase text: it can name the underlying error code
      // (e.g. "auth/user-disabled") and so leak account state.
      return GENERIC_FAILURE_MESSAGE;
  }
}

/**
 * Neutral account-existence copy (WEB-AUTH-1 / N-15 / WEB-H2). None of these
 * may ever reveal whether an account exists for a given email.
 */
export const SIGN_IN_FAILED_MESSAGE = "Check your email and password and try again.";
export const SIGN_UP_COLLISION_MESSAGE =
  "We couldn't create that account. If you already have one, sign in or reset your password.";
export const RESET_SENT_MESSAGE = "If there's an account for that email, we've sent a reset link.";
export const GENERIC_FAILURE_MESSAGE = "We couldn't complete that. Please try again.";
export const CONNECTION_FAILED_MESSAGE = "We couldn't reach ileadit. Check your connection and try again.";

/**
 * Copy for an email/password SIGN-IN failure. Wrong password, unknown user
 * and disabled account all map to `invalid-credential` (authErrors.ts) and
 * get the same message; a network failure gets a distinct connection
 * message; anything unrecognised gets a generic retry rather than the raw
 * Firebase message (which can name the underlying code).
 */
export function signInFailureMessage(failure: AuthFailure): string {
  switch (failure.reason) {
    case "invalid-credential":
      return SIGN_IN_FAILED_MESSAGE;
    case "network-request-failed":
      return CONNECTION_FAILED_MESSAGE;
    case "too-many-requests":
      return authFailureMessage(failure);
    default:
      return "We couldn't sign you in. Please try again.";
  }
}

/** Mirrors the app-wide convention (engineErrors.ts) of failing the same way
 * everywhere rather than inventing new copy per page. */
export function engineFailureMessage(failure: EngineFailure): string {
  return `We signed you in, but couldn't finish setting up your account (${failure.reason}). Please refresh and try again, or email hello@ileadit.co.uk if it keeps happening.`;
}

/**
 * Copy for `EngineBootstrap`'s background account-setup banner (W2-SURFACE).
 * Deliberately DIFFERENT wording from `engineFailureMessage` above, even
 * though both describe the same underlying `ensureAccount` failure: that one
 * fires seconds after an interactive sign-in ("we signed you in, but..."),
 * this one fires on `wireEnsureAccountOnSignIn`'s background listener, which
 * runs on every page load for any RETURNING signed-in visitor - "we signed
 * you in" would be actively wrong there. `failure` is `EngineFailure | null`
 * (never coerced to a fallback failure) because a `null` mapping is still a
 * real, unmapped error - see `EnsureAccountOutcome` in `ensureAccount.ts`.
 */
export function ensureAccountRetryMessage(failure: EngineFailure | null): string {
  const detail = failure ? ` (${failure.reason})` : "";
  return (
    `We couldn't finish setting up your account${detail}. Some features may not work until ` +
    "this succeeds — try again, or email hello@ileadit.co.uk if it keeps happening."
  );
}
