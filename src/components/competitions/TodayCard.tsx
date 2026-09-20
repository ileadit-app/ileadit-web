"use client";

import { Heart, Shield } from "lucide-react";
import { useAccountGameState, resolveWarmupStatus } from "@/lib/todayCard";
import { useWarmupDaysConfig } from "@/lib/gameConfig";
import type { OwnPlayerData } from "@/lib/competitionDetail";

/**
 * The Today Card — ticket W7-TODAY, the competition detail hero for a member
 * while their competition is `active`/`finalising`. Answers "how am I doing
 * today" using POINTS ONLY, never a step count and never a client-computed
 * target — see `src/lib/todayCard.ts`'s file header for the full account of
 * why (CLAUDE.md bans this portal from ever reading `users/{uid}/days/{date}`,
 * which is where every step-derived and target-derived field the design
 * spec assumed would be available actually lives).
 *
 * `player` is the SAME `OwnPlayerData` `CompetitionDetail.tsx` already fetches
 * via `useOwnMembership` — no new player-doc read introduced here. `points`
 * and `todayPoints` are rendered exactly as the engine wrote them; nothing
 * here derives a score.
 */
export function TodayCard({ uid, player }: { uid: string; player: OwnPlayerData }) {
  const gameStateResult = useAccountGameState(uid);
  const warmupDaysResult = useWarmupDaysConfig();

  if (player.eliminated) {
    return (
      <div className="mt-6 rounded-3xl bg-brand-navy p-6 text-on-navy-foreground">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">Today</p>
        <p className="mt-2 text-lg font-bold">Out — final score locked in.</p>
        <p className="mt-1 text-sm text-on-navy-muted">
          {player.points} points locked in. You&apos;re still on the team — cheer the rest home.
        </p>
      </div>
    );
  }

  const warmup =
    gameStateResult.status === "success" && warmupDaysResult.status === "success"
      ? resolveWarmupStatus(gameStateResult.state, warmupDaysResult.warmupDays)
      : null;

  // Closest legitimate analog to the design spec's "don't conflate no-data
  // with a real value" `steps` rule that this portal is actually allowed to
  // read — see todayCard.ts's header. `null` while the account-state read is
  // still in flight, so this never flashes the "finding your rhythm" copy
  // for a fraction of a second on a returning player who already has an
  // average.
  const averageEstablished =
    gameStateResult.status === "success" ? gameStateResult.state.averageEstablished : null;

  return (
    <div className="mt-6 rounded-3xl bg-brand-navy p-6 text-on-navy-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">Today</p>
        {warmup ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-brand-gold">
            Warm-up · Day {warmup.dayOfWarmup} of {warmup.totalDays}
          </span>
        ) : null}
      </div>

      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl font-extrabold">{player.todayPoints}</span>
        <span className="text-base font-semibold text-on-navy-muted">points today</span>
      </p>

      {warmup ? (
        <p className="mt-1 text-sm text-on-navy-muted">
          Warm-up week — find your pace. No lives on the line yet.
        </p>
      ) : averageEstablished === false ? (
        <p className="mt-1 text-sm text-on-navy-muted">
          Still finding your rhythm — your average kicks in after your first few days.
        </p>
      ) : null}

      <div
        className="mt-4 flex items-center gap-1.5"
        aria-label={
          warmup ? "Protected during warm-up — no lives at risk yet" : `${player.livesRemaining} of 3 lives remaining`
        }
      >
        {warmup ? (
          <Shield className="size-5 text-brand-gold" aria-hidden="true" />
        ) : (
          [0, 1, 2].map((i) => (
            <Heart
              key={i}
              className={
                i < player.livesRemaining
                  ? "size-5 fill-brand-coral text-brand-coral"
                  : "size-5 text-on-navy-muted"
              }
              aria-hidden="true"
            />
          ))
        )}
      </div>
    </div>
  );
}
