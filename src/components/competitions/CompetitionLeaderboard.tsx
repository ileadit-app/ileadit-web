"use client";

import { AlertCircle, Heart, PartyPopper, Users } from "lucide-react";
import { PlayerAvatar } from "./PlayerAvatar";
import type {
  CompetitionStatus,
  LeaderboardPlayer,
  LeaderboardState,
  OwnPlayerData,
} from "@/lib/competitionDetail";
import {
  isCompetitionWinner,
  rankFinishedLeaderboard,
  rankLeaderboard,
  type RankedLeaderboardPlayer,
} from "@/lib/leaderboardRank";

/**
 * The member-only lower half of `/competitions/[id]` (design doc §5). Only
 * ever mounted once the caller has confirmed membership — see
 * `CompetitionDetail.tsx`. Everything rendered here comes from
 * `competitions/{id}/players/*` fields: `displayName, avatarIndex, points,
 * todayPoints, livesRemaining, eliminated` (verified against
 * `functions/src/services/competitions.ts:695-702` in the engine repo).
 * There is no percent-of-average or any other step-derived field on that
 * document — nothing here computes or infers one for any player, viewer
 * included (RULES.md:34, :102, :161).
 */

type RankedPlayer = RankedLeaderboardPlayer<LeaderboardPlayer>;

function LivesHearts({ livesRemaining, size = 12 }: { livesRemaining: number; size?: number }) {
  const label = `${livesRemaining} of 3 lives remaining`;
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={label}>
      {[0, 1, 2].map((i) => (
        <Heart
          key={i}
          className={i < livesRemaining ? "fill-brand-coral text-brand-coral" : "text-muted-foreground"}
          style={{ width: size, height: size }}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

const RANK_BADGE_CLASSNAME: Record<number, string> = {
  1: "bg-brand-gold text-brand-navy",
  2: "bg-secondary text-brand-navy",
  3: "bg-brand-coral/15 text-brand-coral",
};

function RankBadge({ rank, shimmer }: { rank: number; shimmer?: boolean }) {
  if (rank <= 3) {
    return (
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold tabular-nums ${RANK_BADGE_CLASSNAME[rank]} ${shimmer ? "animate-pulse" : ""}`}
        aria-label={rank === 1 ? "1st place" : rank === 2 ? "2nd place" : "3rd place"}
      >
        {rank}
      </span>
    );
  }
  return (
    <span
      className={`flex size-8 shrink-0 items-center justify-center text-sm font-bold tabular-nums text-muted-foreground ${shimmer ? "animate-pulse" : ""}`}
    >
      {rank}
    </span>
  );
}

function PlayerRow({
  player,
  isSelf,
  isWinner,
  status,
  shimmerRank,
}: {
  player: RankedPlayer;
  isSelf: boolean;
  isWinner: boolean;
  status: CompetitionStatus;
  shimmerRank: boolean;
}) {
  const showTodayPoints = status === "active";
  const showLives = status !== "finished";

  const rowHighlight = isSelf
    ? "border-l-4 border-brand-gold bg-brand-gold/10"
    : isWinner
      ? "border-l-4 border-transparent bg-brand-gold/15"
      : "border-l-4 border-transparent";

  return (
    <li className={`flex min-h-[64px] items-center gap-3 px-4 py-3 ${rowHighlight}`}>
      <RankBadge rank={player.rank} shimmer={shimmerRank} />
      <PlayerAvatar displayName={player.displayName} avatarIndex={player.avatarIndex} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate font-semibold text-foreground">
            {player.displayName ?? "Player"}
          </span>
          {isSelf ? (
            <span className="rounded-full bg-brand-navy px-2 py-0.5 text-[10px] font-bold uppercase text-white">
              You
            </span>
          ) : null}
          {isWinner ? <PartyPopper className="size-4 text-brand-gold" aria-hidden="true" /> : null}
          {/* Design doc §2: eliminated players get one status word/badge at
              the SAME typographic weight as everyone else — no red X, no
              strikethrough, no "penalty box" separator (that's also why
              `LeaderboardBody` below renders one continuous list instead of
              a divided "No longer in it" section). "Locked in," not
              "failed" — their points total stays visible and proud. */}
          {player.eliminated ? (
            <span className="rounded-full bg-brand-coral/15 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-coral">
              Out — final score locked in
            </span>
          ) : null}
        </div>
        {showLives ? (
          <div className="mt-0.5">
            <LivesHearts livesRemaining={player.eliminated ? 0 : player.livesRemaining} />
          </div>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="font-extrabold text-foreground">
          {player.points} {player.points === 1 ? "pt" : "pts"}
        </p>
        {showTodayPoints ? (
          <p className="text-xs text-brand-gold">+{player.todayPoints} today</p>
        ) : null}
      </div>
    </li>
  );
}

function YourPositionCard({
  status,
  ownPlayer,
  ownRank,
  stillSettling,
}: {
  status: CompetitionStatus;
  ownPlayer: OwnPlayerData;
  ownRank: number | null;
  /** See `CompetitionLeaderboard`'s `stillSettling` — a `finished`
   * competition whose rows haven't all delivered a frozen `rank` to this
   * client yet gets the same "Provisional" framing as `finalising`. */
  stillSettling: boolean;
}) {
  if (ownPlayer.eliminated) {
    return (
      <div className="sticky top-16 z-30 rounded-3xl bg-brand-navy p-5 text-on-navy-foreground shadow-lg">
        {/* Coral used as a small status accent (the dot), not a wash over
            the card — the copy itself stays on the same verified on-navy
            text colour as every other state (design doc §2, §6). */}
        <p className="flex items-center gap-1.5 text-sm font-semibold text-on-navy-muted">
          <span className="size-1.5 shrink-0 rounded-full bg-brand-coral" aria-hidden="true" />
          Out — final score locked in{ownRank !== null ? ` (rank #${ownRank})` : ""}
        </p>
        <p className="mt-1 text-2xl font-extrabold">{ownPlayer.points} points</p>
      </div>
    );
  }

  return (
    <div className="sticky top-16 z-30 rounded-3xl bg-brand-navy p-5 text-on-navy-foreground shadow-lg">
      {status === "finalising" || stillSettling ? (
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-on-navy-muted">
          Provisional
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-extrabold tabular-nums">
          {ownRank !== null ? `#${ownRank}` : "—"}
        </span>
        <PlayerAvatar
          displayName={ownPlayer.displayName}
          avatarIndex={ownPlayer.avatarIndex}
          size={36}
        />
        <span className="font-bold">You</span>
        <div className="ml-auto text-right">
          <p className="text-2xl font-extrabold">{ownPlayer.points}</p>
          {status === "active" ? (
            <p className="text-xs font-bold text-brand-gold">+{ownPlayer.todayPoints} today</p>
          ) : null}
        </div>
      </div>
      <div className="mt-3">
        <LivesHearts livesRemaining={ownPlayer.livesRemaining} size={14} />
      </div>
    </div>
  );
}

function ScheduledRoster({ players }: { players: LeaderboardPlayer[] }) {
  // Deviation from the design doc, verified against the rules, not assumed:
  // §5 specifies "sorted by join order" using a per-player `joinedOn`
  // relative-date chip. That field lives on
  // `competitions/{id}/players/{playerId}/private/state`, which is
  // `allow read: if isOwner(playerId)` (firestore.rules:272-275) — readable
  // by that ONE player only, never by a fellow member. There is no rules-
  // legal way for this page to show anyone else's join date. Sorted
  // alphabetically by display name instead, with no join-date chip, rather
  // than building a UI against data this client can never actually read.
  const sorted = [...players].sort((a, b) =>
    (a.displayName ?? "").localeCompare(b.displayName ?? ""),
  );

  return (
    <ul className="divide-y divide-border">
      {sorted.map((p) => (
        <li key={p.id} className="flex min-h-[64px] items-center gap-3 px-4 py-3">
          <PlayerAvatar displayName={p.displayName} avatarIndex={p.avatarIndex} size={40} />
          <span className="font-semibold text-foreground">{p.displayName ?? "Player"}</span>
        </li>
      ))}
    </ul>
  );
}

export function CompetitionLeaderboard({
  status,
  uid,
  ownPlayer,
  leaderboardState,
  winnerIds,
}: {
  status: CompetitionStatus;
  uid: string;
  ownPlayer: OwnPlayerData;
  leaderboardState: LeaderboardState;
  winnerIds: string[];
}) {
  // `finished`-only: rank the SAME rows via the frozen-rank rule
  // (`rankFinishedLeaderboard`, `src/lib/leaderboardRank.ts`) instead of the
  // live D-18 sort every other status uses. Computed once, here, so the
  // "still settling" banner below and `LeaderboardBody`'s actual row order
  // can never disagree about which mode they're in — both read the SAME
  // result rather than each re-deriving it.
  const finishedRanking =
    status === "finished" && leaderboardState.status === "success"
      ? rankFinishedLeaderboard(leaderboardState.players)
      : null;
  // "Settling": status is already `finished` at the competition-doc level,
  // but this client hasn't yet observed every player row's own `rank` field
  // (see `rankFinishedLeaderboard`'s module doc — a transient cross-listener
  // gap, not an error). Treated the same as `finalising` visually: honest
  // "still locking in" framing, never the "Final results" copy, until every
  // row has caught up.
  const stillSettling = finishedRanking?.status === "unsettled";

  return (
    <section id="leaderboard" className="mt-8 scroll-mt-20">
      {status === "scheduled" ? (
        <>
          <h2 className="text-lg font-bold text-foreground">
            The leaderboard opens once this competition starts.
          </h2>
          <div className="mt-4 rounded-3xl border border-border bg-card">
            {leaderboardState.status === "error" ? (
              <LeaderboardErrorState />
            ) : leaderboardState.status === "success" ? (
              leaderboardState.players.length === 0 ? (
                <LeaderboardEmptyState />
              ) : (
                <ScheduledRoster players={leaderboardState.players} />
              )
            ) : (
              <LeaderboardSkeleton />
            )}
          </div>
        </>
      ) : null}

      {status === "active" || status === "finalising" || status === "finished" ? (
        <>
          {status === "finalising" || stillSettling ? (
            // Design doc §5: a named, calm waiting state — not "finished"
            // (would be a lie) and not a spinner/blank screen. Honest about
            // duration: the engine's own 30-hour cutoff
            // (`services/finalise.ts`, engine repo) means this is routinely
            // an hours-long wait, not "a few minutes." `stillSettling` (a
            // competition that IS `finished` at the top level, but whose
            // player rows haven't all delivered their frozen `rank` to
            // THIS client yet) gets the exact same honest copy rather than
            // a premature "Final results" banner.
            <div className="mb-4 rounded-2xl bg-brand-coral/10 p-3 text-center text-sm font-semibold text-brand-coral">
              Wrapping up — a few last days are still closing. Final standings can take up to a
              day to lock in.
            </div>
          ) : null}
          {status === "finished" && !stillSettling ? (
            <p className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-gold">
              🏅 Final results
            </p>
          ) : null}

          {leaderboardState.status === "error" ? (
            <div className="rounded-3xl border border-border bg-card">
              <LeaderboardErrorState />
            </div>
          ) : leaderboardState.status === "success" && leaderboardState.players.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card">
              <LeaderboardEmptyState />
            </div>
          ) : leaderboardState.status !== "success" ? (
            <>
              <YourPositionSkeleton />
              <div className="mt-4 rounded-3xl border border-border bg-card">
                <LeaderboardSkeleton />
              </div>
            </>
          ) : (
            <LeaderboardBody
              status={status}
              uid={uid}
              ownPlayer={ownPlayer}
              players={leaderboardState.players}
              winnerIds={winnerIds}
              finishedRanking={finishedRanking}
            />
          )}
        </>
      ) : null}
    </section>
  );
}

function LeaderboardBody({
  status,
  uid,
  ownPlayer,
  players,
  winnerIds,
  finishedRanking,
}: {
  status: CompetitionStatus;
  uid: string;
  ownPlayer: OwnPlayerData;
  players: LeaderboardPlayer[];
  winnerIds: string[];
  /** Non-null only when `status === "finished"` — see `CompetitionLeaderboard`,
   * which computes this once and passes it down so the banner above and the
   * rows below can never disagree about settled-vs-settling. */
  finishedRanking: ReturnType<typeof rankFinishedLeaderboard<LeaderboardPlayer>> | null;
}) {
  // ONE shared sort/rank utility (`src/lib/leaderboardRank.ts`) — nobody
  // re-sorts inline. Design doc §2 explicitly warns against "a separator
  // line labeled 'eliminated players' that reads like a penalty box";
  // eliminated players sort last (D-18) but stay in the SAME continuous
  // list as everyone else, distinguished only by their own row's badge
  // (see `PlayerRow` above), not by a section they're segregated into.
  //
  // `finished`: the frozen-rank rule (`rankFinishedLeaderboard`) — passed in
  // already computed, never re-derived here. Every other status: the live
  // D-18 sort, same as always.
  const ranked = finishedRanking ? finishedRanking.players : rankLeaderboard(players);
  const stillSettling = finishedRanking?.status === "unsettled";
  const ownRank = ranked.find((p) => p.id === uid)?.rank ?? null;

  return (
    <>
      <YourPositionCard
        status={status}
        ownPlayer={ownPlayer}
        ownRank={ownRank}
        stillSettling={stillSettling === true}
      />
      {status === "active" ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Updated after today&apos;s close
        </p>
      ) : null}
      {status === "finalising" || stillSettling ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Provisional final standings — order can still change while last days close
        </p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-3xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {ranked.map((p) => (
            <PlayerRow
              key={p.id}
              player={p}
              isSelf={p.id === uid}
              isWinner={isCompetitionWinner(p.id, status === "finished", winnerIds)}
              status={status}
              shimmerRank={status === "finalising" || stillSettling === true}
            />
          ))}
        </ul>
      </div>
    </>
  );
}

/**
 * Deliberately distinct from `LeaderboardEmptyState` below, same discipline
 * as `PlayingCompetitions.tsx`'s error/empty pair — a real read failure must
 * never be presented as "there's nobody here," or a temporary outage would
 * look like an abandoned competition.
 */
function LeaderboardErrorState() {
  return (
    <div className="flex items-start gap-3 p-6" role="alert">
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
      <div>
        <p className="text-base font-bold text-destructive">We couldn&apos;t load the leaderboard</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Something went wrong talking to ileadit. Your place in this competition hasn&apos;t
          changed — try reloading the page.
        </p>
      </div>
    </div>
  );
}

/**
 * A defensive branch, not the expected path: a member's own player doc is
 * itself one row in this collection, so a genuinely empty result here would
 * mean the data is momentarily inconsistent, not that "no one has joined."
 * Kept as its own distinct message anyway, rather than folded into either
 * `LeaderboardErrorState` or a silent blank panel.
 */
function LeaderboardEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 p-8 text-center">
      <Users className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-semibold text-foreground">No players showing up here yet</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        That&apos;s unexpected for a competition you&apos;re in — try reloading the page.
      </p>
    </div>
  );
}

function YourPositionSkeleton() {
  return (
    <div className="h-[92px] animate-pulse rounded-3xl bg-muted" role="status" aria-live="polite">
      <span className="sr-only">Loading the leaderboard…</span>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-px p-1" role="status" aria-live="polite">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" aria-hidden="true" />
      ))}
      <span className="sr-only">Loading the leaderboard…</span>
    </div>
  );
}
