"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Calendar, Coins, Heart, Percent } from "lucide-react";
import { useUser } from "@/context/AuthContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CompetitionHero } from "./CompetitionHero";
import { PlayerAvatar } from "./PlayerAvatar";
import {
  useCompetitionDetail,
  useOwnMembership,
  useCompetitionPlayers,
  type CompetitionStatus,
} from "@/lib/competitionDetail";
import { joinCompetition } from "@/lib/joinCompetition";
import { leaveCompetition } from "@/lib/leaveCompetition";
import { competitionMembershipFailureMessage } from "@/lib/competitionMembershipErrors";
import { formatShortDate, isDayOneOfActiveCompetition } from "@/lib/competitionDates";
import { CompetitionLeaderboard } from "./CompetitionLeaderboard";
import { TodayCard } from "./TodayCard";
import { useIsCompetitionOrganiser } from "@/lib/useIsCompetitionOrganiser";
import { InvitePanel } from "./InvitePanel";

/**
 * `/competitions/[id]` — detail + leaderboard (P2.1). ONE route serves both
 * a non-member (join-decision lower half) and a member (leaderboard lower
 * half), because the rules leave no other option:
 * `admin-web/firestore.rules:262-265` gates read of the WHOLE `players`
 * subcollection on `exists()` of the reader's own player doc in that same
 * competition — a non-member cannot read a roster preview, cannot read
 * anyone's points, cannot read anything below the top-level competition
 * document. `useOwnMembership` (`src/lib/competitionDetail.ts`) turns that
 * same rule into this page's own branch: a `permission-denied` reading your
 * own player doc IS "you are not a member," not an error.
 *
 * Mounted under `<ProtectedRoute>` (`src/app/competitions/[id]/page.tsx`),
 * matching CLAUDE.md's page table — so by the time this renders, sign-in is
 * already guaranteed.
 */
export function CompetitionDetail({ competitionId }: { competitionId: string }) {
  const { user } = useUser();
  if (!user) return null; // Unreachable under ProtectedRoute — narrows the type below.
  return <CompetitionDetailContent competitionId={competitionId} uid={user.uid} />;
}

function CompetitionDetailContent({ competitionId, uid }: { competitionId: string; uid: string }) {
  const competitionState = useCompetitionDetail(competitionId);
  const membershipState = useOwnMembership(uid, competitionId);
  const isMember = membershipState.status === "member";
  const leaderboardState = useCompetitionPlayers(competitionId, isMember);
  // WEB-INV-1: gates the organiser-only "Invite people" panel further below.
  // Must be called unconditionally, before any early return, per
  // react-hooks/rules-of-hooks — `competitionState.status` can be
  // "loading"/"not-found"/"denied"/"error" at this point, so the creatorId
  // is computed defensively rather than destructured. Pure, per-render (not
  // effect-based) — `competition.creatorId` can transition from `null` to a
  // real value across this component's lifetime (the engine writes it
  // asynchronously after `create`), and this must reflect that the moment
  // it changes, not lag a render behind. See `useIsCompetitionOrganiser.ts`
  // for the admin-claim half of this check.
  const organiserCapability = useIsCompetitionOrganiser(
    competitionState.status === "success" ? competitionState.competition.creatorId : null,
    uid,
  );

  if (competitionState.status === "loading") {
    return <PageSkeleton />;
  }

  if (competitionState.status === "not-found") {
    return (
      <StatusPage
        title="Competition not found"
        body="This competition doesn't exist, or the link isn't quite right."
      />
    );
  }

  if (competitionState.status === "denied") {
    return (
      <StatusPage
        title="You don't have access to this competition"
        body="This one looks like it's invite-only. If you think that's wrong, email hello@ileadit.app."
      />
    );
  }

  if (competitionState.status === "error") {
    return (
      <StatusPage
        title="We couldn't load this competition"
        body="Something went wrong talking to ileadit. Try reloading the page."
        isError
      />
    );
  }

  const { competition } = competitionState;
  const status = competition.status;

  return (
    <div className="pb-28 sm:pb-16">
      <CompetitionHero competition={competition} />

      <div className="mx-auto max-w-5xl px-5 sm:px-6">
        {/* WEB-3 item 6: previously the ONLY "back to dashboard" link on
            this page lived in StatusPage (the not-found/denied/error
            branches) — the happy path had no way back except the browser's
            own back button. */}
        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to dashboard
        </Link>

        {/* The Today Card (W7-TODAY) only makes sense while there's a
            "today" to report on — during scheduled, nothing has started
            yet; once finished, there's a final result, not a today. */}
        {isMember &&
        membershipState.status === "member" &&
        (status === "active" || status === "finalising") ? (
          <TodayCard uid={uid} player={membershipState.player} />
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <WhosInCard
            playerCount={competition.playerCount}
            isMember={isMember}
            leaderboardState={leaderboardState}
          />
          <DatesCard
            startDate={competition.startDate}
            endDate={competition.endDate}
            durationDays={competition.durationDays}
          />
        </div>

        <HowItWorksCard />

        {status ? (
          <MembershipCta
            competitionId={competitionId}
            competitionName={competition.name}
            status={status}
            startDate={competition.startDate}
            timeZone={competition.timeZone}
            membershipState={membershipState}
          />
        ) : null}

        {status && isMember && membershipState.status === "member" ? (
          <CompetitionLeaderboard
            status={status}
            uid={uid}
            ownPlayer={membershipState.player}
            leaderboardState={leaderboardState}
            winnerIds={competition.winnerIds}
          />
        ) : null}

        {/* WEB-INV-1 BUILD item 2: organiser-only ("as the page decides
            today" — creator or admin claim, see `useIsCompetitionOrganiser`).
            Deliberately rendered regardless of the organiser's own
            membership/leaderboard state above — an organiser managing
            invites may not be a player in their own competition at all. */}
        {organiserCapability === "organiser" ? (
          <div className="mt-4">
            <InvitePanel competitionId={competitionId} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Page-level loading / not-found / denied / error — distinct copy for
 * each, never collapsed into one generic message.
 * ------------------------------------------------------------------ */

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6" role="status" aria-live="polite">
      <div className="h-[200px] animate-pulse rounded-3xl bg-muted sm:h-[280px]" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="h-32 animate-pulse rounded-3xl bg-muted" />
        <div className="h-32 animate-pulse rounded-3xl bg-muted" />
      </div>
      <span className="sr-only">Loading this competition…</span>
    </div>
  );
}

function StatusPage({ title, body, isError }: { title: string; body: string; isError?: boolean }) {
  return (
    <div className="mx-auto max-w-lg px-5 py-20 text-center sm:px-6">
      {isError ? (
        <AlertCircle className="mx-auto size-8 text-destructive" aria-hidden="true" />
      ) : null}
      <h1 className="mt-3 text-2xl font-extrabold text-foreground">{title}</h1>
      <p className="mt-2 text-base text-muted-foreground">{body}</p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold px-6 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
      >
        Back to your dashboard
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Body cards
 * ------------------------------------------------------------------ */

function WhosInCard({
  playerCount,
  isMember,
  leaderboardState,
}: {
  playerCount: number | null;
  isMember: boolean;
  leaderboardState: ReturnType<typeof useCompetitionPlayers>;
}) {
  const previewPlayers =
    leaderboardState.status === "success" ? leaderboardState.players.slice(0, 5) : [];
  const morePlayers =
    leaderboardState.status === "success"
      ? Math.max(0, leaderboardState.players.length - previewPlayers.length)
      : 0;

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">Who&apos;s in it</p>
      <p className="mt-2 text-4xl font-extrabold text-foreground">{playerCount ?? "—"}</p>
      <p className="text-sm text-muted-foreground">
        {playerCount === 1 ? "player has joined" : "players have joined"}
      </p>

      {isMember && previewPlayers.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex -space-x-2">
            {previewPlayers.map((p) => (
              <PlayerAvatar
                key={p.id}
                displayName={p.displayName}
                avatarIndex={p.avatarIndex}
                size={32}
                className="ring-2 ring-card"
              />
            ))}
          </div>
          {morePlayers > 0 ? (
            <span className="text-sm font-semibold text-muted-foreground">+{morePlayers} more</span>
          ) : null}
          <a
            href="#leaderboard"
            className="text-sm font-semibold text-brand-navy underline-offset-2 hover:underline"
          >
            See full leaderboard ↓
          </a>
        </div>
      ) : null}
    </div>
  );
}

function DatesCard({
  startDate,
  endDate,
  durationDays,
}: {
  startDate: string | null;
  endDate: string | null;
  durationDays: number | null;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">Dates</p>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {formatShortDate(startDate) ?? "TBC"} – {formatShortDate(endDate) ?? "TBC"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="size-4 shrink-0 opacity-0" aria-hidden="true" />
          <span>{durationDays ? `${durationDays} ${durationDays === 1 ? "day" : "days"}` : "Duration TBC"}</span>
        </div>
      </div>
    </div>
  );
}

function HowItWorksCard() {
  const rows = [
    { icon: <Percent className="size-4" aria-hidden="true" />, text: "Beat your own rolling average, not anyone else's step count" },
    { icon: <Heart className="size-4" aria-hidden="true" />, text: "Miss half your average and you lose a life" },
    { icon: <Coins className="size-4" aria-hidden="true" />, text: "Survive and your points convert to coins" },
  ];
  return (
    <div className="mt-4 rounded-3xl border border-border bg-card p-6">
      <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">How this works</p>
      <ul className="mt-3 space-y-3" role="list">
        {rows.map((row) => (
          <li key={row.text} className="flex items-start gap-3 text-sm text-muted-foreground">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-brand-navy">
              {row.icon}
            </span>
            <span>{row.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The CTA state machine (design doc §4's table). Every cell verified
 * against the engine's status gate — updated for WEB-3 item 3 / engine
 * ticket JOIN-1 (commit `7629e40`), then again for WEB-4 item 3 / engine
 * ticket LEAVE-1 (Paul's decision, 2026-09-21, IN PROGRESS — not yet
 * merged; see `leaveCompetition.ts`'s header comment for the full caveat):
 *   - `joinCompetitionService` accepts a join when `status === "scheduled"`
 *     OR (`status === "active"` AND the competition's own calendar today,
 *     per its `timeZone`, equals its `startDate` — i.e. only on the
 *     competition's first active day). See `isDayOneOfActiveCompetition` in
 *     `competitionDates.ts`, which mirrors this check exactly.
 *   - `leaveCompetitionService` will accept a leave whenever `status ===
 *     "scheduled"` OR `status === "active"` (never `finalising`/`finished`)
 *     once LEAVE-1 ships. A SCHEDULED leave stays free and immediately
 *     re-joinable — unchanged, still confirmed with a plain
 *     `window.confirm`. An ACTIVE leave forfeits the player's points in
 *     this competition AND blocks re-joining it afterwards, so it is
 *     confirmed with the styled, destructive `ConfirmDialog` instead (a
 *     browser-native `window.confirm` cannot carry the required coral
 *     colour). Both `scheduled` and `active` members therefore see a
 *     "Leave competition" option below their primary CTA; `finalising` and
 *     `finished` members never do.
 * ------------------------------------------------------------------ */

function MembershipCta({
  competitionId,
  competitionName,
  status,
  startDate,
  timeZone,
  membershipState,
}: {
  competitionId: string;
  competitionName: string | null;
  status: CompetitionStatus;
  startDate: string | null;
  timeZone: string | null;
  membershipState: ReturnType<typeof useOwnMembership>;
}) {
  const [pending, setPending] = useState<"join" | "leave" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // WEB-4 item 3: gates the styled destructive confirmation for leaving an
  // ACTIVE competition. Leaving a SCHEDULED one keeps the plain
  // `window.confirm` below — nothing is lost by leaving a competition that
  // hasn't started, so it doesn't need the same weight.
  const [confirmingActiveLeave, setConfirmingActiveLeave] = useState(false);
  // Optimistic override so a successful join/leave reflects instantly
  // rather than waiting on the next `onSnapshot` tick (design doc §4: "on
  // success, becomes the Member cell instantly"). Cleared implicitly the
  // next time the user takes an action in the other direction — the real
  // listener catches up within one round trip in practice.
  const [optimisticMember, setOptimisticMember] = useState<boolean | null>(null);

  if (membershipState.status === "checking") {
    return <div className="mt-6 h-14 animate-pulse rounded-full bg-muted" aria-hidden="true" />;
  }

  if (membershipState.status === "error") {
    return (
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
        <p className="text-sm text-destructive/90">
          We couldn&apos;t check whether you&apos;re in this competition. Reload to try again.
        </p>
      </div>
    );
  }

  const isMember = optimisticMember ?? membershipState.status === "member";

  async function handleJoin() {
    setPending("join");
    setActionError(null);
    const outcome = await joinCompetition(competitionId);
    setPending(null);
    if (outcome.status === "success") {
      setOptimisticMember(true);
    } else {
      setActionError(competitionMembershipFailureMessage(outcome.failure, "join"));
    }
  }

  // Does the actual callable call + state update — shared by both
  // confirmation paths below (plain `window.confirm` for a scheduled leave,
  // the styled `ConfirmDialog` for an active one).
  async function performLeave() {
    setPending("leave");
    setActionError(null);
    const outcome = await leaveCompetition(competitionId);
    setPending(null);
    if (outcome.status === "success") {
      setOptimisticMember(false);
    } else {
      setActionError(competitionMembershipFailureMessage(outcome.failure, "leave"));
    }
  }

  // WEB-4 item 3: a SCHEDULED leave is free and instantly re-joinable, so it
  // keeps the plain browser `window.confirm`. An ACTIVE leave forfeits the
  // player's points in this competition and blocks re-joining it (LEAVE-1)
  // — that needs the styled, destructive `ConfirmDialog` instead, which a
  // native `window.confirm` cannot carry (no way to colour its buttons).
  function handleLeaveClick() {
    if (status === "active") {
      setConfirmingActiveLeave(true);
      return;
    }
    if (!window.confirm("Leave this competition? You can rejoin any time before it starts.")) {
      return;
    }
    void performLeave();
  }

  async function handleConfirmActiveLeave() {
    await performLeave();
    setConfirmingActiveLeave(false);
  }

  let body: React.ReactNode;

  if (status === "scheduled") {
    body = isMember ? (
      <div className="flex flex-col items-center gap-2">
        <span className="flex h-12 w-full items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
          You&apos;re in
        </span>
        <button
          type="button"
          onClick={handleLeaveClick}
          disabled={pending !== null}
          className="text-sm font-semibold text-muted-foreground underline-offset-2 hover:text-destructive hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:no-underline"
        >
          {pending === "leave" ? "Leaving…" : "Leave competition"}
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => void handleJoin()}
        disabled={pending !== null}
        className="flex h-12 w-full items-center justify-center rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed disabled:border-transparent disabled:bg-cta-disabled disabled:text-cta-disabled-foreground"
      >
        {pending === "join" ? "Joining…" : "Join competition"}
      </button>
    );
  } else if (status === "active" || status === "finalising") {
    // WEB-3 item 3 / JOIN-1: a non-member can still join on the
    // competition's own first active day — see the block comment above
    // `MembershipCta`. WEB-4 item 3 / LEAVE-1: an ACTIVE member now also
    // gets a "Leave competition" option (styled, destructive confirmation —
    // see `handleLeaveClick`/`ConfirmDialog` below); a FINALISING member
    // never does, since results are already being settled.
    const canStillJoin = status === "active" && isDayOneOfActiveCompetition(startDate, timeZone);
    body = isMember ? (
      <div className="flex flex-col items-center gap-2">
        <a
          href="#leaderboard"
          className="flex h-12 w-full items-center justify-center rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
        >
          View leaderboard
        </a>
        {status === "active" ? (
          <button
            type="button"
            onClick={handleLeaveClick}
            disabled={pending !== null}
            className="text-sm font-semibold text-muted-foreground underline-offset-2 hover:text-destructive hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:no-underline"
          >
            {pending === "leave" ? "Leaving…" : "Leave competition"}
          </button>
        ) : null}
      </div>
    ) : canStillJoin ? (
      <button
        type="button"
        onClick={() => void handleJoin()}
        disabled={pending !== null}
        className="flex h-12 w-full items-center justify-center rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed disabled:border-transparent disabled:bg-cta-disabled disabled:text-cta-disabled-foreground"
      >
        {pending === "join" ? "Joining…" : "Join competition"}
      </button>
    ) : (
      <div className="rounded-2xl bg-muted p-4 text-center text-sm text-muted-foreground">
        {status === "active"
          ? "This one's already under way — new joins closed after its first day."
          : "Results are being finalised — check back shortly."}
        <div className="mt-2">
          <Link href="/dashboard" className="font-semibold text-brand-navy underline-offset-2 hover:underline">
            Find another competition
          </Link>
        </div>
      </div>
    );
  } else {
    // finished
    body = isMember ? (
      <a
        href="#leaderboard"
        className="flex h-12 w-full items-center justify-center rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
      >
        See final results
      </a>
    ) : (
      <div className="rounded-2xl bg-muted p-4 text-center text-sm text-muted-foreground">
        This competition has finished.
      </div>
    );
  }

  return (
    <div className="mt-6">
      {body}
      {actionError ? (
        <p className="mt-2 text-center text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirmingActiveLeave}
        title={`Leave ${competitionName ?? "this competition"}?`}
        description="You'll lose your points in this competition and you can't re-join it."
        confirmLabel="Leave competition"
        pendingLabel="Leaving…"
        destructive
        pending={pending === "leave"}
        onCancel={() => setConfirmingActiveLeave(false)}
        onConfirm={() => void handleConfirmActiveLeave()}
      />
    </div>
  );
}
