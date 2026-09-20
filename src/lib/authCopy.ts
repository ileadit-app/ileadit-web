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
    return "Your browser blocked the sign-in popup. Allow pop-ups for ileadit.app and try again.";
  }
  switch (failure.reason) {
    case "too-many-requests":
      return "Too many attempts — please wait a moment and try again.";
    case "network-request-failed":
      return "We couldn't reach ileadit. Check your connection and try again.";
    case "account-exists-with-different-credential":
      // Should always be intercepted into the collision flow before this is
      // shown — kept as a safe fallback in case the email/credential
      // couldn't be recovered from the error (see AuthCard's collision
      // handler).
      return "This email is already linked to a different sign-in method. Try the original method, or email hello@ileadit.app.";
    default:
      return failure.message || "Something went wrong. Please try again.";
  }
}

/** Mirrors the app-wide convention (engineErrors.ts) of failing the same way
 * everywhere rather than inventing new copy per page. */
export function engineFailureMessage(failure: EngineFailure): string {
  return `We signed you in, but couldn't finish setting up your account (${failure.reason}). Please refresh and try again, or email hello@ileadit.app if it keeps happening.`;
}
