"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Ban, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { useUser } from "@/context/AuthContext";
import { Rich, RichList, RichP } from "@/components/legal/RichText";

/**
 * WEB-LEGAL-1. The approved `/account-deletion` copy, published word-for-
 * word from `.ticket-refs/account-deletion-APPROVED-20261026.md` (Paul, 26
 * Oct 2026) — do not reword, shorten, or "improve" any sentence here
 * without going back to Paul for a new approval.
 *
 * Split out of `src/app/account-deletion/page.tsx` so that file can be a
 * plain server component exporting `metadata` (this view uses `useState`/
 * `useUser`, so it has to stay a client component — see `login/page.tsx`
 * and `reset-password/page.tsx` for the same server-page/client-view split
 * used elsewhere in this repo).
 *
 * This is still a REQUEST route, not a delete button — see the previous,
 * longer version of this file's header comment (now on this component, in
 * git history / the P1.6 findings report) for why there is no
 * `deleteAccount` Cloud Functions callable to wire a real button to yet.
 * Nothing here writes to Firestore or calls any backend; the only action is
 * building a `mailto:` link.
 *
 * The approved copy drops the old Microsoft-sign-in hedge entirely (it now
 * reads a flat "email and password, or Google", regardless of whether
 * Microsoft sign-in is enabled) — this is an intentional, Paul-approved
 * simplification, not an oversight; don't reintroduce the
 * `isMicrosoftSignInEnabled()` branch on this bullet without a new approval
 * to go with it.
 */
export function AccountDeletionView() {
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
        You can delete your ileadit account and the data attached to it at any time.
      </p>

      <Section icon={<Smartphone className="size-5" aria-hidden="true" />} heading="The quickest way: in the app">
        <RichP
          keyPrefix="in-app"
          text="Open ileadit, go to **Settings → Delete account** and confirm. Your account is deleted straight away."
          className="text-sm leading-relaxed text-muted-foreground"
        />
      </Section>

      <Section icon={<Mail className="size-5" aria-hidden="true" />} heading="Without the app">
        <RichP
          keyPrefix="without-app"
          text="Use the form below, or email **hello@ileadit.co.uk** from the email address on your ileadit account and ask us to delete it. We'll check the request came from you and delete the account within one month."
          className="text-sm leading-relaxed text-muted-foreground"
        />
      </Section>

      <Section icon={<ShieldCheck className="size-5" aria-hidden="true" />} heading="What gets deleted">
        <RichList
          keyPrefix="gets-deleted"
          className="space-y-2"
          items={[
            "Your profile: display name, avatar, profile photo, and town or city",
            "Your first name and surname",
            "Your coins and points",
            "Your daily step and points history",
            "Your notifications, notification settings and registered devices",
            "Your place in your competitions",
            "Any challenge you're part of: it's cancelled, and any coins held for it go back to the other player",
            "Your ileadit sign-in (email and password, or Google)",
          ]}
        />
      </Section>

      <Section icon={<AlertTriangle className="size-5" aria-hidden="true" />} heading="What we keep, and why">
        <RichList
          keyPrefix="what-we-keep"
          className="space-y-2"
          items={[
            `**Finished competitions:** your place in the final results stays, so other players' rankings don't change, but your name and picture are removed and you appear as "A former player". Our internal record of each competition's final scores keeps your old account ID, with no name, email or steps.`,
            `**Challenge records:** your account ID is replaced with "deleted-user".`,
            `**Other players' messages:** notifications other players already received, such as "Sam T challenged you", keep your display name until they delete them.`,
            "**Welcome bonus record:** a scrambled, one-way version of your email address, the date and your old account ID, so the same email can't claim the welcome coins twice. It can't be turned back into your email address.",
            "**Competitions you organised** carry on for the players in them.",
          ]}
        />
        <p className="mt-3 text-sm font-semibold leading-relaxed text-foreground">
          Never kept: your step counts. They are deleted with your account.
        </p>
      </Section>

      <Section icon={<Ban className="size-5" aria-hidden="true" />} heading="What can't be undone">
        <RichP
          keyPrefix="cant-be-undone"
          text="Once your account is deleted, your game progress, coins and competition history can't be recovered."
          className="text-sm leading-relaxed text-muted-foreground"
        />
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
          You can also write to us at Kranthews Ltd, 1 Westbrook Avenue, Hampton, England, TW12 2RE.
        </p>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        See our <Rich text="[privacy policy](/privacy)" keyPrefix="footer-privacy-link" /> for more about how we
        handle your data.
      </p>

      {status === "signed-in" ? (
        <p className="mt-4 text-sm text-muted-foreground">
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
  lines.push("", "(Sent from the ileadit account-deletion page)");
  const body = lines.join("\n");
  return `mailto:hello@ileadit.co.uk?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
