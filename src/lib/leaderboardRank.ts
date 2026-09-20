/**
 * The one place `competitions/{cid}/players/*` rows get ordered and given a
 * displayed rank (ticket W5-LEADERBOARD). `rank` does not exist in the data
 * (`competitionDetail.ts`'s `LeaderboardPlayer`/`OwnPlayerData` have no such
 * field while a competition is `active`/`finalising`/`scheduled`) — it is a
 * client-derived array position, and every consumer that needs one must go
 * through `rankLeaderboard` here rather than re-sorting inline.
 *
 * THE ORDERING RULE — verified against the engine's OWN authoritative
 * settlement logic, not just the design spec's prose, because the two
 * disagree on one point (see the discrepancy note below):
 *
 * `functions/src/domain/ranking.ts` (`computeCompetitionRanks`, sibling
 * `ileadit` engine repo, commit `45c9458`) is what the engine itself uses to
 * freeze `players/{uid}.rank` once a competition reaches `finished` — D-18:
 *
 *   "AN ELIMINATED PLAYER CANNOT WIN, AND RANKS BELOW EVERY SURVIVOR...
 *    The ordering is therefore two groups — survivors first, eliminated
 *    second — with points deciding order WITHIN each group only."
 *
 * i.e. eliminated players are sorted AMONG THEMSELVES by points descending,
 * the exact same rule as survivors — never by how long they lasted. Standard
 * (non-dense) competition ranking is applied over the combined order: a
 * player's rank is 1 + the number of players strictly above them, so ties
 * share a rank and the next distinct score skips the shared places
 * (survivor points 500, 500, 300 → rank 1, 1, 3 — never 1, 1, 2), and a
 * survivor/eliminated pair on equal points never shares a rank (different
 * groups are never a tie).
 *
 * DISCREPANCY WITH THE DESIGN SPEC — reported per this ticket's brief,
 * running code wins: `automation-hub/docs/ileadit-leaderboard-design-
 * 20260920.md` §3's pseudocode sorts eliminated players by `eliminatedOn`
 * DESCENDING ("whoever survived longer ranks higher"), even though it cites
 * D-18 as its own justification. D-18's real implementation
 * (`domain/ranking.ts`, quoted above) explicitly says "points deciding
 * order WITHIN each group ONLY" — there is no `eliminatedOn` comparison
 * anywhere in the engine's ranking code. Sorting eliminated players by
 * survival time here would make the LIVE leaderboard order diverge from the
 * FROZEN `rank` the engine itself writes to the same players once the
 * competition finishes — a highly visible "the order changed for no visible
 * reason" bug at exactly the moment (finalising → finished) players are
 * watching most closely. This module follows the engine's own rule
 * (points, not survival time) rather than the spec's pseudocode.
 * `eliminatedOn` is a real field (`docs/FIRESTORE_SCHEMA.md`, engine
 * `services/close.ts:362`) but is not used for ordering here — it may still
 * be useful for other, non-ordering copy in a future ticket.
 */

export interface RankableLeaderboardPlayer {
  displayName: string | null;
  points: number;
  eliminated: boolean;
}

export type RankedLeaderboardPlayer<T extends RankableLeaderboardPlayer> = T & {
  /** 1-based, standard (non-dense) competition rank — ties share a value,
   * the next distinct group skips the shared places. */
  rank: number;
};

/**
 * Comparator implementing the D-18 combined order: eliminated always last;
 * within a group, points descending; a stable, deterministic tiebreak by
 * `displayName` for two rows that are otherwise indistinguishable (equal
 * elimination status AND equal points) so repeated calls on identical input
 * never reorder two tied players against each other.
 */
function compareLeaderboardPlayers(
  a: RankableLeaderboardPlayer,
  b: RankableLeaderboardPlayer,
): number {
  if (a.eliminated !== b.eliminated) {
    return a.eliminated ? 1 : -1;
  }
  if (a.points !== b.points) {
    return b.points - a.points;
  }
  return (a.displayName ?? "").localeCompare(b.displayName ?? "");
}

/**
 * Sort ONLY — no rank numbers attached. Exported separately from
 * `rankLeaderboard` because a couple of callers (e.g. the `scheduled`
 * roster, which has no points/eliminated status to rank by at all) only
 * ever need an ordering, never a displayed rank.
 */
export function sortLeaderboard<T extends RankableLeaderboardPlayer>(
  players: readonly T[],
): T[] {
  return [...players].sort(compareLeaderboardPlayers);
}

/**
 * Sort AND attach the displayed rank. This is what every leaderboard /
 * "your position" surface should call — never `sortLeaderboard` plus a
 * hand-rolled `index + 1`, which silently loses the tie-sharing rule.
 */
export function rankLeaderboard<T extends RankableLeaderboardPlayer>(
  players: readonly T[],
): Array<RankedLeaderboardPlayer<T>> {
  const sorted = sortLeaderboard(players);
  let rank = 0;
  let previous: T | null = null;

  return sorted.map((player, index) => {
    const tiesWithPrevious =
      previous !== null &&
      previous.eliminated === player.eliminated &&
      previous.points === player.points;
    if (!tiesWithPrevious) {
      rank = index + 1;
    }
    previous = player;
    return { ...player, rank };
  });
}

/**
 * Convenience for the one thing almost every consumer actually wants: "what
 * rank does THIS uid show at." Returns `null` if the id isn't present
 * (defensive — should not happen for a player looking up their own row).
 */
export function findLeaderboardRank<T extends RankableLeaderboardPlayer & { id: string }>(
  players: readonly T[],
  id: string,
): number | null {
  const ranked = rankLeaderboard(players);
  return ranked.find((p) => p.id === id)?.rank ?? null;
}

/**
 * ---------------------------------------------------------------------
 * FINISHED-only ranking (ticket W8-FINISHED, 2026-09-20).
 *
 * Once a competition reaches `finished`, the engine's own settlement pass
 * (`functions/src/services/finalise.ts`'s `settleMemberOnce`, sibling
 * `ileadit` engine repo commit `d8d8e79`) writes a `rank` field onto EACH
 * player's own row — the same D-18 combined ordering this module already
 * computes client-side, but FROZEN at the instant of settlement rather than
 * recomputed from whatever `points` happens to read right now. Once that
 * field exists it is authoritative, and `finaliseCompetitionOnce` only
 * flips the competition doc's `status` to `"finished"` after EVERY member
 * in that run has been settled (the settlement loop throws, rather than
 * lets `status` move, if any member's settlement transaction errors) — so
 * structurally, every player row SHOULD already carry `rank` by the time a
 * client observes `status === "finished"`.
 *
 * Two independent Firestore listeners are in play, though: the competition
 * document and the `players` subcollection. Nothing guarantees they settle
 * on the same snapshot tick client-side, so a client can legitimately
 * observe `status === "finished"` for a moment before every player row's
 * `rank` has arrived on ITS OWN listener. `rankFinishedLeaderboard` makes
 * that transient window an explicit, distinct return value (`"unsettled"`)
 * instead of a silent gap — see `CompetitionLeaderboard.tsx` for how it's
 * surfaced (the same honest "still locking in" framing already used for
 * `finalising`, not the "Final results" copy, until every row has caught
 * up).
 *
 * THE RULE THIS ENFORCES: once a competition is genuinely settled, the UI
 * shows the FROZEN rank and NOTHING else — never a client-recomputed rank
 * alongside or instead of it. `finalise.ts`'s own module comment documents
 * a real edge case (the 30-hour cutoff) where a straggler's `points` can
 * drift upward AFTER settlement while `rank` stays frozen; if this module
 * also recomputed a live rank once settled, that edge case would show two
 * DIFFERENT numbers that visibly disagree. Showing only the frozen value
 * once every row has one makes that disagreement structurally unable to
 * reach the screen — not by reconciling two answers, but by only ever
 * computing one.
 * ---------------------------------------------------------------------
 */

export interface FrozenRankablePlayer extends RankableLeaderboardPlayer {
  /** `competitions/{cid}/players/{uid}.rank` — `null` until THIS player's
   * own settlement transaction has committed (see module doc above). */
  frozenRank: number | null;
}

export type FinishedRanking<T extends FrozenRankablePlayer> =
  | { status: "settled"; players: Array<RankedLeaderboardPlayer<T>> }
  | { status: "unsettled"; players: Array<RankedLeaderboardPlayer<T>> };

/**
 * The one place a `finished` competition's rows get ordered/ranked. Every
 * consumer showing a `finished` leaderboard must call this — never
 * `rankLeaderboard` directly — so "settled" vs "still catching up" is
 * always a real, checked state rather than an assumption.
 */
export function rankFinishedLeaderboard<T extends FrozenRankablePlayer>(
  players: readonly T[],
): FinishedRanking<T> {
  if (players.some((p) => p.frozenRank === null)) {
    // Not every row has settled yet from THIS client's read (see module
    // doc) — fall back to the SAME live D-18 ordering shown before the
    // competition finished, so the board stays legible without inventing a
    // frozen number nobody has actually written yet.
    return { status: "unsettled", players: rankLeaderboard(players) };
  }
  const sorted = [...players].sort((a, b) => {
    const byRank = (a.frozenRank as number) - (b.frozenRank as number);
    if (byRank !== 0) return byRank;
    // Deterministic tiebreak for two rows sharing a frozen rank (a real,
    // expected case — D-18 ties share a rank number) — same rule as
    // `compareLeaderboardPlayers`'s own tiebreak, applied here instead of
    // re-deriving order from points (which is exactly the thing this
    // function exists to avoid doing once a competition is settled).
    return (a.displayName ?? "").localeCompare(b.displayName ?? "");
  });
  return {
    status: "settled",
    players: sorted.map((p) => ({ ...p, rank: p.frozenRank as number })),
  };
}

/**
 * Whether `playerId` should render as a winner. `winnerIds` (the
 * competition document's own field, written by `finalise.ts`'s settlement
 * transaction in the SAME write as `status: "finished"`) is already the
 * engine's complete, authoritative answer — including the D-18 edge case
 * where every member of a competition was eliminated: nobody survived, so
 * `winnerIds` is EMPTY, even though the standard-ranking arithmetic still
 * hands the top ELIMINATED player rank 1 on the table (a leaderboard needs
 * a rank 1). This function exists so no caller is tempted to shortcut the
 * lookup with `rank === 1` — which would silently crown that top eliminated
 * player the "winner" of a competition nobody actually won. Always compute
 * a winner from `winnerIds` via this function, never from rank.
 */
export function isCompetitionWinner(
  playerId: string,
  isFinished: boolean,
  winnerIds: readonly string[],
): boolean {
  return isFinished && winnerIds.includes(playerId);
}
