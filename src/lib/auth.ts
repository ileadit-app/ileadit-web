import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase";
import { toAuthFailure, type AuthFailure } from "./authErrors";
import { authFailureMessage } from "./authCopy";

/**
 * Sign-in/sign-up FUNCTIONS only — no screens. Lacey owns the sign-in and
 * create-account UI (see the P1.2 ticket); this module is the plumbing
 * underneath it, in the same "typed result, not a boolean" spirit as the
 * engine callables (`src/lib/ensureAccount.ts`, `src/lib/engineErrors.ts`).
 *
 * Every function returns an `AuthOutcome`, never throws on an expected
 * failure (a network exception from the SDK itself can still escape — that
 * is a genuinely exceptional case, not a form-fillable outcome). Callers
 * switch on `outcome.status`.
 */
export type AuthOutcome =
  | { status: "success"; user: User }
  | { status: "failure"; failure: AuthFailure }
  /**
   * Returned ONLY by `signInWithMicrosoft()` when the Microsoft provider is
   * not yet configured (see that function's comment below). Kept as its
   * own status, distinct from `"failure"`, so a caller can tell "this
   * button doesn't work yet" apart from "the user did something that
   * failed" — the former should disable/hide the button, the latter should
   * show an error.
   */
  | { status: "unavailable"; reason: string };

async function runSignIn(action: () => Promise<{ user: User }>): Promise<AuthOutcome> {
  try {
    const credential = await action();
    return { status: "success", user: credential.user };
  } catch (error) {
    return { status: "failure", failure: toAuthFailure(error) };
  }
}

/**
 * Creates a new email/password account. On Paul's 2026-09-20 "one account
 * per email" decision (automation-hub/docs/ileadit-web-accounts-BA-20260920.md),
 * if this email already has a Google or Microsoft account, Firebase refuses
 * this call — surfaced here as an ordinary `AuthFailure` with reason
 * `"email-already-in-use"` (the email/password-specific collision code;
 * `"account-exists-with-different-credential"` is the OAuth-popup-specific
 * variant thrown by `signInWithGoogle`/`signInWithMicrosoft` below, not this
 * function — see authErrors.ts for why the two are kept distinct).
 *
 * Does NOT call `ensureAccount` — that stays exclusively wired through
 * `wireEnsureAccountOnSignIn()` (src/lib/ensureAccount.ts, mounted by
 * `EngineBootstrap`), which fires on the `onAuthStateChanged` event this
 * sign-up triggers. Calling it again here would just re-run an idempotent
 * no-op, but doing so would blur where the one call site is meant to live.
 */
export async function signUpWithEmail(email: string, password: string): Promise<AuthOutcome> {
  return runSignIn(() => createUserWithEmailAndPassword(getFirebaseAuth(), email, password));
}

/** Signs in an existing email/password account. */
export async function signInWithEmail(email: string, password: string): Promise<AuthOutcome> {
  return runSignIn(() => signInWithEmailAndPassword(getFirebaseAuth(), email, password));
}

/**
 * Google sign-in/sign-up via a popup (one call does both — Firebase creates
 * the account on first sign-in). If this email already has a
 * password-based or Microsoft account, Firebase throws
 * `auth/account-exists-with-different-credential` instead of silently
 * merging — that is caught by `toAuthFailure` and surfaces as its own
 * `AuthFailure.reason`, which is the hook Lacey's "sign in with Google to
 * link Microsoft" recovery screen needs (see authErrors.ts).
 */
export async function signInWithGoogle(): Promise<AuthOutcome> {
  return runSignIn(() => signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider()));
}

/**
 * Outcome of a password-reset request (WEB-AUTH-1, revised 2026-10-28 code
 * review WEB-CR1). The account-existence secrecy rule (N-15 / WEB-H2) is
 * narrower than "collapse every error to sent": it only bans telling a
 * stranger whether THIS EMAIL has an account, which is exactly what
 * `auth/user-not-found`/`auth/user-disabled`/`auth/invalid-credential` would
 * reveal if shown distinctly. A transient infrastructure failure
 * (`network-request-failed`, `too-many-requests`) reveals nothing about the
 * email and showing it a generic "sent" message instead is actively unhelpful
 * — the user would wait for an email that was never sent and has no way to
 * know a retry might fix it. So there are three states, not two: `"sent"`
 * covers both real success AND every account-existence-revealing failure;
 * `"invalid-email"` is the pre-existing malformed-address field error;
 * `"error"` is new, for the two failure reasons above only, carrying a
 * ready-to-display message (never the raw Firebase error).
 */
export type PasswordResetOutcome =
  | { status: "sent" }
  | { status: "invalid-email" }
  | { status: "error"; message: string };

export async function requestPasswordReset(email: string): Promise<PasswordResetOutcome> {
  try {
    await sendPasswordResetEmail(getFirebaseAuth(), email);
  } catch (error) {
    const failure = toAuthFailure(error);
    if (failure.reason === "invalid-email") return { status: "invalid-email" };
    if (failure.reason === "network-request-failed" || failure.reason === "too-many-requests") {
      return { status: "error", message: authFailureMessage(failure) };
    }
    // Any other reason (invalid-credential/unknown, covering
    // user-not-found/user-disabled) falls through to "sent" below —
    // revealing account existence is the one thing this must never do.
  }
  return { status: "sent" };
}

const MICROSOFT_PROVIDER_ID = "microsoft.com";

/**
 * True once Paul has (a) created the Azure AD app registration, (b)
 * configured its client ID/secret as the Microsoft OAuth provider in the
 * Firebase console (ileadit-app project → Authentication → Sign-in
 * method), AND (c) set `NEXT_PUBLIC_MICROSOFT_AUTH_ENABLED=true` in this
 * deployment's environment. All three are required — the env flag alone
 * does not make Microsoft sign-in work, but its ABSENCE is what keeps this
 * module from ever attempting a call that is guaranteed to fail against an
 * unconfigured provider. This is the one thing a future developer needs to
 * flip; nothing else in this file changes when Microsoft is enabled.
 */
export function isMicrosoftSignInEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MICROSOFT_AUTH_ENABLED === "true";
}

/**
 * Microsoft sign-in/sign-up, scaffolded but NOT wired — Paul has not yet
 * created the Azure AD app registration this needs (see the P1.2 ticket:
 * "MICROSOFT IS NOT WIRED YET"). Calling this today returns
 * `{ status: "unavailable" }` deterministically, every time, rather than
 * attempting a popup against a provider Firebase hasn't been told about
 * (which would fail with an opaque `auth/operation-not-allowed` at best).
 * This is the legibility the ticket asked for: a caller checks
 * `isMicrosoftSignInEnabled()` (or just reads this function's return
 * status) to know whether to show a working button, a "coming soon" state,
 * or nothing at all — Lacey's call, not this module's.
 *
 * To enable once the Azure registration exists: configure the provider in
 * the Firebase console as described in `isMicrosoftSignInEnabled()`'s
 * comment above, then set `NEXT_PUBLIC_MICROSOFT_AUTH_ENABLED=true`. No
 * code in this file needs to change.
 */
export async function signInWithMicrosoft(): Promise<AuthOutcome> {
  if (!isMicrosoftSignInEnabled()) {
    return {
      status: "unavailable",
      reason:
        "Microsoft sign-in is not configured yet (no Azure AD app registration). " +
        "See isMicrosoftSignInEnabled() in src/lib/auth.ts.",
    };
  }

  return runSignIn(() => signInWithPopup(getFirebaseAuth(), new OAuthProvider(MICROSOFT_PROVIDER_ID)));
}

/** Signs the current user out. Delegates to the auth context's `signOut` in
 * practice (src/context/AuthContext.tsx) — exported here too so a non-React
 * call site (or a test) doesn't need to reach through the context. */
export async function signOutUser(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
}
