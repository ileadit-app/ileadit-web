"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Mail, ShieldCheck, Users } from "lucide-react";
import { useUser } from "@/context/AuthContext";

/**
 * /account-deletion (P1.6). Public — deliberately NOT behind
 * `<ProtectedRoute>`. This route exists because Google Play requires a
 * web-accessible account-deletion page for any app that supports account
 * creation, and that page has to work for someone who no longer has (or
 * never has) the app installed, so it cannot assume a signed-in session.
 *
 * THIS IS A REQUEST ROUTE, NOT A DELETE BUTTON. There is no `deleteAccount`
 * Cloud Functions callable in the engine repo as of commit `03aee1c`
 * (verified: `functions/src/index.ts` exports `health`,
 * `createWearCustomToken`, `ensureAccount`, `setNotificationPreferences`,
 * `seedHistory`, `submitSteps`, `joinCompetition`, `leaveCompetition`,
 * `createChallenge`, `bounceChallenge`, `passChallenge`, plus triggers and
 * scheduled jobs — no deletion callable anywhere in that list. The only
 * mention of "the deleteAccount callable" anywhere in the engine repo is a
 * single explanatory comment in `admin-web/firestore.rules` describing
 * intended FUTURE behaviour, not code that exists). Deleting an account for
 * real means touching engine state that belongs partly to OTHER players
 * (another challenge participant's escrow, a competition's other members'
 * leaderboard rows) — that is not something this web client can safely do
 * with a client-side Firestore write, even with the Admin SDK from a Next.js
 * API route, because there is no transaction here that also fixes up
 * `playerCount`, resolves in-flight challenges, or decides what happens to a
 * competition this account created that other real people are still playing
 * in. A button that deleted only the Firebase Auth user, or only the
 * top-level `users/{uid}` doc, would look like it worked while leaving all
 * of that stranded — worse than this stub, because it would look finished.
 *
 * So what this page does honestly: explains what deletion covers, what may
 * be retained and why, roughly how long it takes, and gives a clear,
 * low-friction way to make the request (a pre-filled `mailto:` — no backend
 * write of any kind, nothing added to Firestore). See the P1.6 findings
 * report for the full list of collections a real `deleteAccount` callable
 * would need to touch, as input to an engine ticket.
 */
export default function AccountDeletion() {
  const { status, user } = useUser();
  const [manualEmail, setManualEmail] = useState("");

  const knownEmail = status === "signed-in" ? user?.email ?? "" : "";
  const effectiveEmail = knownEmail || manualEmail.trim();
  const mailtoHref = buildDeletionMailto(effectiveEmail, status === "signed-in" ? user?.uid : undefined);

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">Account deletion</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        Delete your ileadit account
      </h1>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
        You can ask us to delete your account and the data attached to it at any time. Here&apos;s
        exactly what that covers, what we may need to keep, and how to start the request.
      </p>

      <Section
        icon={<ShieldCheck className="size-5" aria-hidden="true" />}
        heading="What gets deleted"
      >
        <BulletList
          items={[
            "Your profile: display name, avatar, city",
            "Your personal details: first name, surname, date of birth, gender, country",
            "Your coin and points balance, and your lifetime points total",
            "Your day-by-day step and points history",
            "Your place in any competitions you're currently playing (your row is removed from every leaderboard)",
            "Any active challenges you're part of",
            "Your notification settings and registered devices",
            "Your ileadit sign-in itself, across email, Google and Microsoft",
          ]}
        />
      </Section>

      <Section
        icon={<Users className="size-5" aria-hidden="true" />}
        heading="If you created a competition"
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          If you&apos;re the organiser of a competition other people are actively playing in,
          deleting your account doesn&apos;t get to quietly break it for them. We&apos;ll email you
          first to sort out what happens to it — for example, moving it to a new organiser, or
          waiting until it finishes — before your account is removed.
        </p>
      </Section>

      <Section
        icon={<AlertTriangle className="size-5" aria-hidden="true" />}
        heading="What we may keep, and why"
      >
        <BulletList
          items={[
            "Payment and invoice records from Stripe, if you've ever paid for anything — accounting and tax law generally requires this regardless of account deletion",
            "Competition statistics with your identity removed — the same aggregated, anonymised numbers described in our privacy policy (never your individual step counts)",
            "A minimal fraud/anti-abuse record where we're legally required to keep one for a short period",
          ]}
        />
        <p className="mt-3 rounded-xl border border-dashed border-brand-coral/40 bg-brand-coral/5 p-3 text-xs leading-relaxed text-muted-foreground">
          The exact retention periods above are our best-effort description today and still need
          sign-off from Paul and legal counsel before this copy is final — treat the categories as
          right, the durations as provisional.
        </p>
      </Section>

      <Section icon={<Mail className="size-5" aria-hidden="true" />} heading="How long it takes">
        <p className="text-sm leading-relaxed text-muted-foreground">
          We aim to complete a verified deletion request within 30 days. (Also provisional — not yet
          confirmed as an official SLA.)
        </p>
      </Section>

      <div className="mt-10 rounded-3xl border border-border bg-card p-6 sm:p-7">
        <h2 className="text-lg font-bold text-foreground">Request deletion</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {status === "signed-in" && knownEmail
            ? "This opens an email to us, pre-filled from your signed-in account."
            : "Tell us the email address on your ileadit account, then send the request from that same address so we can verify it's you."}
        </p>

        {status !== "signed-in" ? (
          <label className="mt-4 block">
            <span className="text-sm font-semibold text-foreground">Your account email</span>
            <input
              type="email"
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </label>
        ) : null}

        <a
          href={mailtoHref}
          className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-brand-coral px-6 text-base font-bold text-white transition-colors hover:bg-brand-coral/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-coral"
        >
          <Mail className="size-4" aria-hidden="true" />
          Email us to request deletion
        </a>
        <p className="mt-3 text-xs text-muted-foreground">
          Prefer not to use email? Write to us at{" "}
          <a href="mailto:hello@ileadit.app" className="font-semibold underline">
            hello@ileadit.app
          </a>{" "}
          instead — the button above just saves you typing.
        </p>
      </div>

      {status === "signed-in" ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Changed your mind? Head back to{" "}
          <Link href="/account" className="font-semibold text-foreground underline">
            your account
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

function buildDeletionMailto(email: string, uid: string | undefined | null): string {
  const subject = "Account deletion request";
  const lines = [
    "Please delete my ileadit account and the data attached to it.",
    "",
    `Account email: ${email || "(please fill in)"}`,
  ];
  if (uid) lines.push(`Account ID: ${uid}`);
  lines.push("", "(Sent from ileadit.app/account-deletion)");
  const body = lines.join("\n");
  return `mailto:hello@ileadit.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function Section({
  icon,
  heading,
  children,
}: {
  icon: React.ReactNode;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8 border-t border-border pt-8 first:border-t-0 first:pt-0">
      <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-brand-navy">
          {icon}
        </span>
        {heading}
      </h2>
      <div className="mt-3 pl-10">{children}</div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item}
          className="text-sm leading-relaxed text-muted-foreground before:mr-2 before:content-['\2022']"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
