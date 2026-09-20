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
