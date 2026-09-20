import { describe, expect, it } from "vitest";
import {
  findLeaderboardRank,
  isCompetitionWinner,
  rankFinishedLeaderboard,
  rankLeaderboard,
  sortLeaderboard,
} from "./leaderboardRank";

/**
 * Pins `leaderboardRank.ts` — the single sort/rank utility every leaderboard
 * consumer must use (ticket W5-LEADERBOARD). Every test below has been
 * mutation-proven: the source was edited to break exactly the rule the test
 * claims to pin, the test was confirmed RED, the source was restored, and
 * the test was confirmed GREEN again. See the ticket's findings report for
 * the specific mutation used for each MUT-* id.
 */

interface TestPlayer {
  id: string;
  displayName: string | null;
  points: number;
  eliminated: boolean;
}

function player(
  id: string,
  points: number,
  eliminated = false,
  displayName: string | null = id,
): TestPlayer {
  return { id, displayName, points, eliminated };
}

describe("sortLeaderboard / rankLeaderboard", () => {
  it("MUT-ELIM-LAST: an eliminated player sorts below every active player, regardless of points", () => {
    const players = [
      player("out-high-points", 900, true),
      player("active-low-points", 10, false),
    ];

    const sorted = sortLeaderboard(players);

    expect(sorted.map((p) => p.id)).toEqual(["active-low-points", "out-high-points"]);
  });

  it("MUT-ELIM-BY-POINTS: among eliminated players, higher points ranks above lower points (not survival time)", () => {
    const players = [
      player("out-fewer-points", 50, true),
      player("out-more-points", 200, true),
    ];

    const sorted = sortLeaderboard(players);

    expect(sorted.map((p) => p.id)).toEqual(["out-more-points", "out-fewer-points"]);
  });

  it("MUT-ACTIVE-DESC: active players sort by points descending", () => {
    const players = [player("low", 100), player("high", 500), player("mid", 250)];

    const sorted = sortLeaderboard(players);

    expect(sorted.map((p) => p.id)).toEqual(["high", "mid", "low"]);
  });

  it("MUT-TIE-SHARE-RANK: two active players on equal points show the SAME displayed rank, and the next distinct score skips the shared places", () => {
    const players = [
      player("a", 500, false, "Amy"),
      player("b", 500, false, "Bea"),
      player("c", 300, false, "Cat"),
    ];

    const ranked = rankLeaderboard(players);

    const byId = Object.fromEntries(ranked.map((p) => [p.id, p.rank]));
    expect(byId.a).toBe(1);
    expect(byId.b).toBe(1);
    // Standard (non-dense) competition ranking: 1, 1, 3 — never 1, 1, 2.
    expect(byId.c).toBe(3);
  });

  it("MUT-CROSS-GROUP-NO-TIE: a survivor and an eliminated player on equal points never share a rank", () => {
    const players = [player("survivor", 500, false), player("out", 500, true)];

    const ranked = rankLeaderboard(players);

    const byId = Object.fromEntries(ranked.map((p) => [p.id, p.rank]));
    expect(byId.survivor).toBe(1);
    expect(byId.out).toBe(2);
  });

  it("MUT-STABLE: sorting the same input twice produces an identical order (deterministic tiebreak, no coin-flip)", () => {
    const players = [
      player("z-player", 500, false, "Zara"),
      player("a-player", 500, false, "Amir"),
      player("m-player", 500, false, "Mo"),
    ];

    const firstPass = sortLeaderboard(players).map((p) => p.id);
    const secondPass = sortLeaderboard(players).map((p) => p.id);

    expect(firstPass).toEqual(secondPass);
    // The tiebreak itself: alphabetical by displayName among exact ties.
    expect(firstPass).toEqual(["a-player", "m-player", "z-player"]);
  });

  it("findLeaderboardRank returns the rank for a specific id, respecting the tie-sharing rule", () => {
    const players = [player("a", 500), player("b", 500), player("c", 100, true)];

    expect(findLeaderboardRank(players, "a")).toBe(1);
    expect(findLeaderboardRank(players, "b")).toBe(1);
    expect(findLeaderboardRank(players, "c")).toBe(3);
    expect(findLeaderboardRank(players, "does-not-exist")).toBeNull();
  });

  it("does not mutate the input array", () => {
    const players = [player("low", 10), player("high", 90)];
    const original = [...players];

    sortLeaderboard(players);
    rankLeaderboard(players);

    expect(players).toEqual(original);
  });
});

/**
 * `rankFinishedLeaderboard` and `isCompetitionWinner` (ticket W8-FINISHED,
 * 2026-09-20) — the `finished`-only rules. Every test below has been
 * mutation-proven the same way as the block above: source edited to break
 * exactly the rule claimed, confirmed RED, restored, confirmed GREEN.
 */

interface FrozenTestPlayer {
  id: string;
  displayName: string | null;
  points: number;
  eliminated: boolean;
  frozenRank: number | null;
}

function frozenPlayer(
  id: string,
  points: number,
  eliminated: boolean,
  frozenRank: number | null,
  displayName: string | null = id,
): FrozenTestPlayer {
  return { id, displayName, points, eliminated, frozenRank };
}

describe("rankFinishedLeaderboard", () => {
  it("MUT-FROZEN-AUTHORITATIVE: once every row has a frozen rank, that value drives order — NOT a recompute from points", () => {
    // Deliberately contradicts what a live points-desc sort would say
    // (`low-points-but-frozen-1` would sort LAST on points alone) — this is
    // exactly the straggler-drift edge case `finalise.ts` documents: a
    // member's live `points` can move after settlement while `rank` stays
    // frozen. If this function silently recomputed order from `points`
    // instead of trusting `frozenRank`, this test would fail.
    const players = [
      frozenPlayer("low-points-but-frozen-1", 10, false, 1),
      frozenPlayer("high-points-but-frozen-2", 999, false, 2),
    ];

    const result = rankFinishedLeaderboard(players);

    expect(result.status).toBe("settled");
    expect(result.players.map((p) => p.id)).toEqual([
      "low-points-but-frozen-1",
      "high-points-but-frozen-2",
    ]);
    expect(result.players.map((p) => p.rank)).toEqual([1, 2]);
  });

  it("MUT-FROZEN-TIE-BREAK: two rows sharing a frozen rank are ordered deterministically by displayName", () => {
    const players = [
      frozenPlayer("z", 500, false, 1, "Zara"),
      frozenPlayer("a", 500, false, 1, "Amir"),
    ];

    const result = rankFinishedLeaderboard(players);

    expect(result.status).toBe("settled");
    expect(result.players.map((p) => p.id)).toEqual(["a", "z"]);
    expect(result.players.map((p) => p.rank)).toEqual([1, 1]);
  });

  it("MUT-UNSETTLED-FALLBACK: if even one row is missing its frozen rank, the whole board falls back to the live D-18 order instead of inventing a number", () => {
    const players = [
      frozenPlayer("settled-row", 100, false, 1),
      frozenPlayer("not-yet-settled-row", 900, false, null),
    ];

    const result = rankFinishedLeaderboard(players);

    expect(result.status).toBe("unsettled");
    // The live D-18 order: points descending among non-eliminated players —
    // NOT the frozen order the settled row alone would suggest.
    expect(result.players.map((p) => p.id)).toEqual(["not-yet-settled-row", "settled-row"]);
  });

  it("does not mutate the input array", () => {
    const players = [frozenPlayer("a", 10, false, 2), frozenPlayer("b", 90, false, 1)];
    const original = [...players];

    rankFinishedLeaderboard(players);

    expect(players).toEqual(original);
  });
});

describe("isCompetitionWinner", () => {
  it("MUT-WINNER-FROM-WINNERIDS: a uid listed in winnerIds of a finished competition is a winner", () => {
    expect(isCompetitionWinner("survivor-uid", true, ["survivor-uid"])).toBe(true);
  });

  it("MUT-WINNER-NOT-LISTED: a uid NOT listed in winnerIds is never a winner, even when finished", () => {
    expect(isCompetitionWinner("also-played-uid", true, ["survivor-uid"])).toBe(false);
  });

  it("MUT-NO-WINNER-EDGE-CASE: winnerIds empty (every member eliminated) crowns NOBODY, even the uid ranking arithmetic would put at rank 1", () => {
    // This is the D-18 edge case the ticket calls out by name: the engine's
    // OWN winnerIds is already empty here — nothing computes rank locally
    // in this test at all, because isCompetitionWinner must never derive a
    // winner from rank. The uid below stands in for "the top eliminated
    // player," who a naive `rank === 1` check would wrongly crown.
    expect(isCompetitionWinner("top-eliminated-uid", true, [])).toBe(false);
  });

  it("MUT-NOT-FINISHED-GATE: never a winner before the competition is finished, even if winnerIds somehow already named this uid", () => {
    expect(isCompetitionWinner("uid", false, ["uid"])).toBe(false);
  });
});
