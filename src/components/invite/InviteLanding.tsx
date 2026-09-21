"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { useUser } from "@/context/AuthContext";
import { LogoMark } from "@/components/brand/Logo";
import { CompetitionStatusChip } from "@/components/status/CompetitionStatusChip";
import {
  useCompetitionDetail,
  useOwnMembership,
  type CompetitionDetailDoc,
} from "@/lib/competitionDetail";
import { isDayOneOfActiveCompetition } from "@/lib/competitionDates";
import { joinCompetition } from "@/lib/joinCompetition";
import { competitionMembershipFailureMessage } from "@/lib/competitionMembershipErrors";

/**
 * `/invite/[code]` (W6-INVITE) — the page someone lands on from a
 * colleague's link, on a phone, knowing nothing about ileadit.
 *
 * `competitionId` here IS the route's `code` param. There is no separate
 * `invites` collection, `inviteCode` field, or `resolveInvite`/`acceptInvite`
 * callable anywhere in the engine — the full design for that richer model
 * exists only as an unbuilt, unapproved analysis doc
 * (`automation-hub/docs/ileadit-invite-system-20260920.md`, pending Paul's
 * Q1-Q12 answers). The only things that are real today are `competitions/{id}`
 * and the `joinCompetition` callable, so an invite link today is literally
 * `ileadit.app/invite/<competitionId>`. Do not build against the richer
 * model until an engine ticket ships it.
 *
 * Two facts this component is built against, both re-confirmed against the
 * running code (not just the design doc) for this ticket:
 *
 * 1. **Late join is possible, but only on a competition's first active day
 *    (WEB-3 item 3, re-verified against engine ticket JOIN-1, commit
 *    `7629e40`).** `joinCompetitionService` now accepts a join when
 *    `status === "scheduled"` OR (`status === "active"` AND the
 *    competition's own calendar today, per its `timeZone`, equals its
 *    `startDate`) — see `isDayOneOfActiveCompetition` in
 *    `competitionDates.ts`, which mirrors the engine's own check exactly.
 *    Any later active day, `finalising`, or `finished` still refuses
 *    unconditionally — the "already started" state below only renders once
 *    that day-one window has passed, and still has a single CTA elsewhere,
 *    no "join anyway".
 * 2. **No capacity limit.** Nothing in `joinCompetition.ts`, `competitions.ts`
 *    (`useCreatedCompetitions`/`CompetitionDetailDoc`), or `CLAUDE.md`'s
 *    schema doc mentions a player cap — `playerCount` only ever goes up,
 *    there is no `maxPlayers` field anywhere real, and no failure reason in
 *    `competitionMembershipErrors.ts` corresponds to "full". There is
 *    deliberately no "competition full" state in this file: it would be
 *    designing for an error the engine cannot produce.
 */
export function InviteLanding({ competitionId }: { competitionId: string }) {
  const { status: authStatus } = useUser();

  if (authStatus === "loading") {
    return <InviteSkeleton />;
  }

  if (authStatus === "signed-out") {
    return <SignedOutInvite competitionId={competitionId} />;
  }

  return <SignedInInvite competitionId={competitionId} />;
}

function SignedInInvite({ competitionId }: { competitionId: string }) {
  const { user } = useUser();
  if (!user) return null; // Unreachable: authStatus is "signed-in" here.
  return <SignedInInviteContent competitionId={competitionId} uid={user.uid} />;
}

function SignedInInviteContent({
  competitionId,
  uid,
}: {
  competitionId: string;
  uid: string;
}) {
  const competitionState = useCompetitionDetail(competitionId);
  const membershipState = useOwnMembership(uid, competitionId);

  if (competitionState.status === "loading") {
    return <InviteSkeleton />;
  }

  if (competitionState.status === "not-found") {
    return <NotFoundInvite />;
  }

  if (competitionState.status === "denied" || competitionState.status === "error") {
    // `competitions/{id}`'s read rule (`admin-web/firestore.rules:232`) is
    // an unconditional `allow read: if signedIn();` — no per-document
    // condition — so "denied" cannot actually happen for a signed-in
    // reader today. Kept as a safe, generic fallback (matching
    // `CompetitionDetail.tsx`'s same defensive branch) rather than an
    // assumption that today's rule is permanent.
    return <GenericErrorInvite />;
  }

  const { competition } = competitionState;

  // `status` is populated asynchronously by an engine trigger shortly
  // after a competition is created (see `CreatedCompetitionSummary`'s own
  // comment in `src/lib/competitions.ts`) — a freshly created doc can
  // transiently have none of it yet. Treat that the same as still loading
  // rather than guessing a state.
  if (!competition.status) {
    return <InviteSkeleton />;
  }

  if (membershipState.status === "checking") {
    return <InviteSkeleton />;
  }

  if (membershipState.status === "error") {
    return <GenericErrorInvite />;
  }

  if (membershipState.status === "member") {
    return (
      <AlreadyMemberInvite
        competitionId={competitionId}
        name={competition.name}
        status={competition.status}
        startDate={competition.startDate}
        timeZone={competition.timeZone}
      />
    );
  }

  // WEB-3 item 3 / JOIN-1: joinable while scheduled, OR active on its own
  // first calendar day — see this file's header comment.
  const stillJoinable =
    competition.status === "scheduled" ||
    (competition.status === "active" &&
      isDayOneOfActiveCompetition(competition.startDate, competition.timeZone));

  if (!stillJoinable) {
    return (
      <AlreadyStartedInvite
        status={competition.status}
        name={competition.name}
        startDate={competition.startDate}
        timeZone={competition.timeZone}
      />
    );
  }

  return <JoinableInvite competitionId={competitionId} competition={competition} />;
}

/* ------------------------------------------------------------------ *
 * Shared shell
 * ------------------------------------------------------------------ */

function InviteStatusCard({
  title,
  body,
  children,
  isError,
  live,
  status,
  startDate,
  timeZone,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
  isError?: boolean;
  /** Announce this card's content to screen readers on mount — for a state
   * reached by a user ACTION on this same page (e.g. "You're in!" right
   * after clicking Join), where nothing else (a route change, a focus
   * move) would otherwise tell an AT user the click did anything. Every
   * other `InviteStatusCard` use is reached by a page LOAD/render, where
   * AT already announces the new page/heading naturally — don't add this
   * to those. */
  live?: boolean;
  /** Only passed by call sites that actually know the competition's status
   * (`JoinableInvite`, `AlreadyStartedInvite`, `AlreadyMemberInvite`) — the
   * spec (`ileadit-state-chip-spec-20260920.md`) names this page as one of
   * the places `CompetitionStatusChip` belongs, alongside the detail hero
   * and the dashboard cards. Omitted for states that have no competition to
   * describe yet (signed-out, not-found, generic error). */
  status?: CompetitionDetailDoc["status"];
  /** WEB-3 item 3 — passed through to `CompetitionStatusChip` alongside
   * `status` so the "Starting today" copy override can fire here too.
   * Omitted wherever `status` is omitted. */
  startDate?: string | null;
  timeZone?: string | null;
}) {
  return (
    <div
      className="mx-auto max-w-lg px-5 py-20 text-center sm:px-6"
      role={live ? "status" : undefined}
      aria-live={live ? "polite" : undefined}
    >
      {isError ? (
        <AlertCircle className="mx-auto size-8 text-destructive" aria-hidden="true" />
      ) : (
        <LogoMark className="mx-auto h-10 w-10" />
      )}
      {status !== undefined ? (
        <div className="mt-4 flex justify-center">
          <CompetitionStatusChip status={status} startDate={startDate} timeZone={timeZone} />
        </div>
      ) : null}
      <h1 className="mt-4 text-2xl font-extrabold text-foreground">{title}</h1>
      <p className="mt-2 text-base text-muted-foreground">{body}</p>
      {children ? <div className="mt-6 flex flex-col items-center gap-2">{children}</div> : null}
    </div>
  );
}

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

const CTA_CLASSES =
  "flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-brand-gold px-6 text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";

/* ------------------------------------------------------------------ *
 * States
 * ------------------------------------------------------------------ */

function SignedOutInvite({ competitionId }: { competitionId: string }) {
  const redirect = `/invite/${competitionId}`;
  return (
    <InviteStatusCard
      title="You've been invited to play ileadit"
      body="Sign in (or create a free account) to see this competition and join in — it only takes a minute. Nobody but you ever sees your step count."
    >
      <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className={CTA_CLASSES}>
        Sign in to see this invite
      </Link>
    </InviteStatusCard>
  );
}

function NotFoundInvite() {
  return (
    <InviteStatusCard
      title="This invite link isn't valid"
      body="The competition it points to doesn't exist any more, or the link isn't quite right. Double-check it with whoever sent it."
    >
      <Link href="/" className={CTA_CLASSES}>
        Back to ileadit
      </Link>
    </InviteStatusCard>
  );
}

function GenericErrorInvite() {
  return (
    <InviteStatusCard
      isError
      title="We couldn't load this invite"
      body="Something went wrong talking to ileadit. Try reloading the page."
    >
      <Link href="/" className={CTA_CLASSES}>
        Back to ileadit
      </Link>
    </InviteStatusCard>
  );
}

function AlreadyMemberInvite({
  competitionId,
  name,
  status,
  startDate,
  timeZone,
}: {
  competitionId: string;
  name: string | null;
  status: CompetitionDetailDoc["status"];
  startDate: string | null;
  timeZone: string | null;
}) {
  return (
    <InviteStatusCard
      status={status}
      startDate={startDate}
      timeZone={timeZone}
      title="You're already in"
      body={`You're already a player in ${name ?? "this competition"} — head there to check the leaderboard.`}
    >
      <Link href={`/competitions/${competitionId}`} className={CTA_CLASSES}>
        View competition
      </Link>
    </InviteStatusCard>
  );
}

/**
 * The hard stop. There is no "join anyway" path from here — by the time
 * `SignedInInviteContent` renders this, it has already confirmed (via
 * `isDayOneOfActiveCompetition`) that this competition is past the one
 * window `joinCompetitionService` still accepts a join in (WEB-3 item 3 /
 * JOIN-1 — see this file's header comment). Only one CTA, and it points
 * away from this competition, never back into it — a retry here can never
 * succeed.
 */
function AlreadyStartedInvite({
  status,
  name,
  startDate,
  timeZone,
}: {
  // Not narrowed to `Exclude<..., "scheduled">` any more: the caller's own
  // gating condition (`stillJoinable`, WEB-3 item 3) is a plain boolean, not
  // a type guard, so TS can't prove `status` excludes "scheduled" here even
  // though it never actually is one in practice — see the call site.
  status: Exclude<CompetitionDetailDoc["status"], null>;
  name: string | null;
  startDate: string | null;
  timeZone: string | null;
}) {
  const isFinished = status === "finished";
  const competitionName = name ?? "This competition";
  return (
    <InviteStatusCard
      status={status}
      startDate={startDate}
      timeZone={timeZone}
      title={isFinished ? "This one's already finished" : "This one's already under way"}
      body={
        isFinished
          ? `${competitionName} has already finished — new joins close after a competition's first day, so everyone's target stays fair.`
          : `${competitionName} has already started, and its first day has passed — new joins close after that, so everyone's target stays fair.`
      }
    >
      <Link href="/dashboard" className={CTA_CLASSES}>
        Find one you can join
      </Link>
    </InviteStatusCard>
  );
}

function JoinableInvite({
  competitionId,
  competition,
}: {
  competitionId: string;
  competition: CompetitionDetailDoc;
}) {
  const [pending, setPending] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (joined) {
    return (
      <InviteStatusCard
        live
        status={competition.status}
        startDate={competition.startDate}
        timeZone={competition.timeZone}
        title="You're in!"
        body={`Welcome to ${competition.name ?? "the competition"} — good luck out there.`}
      >
        <Link href={`/competitions/${competitionId}`} className={CTA_CLASSES}>
          View competition
        </Link>
      </InviteStatusCard>
    );
  }

  async function handleJoin() {
    setPending(true);
    setError(null);
    const outcome = await joinCompetition(competitionId);
    setPending(false);
    if (outcome.status === "success") {
      setJoined(true);
    } else {
      setError(competitionMembershipFailureMessage(outcome.failure, "join"));
    }
  }

  return (
    <InviteStatusCard
      status={competition.status}
      startDate={competition.startDate}
      timeZone={competition.timeZone}
      title="You've been invited to play"
      body={`Join ${competition.name ?? "this competition"} and compete on points — never on step counts.`}
    >
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
    </InviteStatusCard>
  );
}
