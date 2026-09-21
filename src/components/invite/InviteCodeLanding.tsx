"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, PlayCircle } from "lucide-react";
import { useUser } from "@/context/AuthContext";
import { LogoMark } from "@/components/brand/Logo";
import { CompetitionStatusChip } from "@/components/status/CompetitionStatusChip";
import { useOwnMembership } from "@/lib/competitionDetail";
import { formatShortDate } from "@/lib/competitionDates";
import {
  previewInvite,
  acceptInvite,
  acceptInviteFailureMessage,
  buildInviteUrl,
  formatInviteCodeForDisplay,
  type InvitePreviewAvailable,
} from "@/lib/invites";
import { InviteQrCode } from "./InviteQrCode";

/**
 * `/invite/[code]` — the NEW 8-character invite-code path (WEB-INV-1).
 * Renders for any `code` that `isEightCharacterInviteCode` (`src/lib/
 * invites.ts`) accepts; the route (`src/app/invite/[code]/page.tsx`) falls
 * back to the existing `InviteLanding.tsx` for legacy 20-character
 * competition-ID links, which this component does not touch or replace.
 *
 * Unlike `InviteLanding.tsx`, `previewInvite` is called UNAUTHENTICATED —
 * before this component even knows whether the visitor is signed in — so
 * the competition name/dates/status/code/QR are visible to a signed-out
 * visitor immediately (per the INV-1 contract), and a `permission-denied`
 * from `useCompetitionDetail`-style reads is not a possible outcome here at
 * all: `previewInvite` deliberately returns a UNIFORM `{available:false}`
 * result (never a distinct error) for every "this code doesn't lead
 * anywhere good" case (revoked, expired, exhausted, unknown code, or a
 * finalising/finished competition) — see `invites.ts`'s own header comment.
 * This page therefore has exactly one "can't show this" state, on purpose.
 *
 * Membership (once signed in) is still checked via the existing
 * `useOwnMembership` hook (`competitionDetail.ts`) against the REAL
 * `competitionId` the preview resolves to — invite codes don't carry their
 * own separate membership concept, they just point at a normal competition.
 */
export function InviteCodeLanding({ code }: { code: string }) {
  const previewState = usePreviewInvite(code);
  const { status: authStatus } = useUser();

  if (previewState.status === "loading") {
    return <InviteSkeleton />;
  }

  if (previewState.status === "unavailable") {
    return <UnavailableInvite />;
  }

  if (authStatus === "loading") {
    return <InviteSkeleton />;
  }

  if (authStatus === "signed-out") {
    return <SignedOutInviteCode code={code} preview={previewState.result} />;
  }

  return <SignedInInviteCode code={code} preview={previewState.result} />;
}

/* ------------------------------------------------------------------ *
 * previewInvite, wrapped as a small local hook — mirrors the discriminated-
 * union discipline every other data-fetching hook in this codebase uses
 * (`useCompetitionDetail`, `useCreatedCompetitions`, …). A `previewInvite`
 * FAILURE (a real thrown error — network, malformed input) is folded into
 * the same `"unavailable"` state a legitimate `{available:false}` RESULT
 * produces, per BUILD item 1's "ONE uniform state" instruction — but only
 * the real-failure branch logs to the console, since the other is an
 * expected, common outcome (an expired/revoked link), not a bug.
 * ------------------------------------------------------------------ */

type PreviewState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "available"; result: InvitePreviewAvailable };

function usePreviewInvite(code: string): PreviewState {
  const [state, setState] = useState<PreviewState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    previewInvite(code)
      .then((outcome) => {
        if (cancelled) return;
        if (outcome.status === "failure") {
          console.error("[InviteCodeLanding] previewInvite failed", outcome.failure);
          setState({ status: "unavailable" });
          return;
        }
        if (!outcome.result.available) {
          setState({ status: "unavailable" });
          return;
        }
        setState({ status: "available", result: outcome.result });
      })
      .catch((error: unknown) => {
        // previewInvite() itself never rejects (it catches internally and
        // resolves to a failure outcome) — kept as a defensive fallback in
        // case that contract is ever violated, rather than an assumption.
        if (cancelled) return;
        console.error("[InviteCodeLanding] previewInvite threw unexpectedly", error);
        setState({ status: "unavailable" });
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  return state;
}

/* ------------------------------------------------------------------ *
 * Shared shell
 * ------------------------------------------------------------------ */

const CTA_CLASSES =
  "flex h-12 w-full max-w-xs items-center justify-center rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold px-6 text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed disabled:border-transparent disabled:bg-cta-disabled disabled:text-cta-disabled-foreground";

function InviteSkeleton() {
  return (
    <div className="mx-auto max-w-lg px-5 py-20 text-center sm:px-6" role="status" aria-live="polite">
      <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-muted" />
      <div className="mx-auto mt-4 h-7 w-56 animate-pulse rounded-full bg-muted" />
      <div className="mx-auto mt-3 h-4 w-72 animate-pulse rounded-full bg-muted" />
      <span className="sr-only">Loading this invite…</span>
    </div>
  );
}

/**
 * BUILD item 1's "ONE uniform 'This invite isn't available' state" —
 * deliberately says nothing more specific than this (no "revoked" vs.
 * "expired" vs. "wrong code" distinction), matching exactly what
 * `previewInvite` itself is willing to reveal to an unauthenticated
 * visitor.
 */
function UnavailableInvite() {
  return (
    <div className="mx-auto max-w-lg px-5 py-20 text-center sm:px-6">
      <AlertCircle className="mx-auto size-8 text-destructive" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-extrabold text-foreground">This invite isn&apos;t available</h1>
      <p className="mt-2 text-base text-muted-foreground">
        This link may have been revoked, expired, run out of uses, or point to a competition
        that&apos;s no longer open to new joins. Double-check it with whoever sent it.
      </p>
      <div className="mt-6 flex justify-center">
        <Link href="/" className={CTA_CLASSES}>
          Back to ileadit
        </Link>
      </div>
    </div>
  );
}

function GenericErrorInvite() {
  return (
    <div className="mx-auto max-w-lg px-5 py-20 text-center sm:px-6">
      <AlertCircle className="mx-auto size-8 text-destructive" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-extrabold text-foreground">We couldn&apos;t load this invite</h1>
      <p className="mt-2 text-base text-muted-foreground">
        Something went wrong talking to ileadit. Try reloading the page.
      </p>
      <div className="mt-6 flex justify-center">
        <Link href="/" className={CTA_CLASSES}>
          Back to ileadit
        </Link>
      </div>
    </div>
  );
}

/**
 * Placeholder pattern deliberately mirrored (not imported) from
 * `src/app/download/page.tsx` — no real Play Store listing exists yet
 * (`PLAY_STORE_URL` is `null` there too). Swap both this and `/download`'s
 * copy in together once a real listing URL exists; don't fix one and leave
 * the other stale.
 */
function GetTheAppBlock() {
  const PLAY_STORE_URL: string | null = null;
  return (
    <div className="mt-8 rounded-3xl border border-dashed border-border bg-muted/40 p-5 text-left">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-coral">Get the app</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Free to download. Available on Android today — walking is the whole game, and nobody but
        you ever sees your step count.
      </p>
      {PLAY_STORE_URL ? (
        <a
          href={PLAY_STORE_URL}
          className="mt-3 inline-flex h-11 items-center gap-2 rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold px-5 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
        >
          <PlayCircle className="size-4" aria-hidden="true" />
          Get it on Google Play
        </a>
      ) : (
        <div
          role="note"
          aria-label="Placeholder — Play Store link not yet available"
          className="mt-3 inline-flex h-11 cursor-not-allowed items-center gap-2 rounded-full border-2 border-dashed border-brand-coral/50 bg-brand-coral/5 px-5 text-sm font-bold text-brand-coral"
        >
          <PlayCircle className="size-4" aria-hidden="true" />
          Get it on Google Play — PLACEHOLDER LINK
        </div>
      )}
    </div>
  );
}

/**
 * The card every "available" state shares: competition name/status/dates/
 * "Day N of X" (while active)/player count, the code shown large, and a QR
 * of the invite URL for a desktop visitor to scan onto their phone — all
 * BUILD item 1 requirements that don't vary by auth/membership state.
 * `children` carries the ONE thing that does vary (the CTA).
 */
function InvitePreviewCard({
  preview,
  code,
  children,
  live,
}: {
  preview: InvitePreviewAvailable;
  code: string;
  children: React.ReactNode;
  live?: boolean;
}) {
  const url = buildInviteUrl(code);
  const displayCode = formatInviteCodeForDisplay(code);

  return (
    <div
      className="mx-auto max-w-lg px-5 py-16 text-center sm:px-6"
      role={live ? "status" : undefined}
      aria-live={live ? "polite" : undefined}
    >
      <LogoMark className="mx-auto h-10 w-10" />
      <div className="mt-4 flex justify-center">
        <CompetitionStatusChip status={preview.status} startDate={preview.startDate} />
      </div>
      <h1 className="mt-4 text-2xl font-extrabold text-foreground">
        {preview.competitionName ?? "You've been invited to play"}
      </h1>
      {preview.description ? (
        <p className="mt-2 text-sm text-muted-foreground">{preview.description}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>
          {formatShortDate(preview.startDate) ?? "TBC"} – {formatShortDate(preview.endDate) ?? "TBC"}
        </span>
        {preview.status === "active" && preview.dayNumber !== null ? (
          <span>
            Day {preview.dayNumber}
            {preview.durationDays ? ` of ${preview.durationDays}` : ""}
          </span>
        ) : null}
        {preview.playerCount !== null ? (
          <span>
            {preview.playerCount} {preview.playerCount === 1 ? "player" : "players"} joined
          </span>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">{children}</div>

      <div className="mt-8 rounded-3xl border border-border bg-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-coral">Invite code</p>
        <p className="mt-1 font-mono text-2xl font-extrabold tracking-[0.2em] text-foreground">
          {displayCode}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          On a computer? Scan this with your phone&apos;s camera to open the invite there instead.
        </p>
        <div className="mt-3 flex justify-center">
          <InviteQrCode value={url} size={160} label={`QR code for invite ${displayCode}`} />
        </div>
      </div>

      <GetTheAppBlock />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * States
 * ------------------------------------------------------------------ */

function SignedOutInviteCode({
  code,
  preview,
}: {
  code: string;
  preview: InvitePreviewAvailable;
}) {
  const redirect = `/invite/${code}`;
  return (
    <InvitePreviewCard preview={preview} code={code}>
      <p className="text-sm text-muted-foreground">
        Sign in (or create a free account) to join — it only takes a minute. Nobody but you ever
        sees your step count.
      </p>
      <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className={CTA_CLASSES}>
        Sign in to join
      </Link>
    </InvitePreviewCard>
  );
}

function SignedInInviteCode({
  code,
  preview,
}: {
  code: string;
  preview: InvitePreviewAvailable;
}) {
  const { user } = useUser();
  if (!user) return null; // Unreachable: caller only renders this once authStatus is "signed-in".
  return <SignedInInviteCodeContent code={code} preview={preview} uid={user.uid} />;
}

function SignedInInviteCodeContent({
  code,
  preview,
  uid,
}: {
  code: string;
  preview: InvitePreviewAvailable;
  uid: string;
}) {
  const membershipState = useOwnMembership(uid, preview.competitionId);

  if (membershipState.status === "checking") {
    return <InviteSkeleton />;
  }

  if (membershipState.status === "error") {
    return <GenericErrorInvite />;
  }

  if (membershipState.status === "member") {
    return (
      <InvitePreviewCard preview={preview} code={code}>
        <p className="text-sm text-muted-foreground">
          You&apos;re already a player in {preview.competitionName ?? "this competition"} — head
          there to check the leaderboard.
        </p>
        <Link href={`/competitions/${preview.competitionId}`} className={CTA_CLASSES}>
          View competition
        </Link>
      </InvitePreviewCard>
    );
  }

  return <JoinInviteCode code={code} preview={preview} />;
}

/**
 * BUILD item 1's join flow. Paul's INV-1 decision: unlike a public-list join
 * (day-one-only, JOIN-1), an invite-joined competition can be joined ANY
 * day while `active` — `acceptInvite` enforces this server-side (capped
 * optionally by the invite's own `expiresAt`), so this component never
 * re-derives a day-one check the way `InviteLanding.tsx`/`CompetitionDetail
 * .tsx` do for the legacy/public path. The "mid-competition join" note
 * ("days before joining count as 0") is shown for every active-status
 * invite join, not just a late one — it's true and worth saying even on the
 * competition's first day, and it's the plainest way to satisfy BUILD item
 * 1's explicit copy requirement without a second, easy-to-get-wrong
 * "is this actually late" check duplicating server logic.
 */
function JoinInviteCode({
  code,
  preview,
}: {
  code: string;
  preview: InvitePreviewAvailable;
}) {
  const [pending, setPending] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dayNumber, setDayNumber] = useState<number | null>(preview.dayNumber);

  const showMidCompetitionNote = preview.status === "active" && preview.dayNumber !== null;

  if (joined) {
    return (
      <InvitePreviewCard preview={preview} code={code} live>
        <p className="text-sm text-muted-foreground">
          Welcome to {preview.competitionName ?? "the competition"} — good luck out there.
        </p>
        {showMidCompetitionNote ? (
          <p className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
            You joined on day {dayNumber} — the days before you joined count as 0, same as
            everyone who joins mid-competition.
          </p>
        ) : null}
        <Link href={`/competitions/${preview.competitionId}`} className={CTA_CLASSES}>
          View competition
        </Link>
      </InvitePreviewCard>
    );
  }

  async function handleJoin() {
    setPending(true);
    setError(null);
    const outcome = await acceptInvite(code);
    setPending(false);
    if (outcome.status === "success") {
      setDayNumber(outcome.result.dayNumber);
      setJoined(true);
    } else {
      setError(acceptInviteFailureMessage(outcome.failure));
    }
  }

  return (
    <InvitePreviewCard preview={preview} code={code}>
      {showMidCompetitionNote ? (
        <p className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
          You&apos;re joining on day {preview.dayNumber} — earlier days count as 0, so your target
          starts fresh from today.
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void handleJoin()}
        disabled={pending}
        className={CTA_CLASSES}
      >
        {pending ? "Joining…" : "Join competition"}
      </button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </InvitePreviewCard>
  );
}
