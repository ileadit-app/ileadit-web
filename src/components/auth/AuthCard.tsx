"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import { LogoMark } from "@/components/brand/Logo";
import {
  signInWithEmail,
  signInWithGoogle,
  signInWithMicrosoft,
  signUpWithEmail,
  isMicrosoftSignInEnabled,
} from "@/lib/auth";
import type { AuthFailure } from "@/lib/authErrors";
import { getFirebaseAuth } from "@/lib/firebase";
import { ensureAccount } from "@/lib/ensureAccount";
import { toEngineFailure } from "@/lib/engineErrors";
import { resolveSafeRedirect } from "@/lib/safeRedirect";
import { authFailureMessage, engineFailureMessage, providerLabel } from "@/lib/authCopy";
import { ProviderButton } from "./ProviderButton";
import { AccountLinkingPanel, LinkSuccessPanel, type CollisionInfo } from "./AccountLinkingPanel";
import { EmailField, ErrorBanner, PasswordField } from "./formFields";

type EmailFieldError = { kind: "invalid" } | { kind: "in-use" };

type Phase =
  | { kind: "form" }
  | { kind: "ensuring-account" }
  | { kind: "collision"; info: CollisionInfo }
  | { kind: "link-success"; attemptedProviderLabel: string };

const COPY = {
  signin: {
    heading: "Welcome back",
    subheading: "Sign in to your ileadit account.",
    submitLabel: "Sign in",
    submitLoadingLabel: "Signing in…",
    passwordAutoComplete: "current-password" as const,
  },
  signup: {
    heading: "Create your account",
    subheading: "Takes about 30 seconds.",
    submitLabel: "Create account",
    submitLoadingLabel: "Creating account…",
    passwordAutoComplete: "new-password" as const,
  },
};

/**
 * The form + provider buttons + state machine — sign-in design spec §4.
 * `/login` and `/signup` are ~5-line wrappers around this one component
 * (`mode` drives copy/CTA only) so provider wiring, error handling and the
 * collision flow live in exactly one place (spec §2).
 *
 * Uses `useSearchParams()`, so callers (the two page files) must render this
 * inside a `<Suspense>` boundary — required by Next's App Router for any
 * statically-rendered route that reads the search params.
 */
export function AuthCard({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const copy = COPY[mode];

  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [providerLoading, setProviderLoading] = useState<"google" | "microsoft" | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [emailFieldError, setEmailFieldError] = useState<EmailFieldError | null>(null);
  const [passwordFieldError, setPasswordFieldError] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Autofocus on desktop only (spec §4.4) — skip on phone widths to avoid
    // yanking the mobile keyboard open on page load. Done imperatively
    // (rather than the `autoFocus` DOM attribute) so the initial server-
    // rendered markup never differs from the client, avoiding a hydration
    // mismatch warning.
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      emailInputRef.current?.focus();
    }
  }, []);

  const anyLoading = providerLoading !== null || emailLoading;

  function withRedirectParam(path: string, extra?: { email?: string }): string {
    const params = new URLSearchParams();
    if (redirectParam) params.set("redirect", redirectParam);
    // Typed email carried over via a short-lived query param handoff, not
    // localStorage — no PII persistence beyond the current navigation
    // (spec §4.4, "Signup, same-provider collision").
    if (extra?.email) params.set("email", extra.email);
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }

  function redirectNow() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    router.replace(resolveSafeRedirect(redirectParam, origin));
  }

  /** Runs after ANY successful sign-in/sign-up/link — always calls
   * `ensureAccount` and awaits it before redirecting (spec §4.7): the global
   * `EngineBootstrap` listener also fires, but async, and isn't guaranteed to
   * finish before a client-side redirect renders `/dashboard`. */
  async function completeAuth(linkedAs?: string) {
    setPhase({ kind: "ensuring-account" });
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await ensureAccount(timeZone);
    } catch (error) {
      const engineFailure = toEngineFailure(error);
      setPageError(
        engineFailure
          ? engineFailureMessage(engineFailure)
          : "We signed you in, but couldn't finish setting up your account. Please refresh and try again.",
      );
      setPhase({ kind: "form" });
      return;
    }

    if (linkedAs) {
      setPhase({ kind: "link-success", attemptedProviderLabel: linkedAs });
      return;
    }
    redirectNow();
  }

  /** Opens the §5 collision panel given an ALREADY-FETCHED sign-in-methods
   * list for `email` (never fetches itself — both call sites below already
   * needed that list to decide whether this is a collision at all, and
   * `fetchSignInMethodsForEmail` is a network round-trip worth not
   * duplicating). Falls back to a generic banner when the existing method
   * isn't one of the three this client knows how to link against — notably
   * including the case where the project has Identity Platform's email
   * enumeration protection enabled, which makes `fetchSignInMethodsForEmail`
   * return `[]` regardless of the real answer. */
  function openCollisionPanel(
    email: string,
    existingMethod: string | undefined,
    pendingCredential: CollisionInfo["pendingCredential"],
    attemptedProviderLabel: string,
  ) {
    if (existingMethod !== "google.com" && existingMethod !== "microsoft.com" && existingMethod !== "password") {
      setPageError(
        "This email already has an ileadit account with a different sign-in method. " +
          "Try the original method, or email hello@ileadit.co.uk for help linking them.",
      );
      return;
    }
    setPhase({
      kind: "collision",
      info: { email, existingMethod, pendingCredential, attemptedProviderLabel },
    });
  }

  async function handleProvider(provider: "google" | "microsoft") {
    setPageError(null);
    setProviderLoading(provider);
    const outcome = provider === "google" ? await signInWithGoogle() : await signInWithMicrosoft();
    setProviderLoading(null);

    if (outcome.status === "unavailable") {
      // Should not normally be reachable — the button is disabled/labelled
      // "coming soon" while unavailable (see render below) — kept as a
      // defensive fallback so a click can never silently do nothing.
      setPageError("Microsoft sign-in isn't switched on yet — use email or Google for now.");
      return;
    }

    if (outcome.status === "success") {
      await completeAuth();
      return;
    }

    const failure = outcome.failure;
    if (failure.reason === "popup-closed-by-user") {
      return; // Silent — the user closed it on purpose (spec §4.2).
    }
    if (failure.reason === "account-exists-with-different-credential") {
      await handleOAuthCollision(failure, provider);
      return;
    }
    setPageError(authFailureMessage(failure));
  }

  async function handleOAuthCollision(failure: AuthFailure, attemptedProvider: "google" | "microsoft") {
    const email = failure.email;
    if (!email) {
      setPageError(authFailureMessage(failure));
      return;
    }
    const pendingCredential =
      attemptedProvider === "google"
        ? GoogleAuthProvider.credentialFromError(failure.cause)
        : OAuthProvider.credentialFromError(failure.cause);
    if (!pendingCredential) {
      setPageError("We couldn't complete that sign-in. Please try again.");
      return;
    }
    const methods = await fetchSignInMethodsForEmail(getFirebaseAuth(), email).catch(() => []);
    openCollisionPanel(email, methods[0], pendingCredential, providerLabel(attemptedProvider));
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPageError(null);
    setEmailFieldError(null);
    setPasswordFieldError(null);
    setEmailLoading(true);
    const outcome = mode === "signup" ? await signUpWithEmail(email, password) : await signInWithEmail(email, password);
    setEmailLoading(false);

    if (outcome.status === "success") {
      await completeAuth();
      return;
    }
    if (outcome.status === "unavailable") {
      // Unreachable in practice — signUpWithEmail/signInWithEmail never
      // return "unavailable" (only signInWithMicrosoft does) — handled so
      // the shared AuthOutcome type still narrows cleanly below.
      setPageError(outcome.reason);
      return;
    }

    const failure = outcome.failure;
    switch (failure.reason) {
      case "invalid-credential":
        setPasswordFieldError("Check your email and password and try again.");
        return;
      case "invalid-email":
        setEmailFieldError({ kind: "invalid" });
        return;
      case "weak-password":
        setPasswordFieldError("Use at least 8 characters.");
        return;
      case "too-many-requests":
        setPageError(authFailureMessage(failure));
        return;
      case "email-already-in-use": {
        const methods = await fetchSignInMethodsForEmail(getFirebaseAuth(), email).catch(() => []);
        if (methods.length === 1 && methods[0] === "password") {
          // Same-provider collision — field-level error, not the full
          // collision screen (spec §4.4).
          setEmailFieldError({ kind: "in-use" });
          return;
        }
        const existingMethod = methods[0];
        if (existingMethod === "google.com" || existingMethod === "microsoft.com") {
          // Cross-provider collision reached via the email/password FORM
          // rather than an OAuth popup — Firebase reports this as plain
          // `auth/email-already-in-use`, not
          // `account-exists-with-different-credential` (that code is
          // popup-specific). Still a genuine one-account-per-email
          // collision, so route into the same §5 panel: synthesize the
          // credential the user just typed and let them link it once they
          // prove ownership of the existing (OAuth) account.
          openCollisionPanel(
            email,
            existingMethod,
            EmailAuthProvider.credential(email, password),
            providerLabel("email"),
          );
          return;
        }
        setEmailFieldError({ kind: "in-use" });
        return;
      }
      default:
        setPageError(authFailureMessage(failure));
    }
  }

  if (phase.kind === "ensuring-account") {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <LogoMark className="h-12 w-12 animate-pulse" />
        <p className="mt-4 text-sm font-medium text-foreground">Just a second — setting up your game…</p>
      </div>
    );
  }

  if (phase.kind === "collision") {
    return (
      <AccountLinkingPanel
        info={phase.info}
        onBack={() => {
          setPhase({ kind: "form" });
          setPageError(null);
        }}
        onLinked={() => void completeAuth(phase.info.attemptedProviderLabel)}
      />
    );
  }

  if (phase.kind === "link-success") {
    return <LinkSuccessPanel attemptedProviderLabel={phase.attemptedProviderLabel} onContinue={redirectNow} />;
  }

  const microsoftEnabled = isMicrosoftSignInEnabled();

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{copy.heading}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{copy.subheading}</p>

      {pageError ? <div className="mt-6"><ErrorBanner message={pageError} /></div> : null}

      <div className={pageError ? "space-y-3" : "mt-6 space-y-3"}>
        <ProviderButton
          provider="google"
          label="Continue with Google"
          loading={providerLoading === "google"}
          disabled={anyLoading}
          onClick={() => void handleProvider("google")}
        />
        {microsoftEnabled ? (
          <ProviderButton
            provider="microsoft"
            label="Continue with Microsoft"
            loading={providerLoading === "microsoft"}
            disabled={anyLoading}
            onClick={() => void handleProvider("microsoft")}
          />
        ) : (
          // Never a button that silently does nothing: unavailable is shown
          // as a visibly disabled, clearly-labelled state, not hidden and
          // not a working-looking button (spec's provider-parity decision).
          <div
            className="flex h-12 w-full items-center justify-between gap-3 rounded-full border border-dashed border-border bg-muted px-4 text-sm font-semibold text-muted-foreground"
            aria-disabled="true"
            title="Microsoft sign-in is coming soon"
          >
            <span>Continue with Microsoft</span>
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Coming soon</span>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        or
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <form onSubmit={handleEmailSubmit} className="mt-6 space-y-4">
        <EmailField
          value={email}
          onChange={setEmail}
          error={emailFieldError?.kind === "invalid" ? "Enter a valid email address." : undefined}
          autoFocusOnDesktopRef={emailInputRef}
          disabled={anyLoading}
        />
        {emailFieldError?.kind === "in-use" ? (
          <p className="-mt-2 text-xs text-destructive">
            An account already exists for this email.{" "}
            <Link href={withRedirectParam("/login", { email })} className="font-semibold underline">
              Sign in instead →
            </Link>
          </p>
        ) : null}

        <PasswordField
          value={password}
          onChange={setPassword}
          error={passwordFieldError ?? undefined}
          helperText={mode === "signup" ? "At least 8 characters." : undefined}
          autoComplete={copy.passwordAutoComplete}
          disabled={anyLoading}
        />

        {mode === "signin" ? (
          <div className="-mt-2 text-right">
            <Link href="/reset-password" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
              Forgot password?
            </Link>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={anyLoading}
          className="mt-2 h-12 w-full rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed disabled:border-transparent disabled:bg-cta-disabled disabled:text-cta-disabled-foreground"
        >
          {emailLoading ? copy.submitLoadingLabel : copy.submitLabel}
        </button>
      </form>

      {mode === "signup" ? (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          By creating an account, you agree to our{" "}
          <Link href="/terms" className="font-semibold underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold underline">
            Privacy Policy
          </Link>
          .
        </p>
      ) : null}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "signin" ? (
          <>
            New to ileadit?{" "}
            <Link href={withRedirectParam("/signup")} className="font-semibold text-foreground hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href={withRedirectParam("/login")} className="font-semibold text-foreground hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
