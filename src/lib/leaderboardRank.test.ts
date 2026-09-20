import { describe, expect, it } from "vitest";
import { findLeaderboardRank, rankLeaderboard, sortLeaderboard } from "./leaderboardRank";

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
