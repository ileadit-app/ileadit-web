"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { requestPasswordReset } from "@/lib/auth";
import { RESET_SENT_MESSAGE } from "@/lib/authCopy";
import { EmailField } from "./formFields";

/** Matches the Android app's ForgotPassword resend cooldown. */
export const RESEND_COOLDOWN_SECONDS = 30;

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `/reset-password` (WEB-AUTH-1, fixing WEB-B2). Calls
 * `sendPasswordResetEmail` via `requestPasswordReset` and ALWAYS shows the
 * same neutral confirmation, whether or not an account exists for the email
 * (N-15 / WEB-H2). The only other message is a malformed-email field error.
 * After each send the button becomes "Resend link" and is disabled for 30 s,
 * like the app; the countdown is shown as helper text, not in the label.
 */
export function ResetPasswordCard() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Time of the latest send (null = not sent yet). Shown in the confirmation
  // and used as its React key, so each resend remounts the text inside the
  // live region and screen readers announce it again.
  const [sentAt, setSentAt] = useState<Date | null>(null);
  const sent = sentAt !== null;
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  function startCooldown() {
    if (timerRef.current) clearInterval(timerRef.current);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending || cooldown > 0) return;
    const trimmed = email.trim();
    if (!EMAIL_FORMAT.test(trimmed)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(null);
    setSending(true);
    const outcome = await requestPasswordReset(trimmed);
    setSending(false);
    if (outcome.status === "invalid-email") {
      setEmailError("Enter a valid email address.");
      return;
    }
    setSentAt(new Date());
    startCooldown();
  }

  const buttonDisabled = sending || cooldown > 0;
  const buttonLabel = sending ? "Sending…" : sent ? "Resend link" : "Send reset link";

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Reset your password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the email you use for ileadit and we&apos;ll send you a link to choose a new password.
      </p>

      <div aria-live="polite">
        {sentAt ? (
          <div key={sentAt.getTime()} className="mt-6 flex items-start gap-2 rounded-xl border border-border bg-secondary p-3 text-sm font-medium text-foreground">
            <MailCheck className="mt-0.5 size-4 shrink-0 text-brand-navy" aria-hidden="true" />
            <span>
              {RESET_SENT_MESSAGE} Check your spam folder if it doesn&apos;t arrive in a few minutes. (Sent at{" "}
              {sentAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}.)
            </span>
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <EmailField
          value={email}
          onChange={(v) => {
            setEmail(v);
            setEmailError(null);
          }}
          error={emailError ?? undefined}
          disabled={sending}
        />
        <div>
          <button
            type="submit"
            disabled={buttonDisabled}
            aria-describedby={cooldown > 0 ? "reset-cooldown" : undefined}
            className="h-12 w-full rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed disabled:border-transparent disabled:bg-cta-disabled disabled:text-cta-disabled-foreground"
          >
            {buttonLabel}
          </button>
          {cooldown > 0 ? (
            <p id="reset-cooldown" className="mt-2 text-center text-xs text-muted-foreground">
              You can resend in {cooldown}s.
            </p>
          ) : null}
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-foreground hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
