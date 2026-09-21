"use client";

import { useState } from "react";
import {
  GoogleAuthProvider,
  OAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  type AuthCredential,
} from "firebase/auth";
import { CheckCircle2, Link2 } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase";
import { toAuthFailure } from "@/lib/authErrors";
import { providerLabelForMethod } from "@/lib/authCopy";
import { EmailField, ErrorBanner, PasswordField } from "./formFields";

export interface CollisionInfo {
  email: string;
  existingMethod: "google.com" | "microsoft.com" | "password";
  /** The credential from whichever provider the user originally attempted —
   * an OAuth credential recovered via `credentialFromError`, or (for an
   * email/password signup attempt that collided with an OAuth account) a
   * synthesized `EmailAuthProvider.credential(email, password)`. Linked onto
   * the *existing* account once the user proves ownership of it below. */
  pendingCredential: AuthCredential;
  /** "Google" | "Microsoft" | "your email and password" — whichever method
   * was just attempted, for the body copy and the link-success screen. */
  attemptedProviderLabel: string;
}

/**
 * The account-linking collision screen — sign-in design spec §5, the
 * "load-bearing" part of this ticket per Paul's one-account-per-email
 * decision. Renders IN PLACE of the form content inside the same AuthCard
 * (not a new route), so `redirect` and in-progress state survive.
 */
export function AccountLinkingPanel({
  info,
  onBack,
  onLinked,
}: {
  info: CollisionInfo;
  onBack: () => void;
  onLinked: () => void;
}) {
  const [linking, setLinking] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const existingLabel = providerLabelForMethod(info.existingMethod);
  // Narrowed to locals (not repeated `info.existingMethod` property access)
  // so TS can track the "not password" case into the closure passed to
  // `onClick` below — property-access narrowing doesn't survive into a
  // nested arrow function the way a local `const` does.
  const existingMethodIsPassword = info.existingMethod === "password";
  const existingOAuthMethod = info.existingMethod !== "password" ? info.existingMethod : null;

  async function linkViaProvider(providerId: "google.com" | "microsoft.com") {
    setLinking(true);
    setError(null);
    try {
      const authProvider = providerId === "google.com" ? new GoogleAuthProvider() : new OAuthProvider("microsoft.com");
      const result = await signInWithPopup(getFirebaseAuth(), authProvider);
      await linkWithCredential(result.user, info.pendingCredential);
      onLinked();
    } catch (err) {
      setError(toAuthFailure(err).message || "We couldn't link that account. Please try again.");
    } finally {
      setLinking(false);
    }
  }

  async function linkViaPassword(e: React.FormEvent) {
    e.preventDefault();
    setLinking(true);
    setError(null);
    try {
      const result = await signInWithEmailAndPassword(getFirebaseAuth(), info.email, password);
      await linkWithCredential(result.user, info.pendingCredential);
      onLinked();
    } catch (err) {
      setError(toAuthFailure(err).message || "We couldn't sign you in. Please try again.");
    } finally {
      setLinking(false);
    }
  }

  return (
    <div>
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-gold/15 text-brand-navy">
        <Link2 className="size-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-center text-xl font-extrabold text-foreground">
        You&apos;ve already got an account
      </h2>
      <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
        There&apos;s already an ileadit account for <strong className="text-foreground">{info.email}</strong>,
        signed up with <strong className="text-foreground">{existingLabel}</strong>. Sign in with{" "}
        {existingLabel} to continue — you&apos;ll keep every coin, life and competition, and we&apos;ll link{" "}
        {info.attemptedProviderLabel} to the same account so either one works next time.
      </p>

      {error ? (
        <div className="mt-6">
          <ErrorBanner message={error} />
          <p className="text-center text-xs text-muted-foreground">
            Still stuck?{" "}
            <a href="mailto:hello@ileadit.app" className="font-semibold text-foreground hover:underline">
              Email hello@ileadit.app
            </a>
          </p>
        </div>
      ) : null}

      {existingMethodIsPassword ? (
        <form onSubmit={linkViaPassword} className="mt-6 space-y-4">
          <EmailField value={info.email} readOnly />
          <PasswordField
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            disabled={linking}
          />
          <button
            type="submit"
            disabled={linking}
            className="h-12 w-full rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed disabled:border-transparent disabled:bg-cta-disabled disabled:text-cta-disabled-foreground"
          >
            {linking ? "Signing in…" : "Sign in & link"}
          </button>
        </form>
      ) : existingOAuthMethod ? (
        <button
          type="button"
          onClick={() => linkViaProvider(existingOAuthMethod)}
          disabled={linking}
          className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed disabled:border-cta-disabled disabled:bg-cta-disabled disabled:text-cta-disabled-foreground"
        >
          {linking ? "Connecting…" : `Continue with ${existingLabel}`}
        </button>
      ) : null}

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          Try a different email →
        </button>
      </div>
    </div>
  );
}

/** Link success — spec §5.4. Auto-redirects after 1.5s AND shows a manual
 * "Continue" button; never rely on a timer alone (WCAG 2.2 AA / keyboard-nav
 * standard, CLAUDE.md Standards section). */
export function LinkSuccessPanel({
  attemptedProviderLabel,
  onContinue,
}: {
  attemptedProviderLabel: string;
  onContinue: () => void;
}) {
  return (
    <div>
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-gold/15 text-brand-navy">
        <CheckCircle2 className="size-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-center text-xl font-extrabold text-foreground">You&apos;re all set</h2>
      <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
        {attemptedProviderLabel} is now linked to your ileadit account. Sign in with either one from now on.
      </p>
      <button
        type="button"
        onClick={onContinue}
        className="mt-6 h-12 w-full rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
      >
        Continue
      </button>
    </div>
  );
}
