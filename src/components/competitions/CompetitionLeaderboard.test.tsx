import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompetitionLeaderboard } from "./CompetitionLeaderboard";
import type { LeaderboardPlayer, OwnPlayerData } from "@/lib/competitionDetail";

/**
 * Pins the `finished`-status WIRING in `CompetitionLeaderboard.tsx` (ticket
 * W8-FINISHED) — specifically the parts a pure unit test of
 * `rankFinishedLeaderboard`/`isCompetitionWinner` (see
 * `src/lib/leaderboardRank.test.ts`) cannot catch on its own: that this
 * COMPONENT actually calls those functions with the right arguments and
 * renders the right banner/badge as a result. A mistake here (e.g. passing
 * `status !== "finished"` instead of `status === "finished"` into
 * `isCompetitionWinner`, or gating the "still settling" banner on the wrong
 * boolean) would leave every pure-function test green while the real page
 * shows a wrong or premature "Final results" banner or crowns the wrong
 * player — this file exists to catch exactly that class of bug.
 *
 * Every test below has been mutation-proven the same way as
 * `leaderboardRank.test.ts`: the source was edited to break exactly the rule
 * claimed, confirmed RED, restored, confirmed GREEN.
 */

function makeOwnPlayer(overrides: Partial<OwnPlayerData> = {}): OwnPlayerData {
  return {
    displayName: "Me",
    avatarIndex: 0,
    points: 100,
    todayPoints: 0,
    livesRemaining: 2,
    eliminated: false,
    frozenRank: null,
    ...overrides,
  };
}

function makePlayer(overrides: Partial<LeaderboardPlayer> = {}): LeaderboardPlayer {
  return {
    id: "uid",
    displayName: "Player",
    avatarIndex: 0,
    points: 100,
    todayPoints: 0,
    livesRemaining: 2,
    eliminated: false,
    frozenRank: null,
    ...overrides,
  };
}

describe("CompetitionLeaderboard — finished status wiring", () => {
  it("MUT-SETTLED-BANNER: every row settled (frozen rank present) shows the Final results banner, not the settling banner", () => {
    const players = [
      makePlayer({ id: "uid", displayName: "Me", points: 500, frozenRank: 1 }),
      makePlayer({ id: "other", displayName: "Other", points: 300, frozenRank: 2 }),
    ];

    render(
      <CompetitionLeaderboard
        status="finished"
        uid="uid"
        ownPlayer={makeOwnPlayer({ points: 500 })}
        leaderboardState={{ status: "success", players }}
        winnerIds={["uid"]}
      />,
    );

    expect(screen.getByText(/final results/i)).toBeInTheDocument();
    expect(screen.queryByText(/wrapping up/i)).not.toBeInTheDocument();
  });

  it("MUT-UNSETTLED-BANNER: a finished competition with even one row missing its frozen rank shows the settling banner, never Final results", () => {
    const players = [
      makePlayer({ id: "uid", displayName: "Me", points: 500, frozenRank: null }),
      makePlayer({ id: "other", displayName: "Other", points: 300, frozenRank: 2 }),
    ];

    render(
      <CompetitionLeaderboard
        status="finished"
        uid="uid"
        ownPlayer={makeOwnPlayer({ points: 500 })}
        leaderboardState={{ status: "success", players }}
        winnerIds={["uid"]}
      />,
    );

    expect(screen.getByText(/wrapping up/i)).toBeInTheDocument();
    expect(screen.queryByText(/final results/i)).not.toBeInTheDocument();
  });

  it("MUT-WINNER-BADGE-WIRED: the player listed in winnerIds gets the winner badge once finished and settled; a non-listed player does not", () => {
    const players = [
      makePlayer({ id: "winner", displayName: "Winnie", points: 500, frozenRank: 1 }),
      makePlayer({ id: "loser", displayName: "Loser", points: 300, frozenRank: 2 }),
    ];

    render(
      <CompetitionLeaderboard
        status="finished"
        uid="winner"
        ownPlayer={makeOwnPlayer({ points: 500 })}
        leaderboardState={{ status: "success", players }}
        winnerIds={["winner"]}
      />,
    );

    const winnerRow = screen.getByText("Winnie").closest("li");
    const loserRow = screen.getByText("Loser").closest("li");
    expect(winnerRow?.querySelector("svg.lucide-party-popper")).toBeTruthy();
    expect(loserRow?.querySelector("svg.lucide-party-popper")).toBeFalsy();
  });

  it("MUT-FROZEN-ORDER-WIRED: once settled, rows render in FROZEN rank order, even when it contradicts live points order", () => {
    // Straggler-drift edge case (see leaderboardRank.ts module doc): frozen
    // rank 1 has fewer live points than frozen rank 2. A component that
    // recomputed order from `points` instead of using the passed-through
    // `finishedRanking` would render these in the opposite order.
    const players = [
      makePlayer({ id: "a", displayName: "LowPointsFrozenFirst", points: 10, frozenRank: 1 }),
      makePlayer({ id: "b", displayName: "HighPointsFrozenSecond", points: 999, frozenRank: 2 }),
    ];

    render(
      <CompetitionLeaderboard
        status="finished"
        uid="a"
        ownPlayer={makeOwnPlayer({ points: 10 })}
        leaderboardState={{ status: "success", players }}
        winnerIds={[]}
      />,
    );

    const names = screen.getAllByText(/FrozenFirst|FrozenSecond/).map((el) => el.textContent);
    expect(names).toEqual(["LowPointsFrozenFirst", "HighPointsFrozenSecond"]);
  });
});
