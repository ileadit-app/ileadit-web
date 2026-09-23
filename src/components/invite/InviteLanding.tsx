"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { useUser } from "@/context/AuthContext";
import { LogoMark } from "@/components/brand/Logo";
import { CompetitionStatusChip } from "@/components/status/CompetitionStatusChip";
import {
  CompetitionVisibilityChip,
  resolveCompetitionVisibility,
  type CompetitionVisibility,
} from "@/components/status/CompetitionVisibilityChip";
import {
  useCompetitionDetail,
  useOwnMembership,
  type CompetitionDetailDoc,
} from "@/lib/competitionDetail";
import { isDayOneOfActiveCompetition } from "@/lib/competitionDates";
import { joinCompetition } from "@/lib/joinCompetition";
import {
  competitionMembershipFailureMessage,
  type CompetitionMembershipFailure,
} from "@/lib/competitionMembershipErrors";

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
 *
 * **PC-6 (2026-09-23): private competitions.** This is the LEGACY invite
 * door — `code` is a raw `competitions/{id}` document ID, reachable by
 * anyone who has it, unlike the newer `invites/{CODE}`-backed
 * `InviteCodeLanding.tsx`. PC-9 added a `visibility` field
 * (`"public" | "private" | null`) to `competitions/{id}` and taught
 * `joinCompetition` to refuse a private competition outright
 * (`permission-denied` / `details.reason: "competition-private"`) unless the
 * caller arrived via a real invite — this legacy door never carries invite
 * provenance, so a private competition must be treated as an invite-only
 * dead end here, reached three ways (all rendered via the shared
 * `InviteOnlyInvite` below, reusing `competitionMembershipErrors.ts`'s own
 * `competition-private` copy rather than inventing a fourth phrasing of the
 * same sentence — see that component's own comment):
 *   (a) proactively, when the doc itself says `visibility === "private"` and
 *       the viewer isn't a member — mirrors `CompetitionDetail.tsx`'s
 *       `isPrivateLocked`;
 *   (b) when the doc can't be read at all (`useCompetitionDetail`'s
 *       `"denied"` state) — under the engine branch that introduces this
 *       field (`engine/pc1-visibility`, NOT deployed as of 2026-09-23),
 *       that rules-side denial is what a non-member hitting a private
 *       competition's legacy link looks like, not a crash or a false
 *       "not found" (see `competitionDetail.ts`'s own comment on this
 *       branch, written in anticipation of exactly this);
 *   (c) defensively, if `joinCompetition` itself still returns
 *       `competition-private` despite (a) not having fired — see
 *       `JoinableInvite` below. Deliberately swaps the WHOLE card away from
 *       the dead Join button (unlike `CompetitionDetail.tsx`'s own
 *       `competition-private` handling, which only adds an inline alert
 *       next to a Join button that's normally unreachable there anyway
 *       because of its own proactive lock) — on this legacy, invite-less
 *       door, a retry can never succeed, so leaving the button up would be
 *       actively misleading.
 * The separate `overlapping-competition` refusal (one active competition at
 * a time) is unrelated to privacy — it stays an inline alert with a
 * "Go to your dashboard" link, same treatment as `CompetitionDetail.tsx` and
 * `InviteCodeLanding.tsx` already give it.
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

  if (competitionState.status === "denied") {
    // PC-6: as of the `engine/pc1-visibility` branch (not deployed),
    // `competitions/{id}` is no longer unconditionally readable by every
    // signed-in user — a `permission-denied` here is what a non-member
    // hitting a PRIVATE competition's legacy invite link looks like (the
    // doc exists, it just isn't visible to this viewer), not a generic bug
    // and not a "this link is broken" not-found. See this file's header
    // comment (case (b)) and `InviteOnlyInvite` below.
    return <InviteOnlyInvite />;
  }

  if (competitionState.status === "error") {
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

  // PC-6 case (a): a private competition refuses everyone who doesn't carry
  // invite provenance, which this legacy door never does — pre-empt the
  // doomed join attempt rather than showing a Join button. Only checked
  // within the window that would otherwise be joinable; outside it,
  // `AlreadyStartedInvite`'s existing copy already covers the refusal
  // without needing private-specific wording (mirrors
  // `CompetitionDetail.tsx`'s `isPrivateLocked`).
  if (stillJoinable && resolveCompetitionVisibility(competition.visibility) === "private") {
    return (
      <InviteOnlyInvite
        status={competition.status}
        startDate={competition.startDate}
        timeZone={competition.timeZone}
      />
    );
  }

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
  visibility,
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
  /** PC-6 — only passed by `InviteOnlyInvite`, the one state on this page
   * where visibility is actually the point. Every other call site omits
   * this; per-state visibility surfacing for the non-private states
   * (Join/already-member/already-started) is out of scope for this ticket
   * — see `InviteOnlyInvite`'s own comment. */
  visibility?: CompetitionVisibility;
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
      {status !== undefined || visibility !== undefined ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {status !== undefined ? (
            <CompetitionStatusChip status={status} startDate={startDate} timeZone={timeZone} />
          ) : null}
          {visibility !== undefined ? <CompetitionVisibilityChip visibility={visibility} /> : null}
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
  "flex h-12 w-full max-w-xs items-center justify-center rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold px-6 text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed disabled:border-transparent disabled:bg-cta-disabled disabled:text-cta-disabled-foreground";

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

/**
 * PC-6 — the shared "this legacy link leads to a private competition, and
 * this door has no invite provenance to offer" dead end. Reached three ways
 * (see this file's header comment): (a) proactively, competition known and
 * private; (b) the doc read came back `permission-denied`, so nothing about
 * the competition is actually known; (c) `joinCompetition` itself returned
 * `competition-private`, from inside `JoinableInvite`.
 *
 * `status`/`startDate`/`timeZone` are only ever passed for (a) and (c) —
 * case (b) renders with none of them (no status chip; the "Private" chip
 * still renders, since that IS the one thing a permission-denied read on
 * this document tells us). `live` is only passed by (c), the one path
 * reached by a user action (clicking Join) on this same page with no
 * route change to otherwise announce the new heading to a screen reader —
 * same discipline as the join-success card above.
 *
 * Body copy is the exact string `competitionMembershipFailureMessage`
 * already renders for a live `competition-private` join refusal
 * (`competitionMembershipErrors.ts`) — reused via a synthetic failure value
 * rather than hand-written again, so this sentence exists in exactly one
 * place. Deliberately NOT the same wording as `CompetitionDetail.tsx`'s own
 * `isPrivateLocked` explainer ("This is a private competition — you'll need
 * an invite link to join. Ask whoever's running it to send you one.") —
 * that duplication already existed before this ticket (two hand-written
 * phrasings of the same idea); this file reuses the OTHER existing one
 * rather than inventing a third.
 */
function InviteOnlyInvite({
  status,
  startDate,
  timeZone,
  live,
}: {
  status?: CompetitionDetailDoc["status"];
  startDate?: string | null;
  timeZone?: string | null;
  live?: boolean;
} = {}) {
  const body = competitionMembershipFailureMessage(
    { reason: "competition-private", code: null, message: "", cause: null },
    "join",
  );
  return (
    <InviteStatusCard
      live={live}
      status={status}
      startDate={startDate ?? null}
      timeZone={timeZone ?? null}
      visibility="private"
      title="This competition is invite-only"
      body={body}
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
  // PC-6: keeps the raw failure (not just its rendered message), same
  // reason `CompetitionDetail.tsx`'s `actionFailure` does — the
  // `overlapping-competition` case needs to add a dashboard link, and
  // `competition-private` needs to swap the whole card, neither of which is
  // possible from a plain string.
  const [failure, setFailure] = useState<CompetitionMembershipFailure | null>(null);

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
    setFailure(null);
    const outcome = await joinCompetition(competitionId);
    setPending(false);
    if (outcome.status === "success") {
      setJoined(true);
    } else {
      setFailure(outcome.failure);
    }
  }

  // PC-6 case (c): a live `competition-private` refusal means the proactive
  // lock in `SignedInInviteContent` either didn't fire (this doc's own
  // `visibility` genuinely wasn't `"private"` on the last read, but the
  // engine's own check disagrees) or raced ahead of a doc update. Either
  // way there is no retry that can succeed — swap the whole card to the
  // same invite-only dead end used for the proactive lock, rather than
  // leaving a dead "Join" button on screen with an inline error under it.
  if (failure?.reason === "competition-private") {
    return (
      <InviteOnlyInvite
        live
        status={competition.status}
        startDate={competition.startDate}
        timeZone={competition.timeZone}
      />
    );
  }

  // PC-9's "one active competition at a time" refusal is unrelated to
  // privacy — same inline-alert-plus-dashboard-link treatment
  // `CompetitionDetail.tsx` and `InviteCodeLanding.tsx` already give it.
  const isOverlapFailure = failure?.reason === "overlapping-competition";

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
      {failure ? (
        <>
          <p className="text-sm text-destructive" role="alert">
            {competitionMembershipFailureMessage(failure, "join")}
          </p>
          {isOverlapFailure ? (
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-brand-navy underline-offset-2 hover:underline"
            >
              Go to your dashboard
            </Link>
          ) : null}
        </>
      ) : null}
    </InviteStatusCard>
  );
}
