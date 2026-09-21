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

/**
 * W9-A11Y additions. Each mutation-proven the same way as the block above
 * (mutate source, confirm RED, revert, confirm GREEN).
 */
describe("CompetitionLeaderboard — accessibility (W9-A11Y)", () => {
  it('MUT-A11Y-LIST-ROLE: the ranked player <ul> carries an explicit role="list" attribute (Tailwind preflight\'s `list-style: none` strips the native list semantics in real browsers — jsdom\'s role query does not model that CSS-driven demotion, so this asserts the attribute directly rather than via getByRole, which would pass either way)', () => {
    const players = [
      makePlayer({ id: "a", displayName: "Amy", points: 500 }),
      makePlayer({ id: "b", displayName: "Bo", points: 300 }),
    ];

    const { container } = render(
      <CompetitionLeaderboard
        status="active"
        uid="a"
        ownPlayer={makeOwnPlayer({ points: 500 })}
        leaderboardState={{ status: "success", players }}
        winnerIds={[]}
      />,
    );

    const list = container.querySelector("ul");
    expect(list).toHaveAttribute("role", "list");
  });

  it("MUT-A11Y-SETTLING-LIVE: the \"wrapping up / still settling\" banner is an announced live region, not silent copy", () => {
    const players = [
      makePlayer({ id: "a", displayName: "Amy", points: 500, frozenRank: null }),
      makePlayer({ id: "b", displayName: "Bo", points: 300, frozenRank: 2 }),
    ];

    render(
      <CompetitionLeaderboard
        status="finished"
        uid="a"
        ownPlayer={makeOwnPlayer({ points: 500 })}
        leaderboardState={{ status: "success", players }}
        winnerIds={[]}
      />,
    );

    const banner = screen.getByText(/wrapping up/i);
    expect(banner).toHaveAttribute("role", "status");
    expect(banner).toHaveAttribute("aria-live", "polite");
  });

  it("MUT-A11Y-RANK-BADGE: a top-3 rank badge exposes an ordinal accessible name (\"1st place\"), not just the bare digit a sighted user sees", () => {
    const players = [
      makePlayer({ id: "a", displayName: "Amy", points: 500 }),
      makePlayer({ id: "b", displayName: "Bo", points: 300 }),
    ];

    render(
      <CompetitionLeaderboard
        status="active"
        uid="a"
        ownPlayer={makeOwnPlayer({ points: 500 })}
        leaderboardState={{ status: "success", players }}
        winnerIds={[]}
      />,
    );

    expect(screen.getByRole("img", { name: "1st place" })).toBeInTheDocument();
  });

  it('MUT-A11Y-WINNER-ICON-NAME: the winner\'s PartyPopper icon is not silently aria-hidden with zero text alternative — a wrapping role="img" gives screen reader users a "Winner" announcement a sighted user gets from the icon+gold-highlight alone', () => {
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

    expect(screen.getByRole("img", { name: "Winner" })).toBeInTheDocument();
  });
});

/**
 * W10-STATECHIP integration coverage. `PlayerRowBadge`'s own unit tests
 * (`src/components/status/PlayerRowBadge.test.tsx`) pin the badge's own
 * markup in isolation, but the "points stay visible next to it" half of
 * acceptance criterion 2 is a fact about THIS component (points are rendered
 * by `PlayerRow`/`YourPositionCard`, not by `PlayerRowBadge` itself) — a
 * regression here (e.g. a future edit that hides the points block behind
 * `!player.eliminated`) would leave every `PlayerRowBadge` unit test green
 * while the real leaderboard silently stopped showing an eliminated
 * player's score. Mutation-proven: wrapped the points `<p>` in `CompetitionLeaderboard.tsx`
 * in `{!player.eliminated ? (...) : null}`, confirmed RED, reverted, confirmed
 * GREEN.
 */
describe("CompetitionLeaderboard — eliminated player row (W10-STATECHIP)", () => {
  it("MUT-ELIMINATED-ROW-POINTS-VISIBLE: an eliminated player's row shows both the shared badge and their points, never hiding the score", () => {
    const players = [
      makePlayer({ id: "a", displayName: "Amy", points: 500, eliminated: false }),
      makePlayer({ id: "b", displayName: "Bo", points: 240, eliminated: true }),
    ];

    render(
      <CompetitionLeaderboard
        status="active"
        uid="a"
        ownPlayer={makeOwnPlayer({ points: 500 })}
        leaderboardState={{ status: "success", players }}
        winnerIds={[]}
      />,
    );

    const eliminatedRow = screen.getByText("Bo").closest("li");
    expect(eliminatedRow).not.toBeNull();
    expect(eliminatedRow!.textContent).toContain("Out — final score locked in");
    expect(eliminatedRow!.textContent).toContain("240");
  });

  it("MUT-ELIMINATED-OWN-ROW-POINTS-VISIBLE: the viewer's own sticky card still shows their points after elimination", () => {
    const players = [
      makePlayer({ id: "me", displayName: "Me", points: 175, eliminated: true }),
      makePlayer({ id: "other", displayName: "Other", points: 300, eliminated: false }),
    ];

    render(
      <CompetitionLeaderboard
        status="active"
        uid="me"
        ownPlayer={makeOwnPlayer({ points: 175, eliminated: true })}
        leaderboardState={{ status: "success", players }}
        winnerIds={[]}
      />,
    );

    // Appears twice by design: once on the sticky "your position" card, once
    // on this player's own row further down the same continuous list (W10
    // doesn't change that duplication — it predates this ticket).
    expect(screen.getAllByText("Out — final score locked in").length).toBeGreaterThan(0);
    expect(screen.getByText(/175 points/)).toBeInTheDocument();
  });
});

describe("CompetitionLeaderboard — WEB-3 item 1 contrast fix", () => {
  it("MUT-CONTRAST-ROW: a row's own '+N today' text is navy, not gold, since it sits on the light card row background", () => {
    const players = [makePlayer({ id: "other", displayName: "Other", points: 300, todayPoints: 40 })];

    render(
      <CompetitionLeaderboard
        status="active"
        uid="me"
        ownPlayer={makeOwnPlayer({ points: 175, todayPoints: 10 })}
        leaderboardState={{ status: "success", players }}
        winnerIds={[]}
      />,
    );

    const rowToday = screen.getByText("+40 today");
    expect(rowToday.className).toContain("text-brand-navy");
    expect(rowToday.className).not.toContain("text-brand-gold");
  });

  it("MUT-CONTRAST-STICKY: the sticky 'your position' card's own '+N today' text stays gold, since that card's background is navy", () => {
    const players = [makePlayer({ id: "other", displayName: "Other", points: 300, todayPoints: 40 })];

    render(
      <CompetitionLeaderboard
        status="active"
        uid="me"
        ownPlayer={makeOwnPlayer({ points: 175, todayPoints: 10 })}
        leaderboardState={{ status: "success", players }}
        winnerIds={[]}
      />,
    );

    const stickyToday = screen.getByText("+10 today");
    expect(stickyToday.className).toContain("text-brand-gold");
  });

  it("MUT-CONTRAST-BANNER: the 'Final results' banner is navy, not gold, since it sits directly on the light section background", () => {
    const players = [makePlayer({ id: "uid", displayName: "Me", points: 500, frozenRank: 1 })];

    render(
      <CompetitionLeaderboard
        status="finished"
        uid="uid"
        ownPlayer={makeOwnPlayer({ points: 500 })}
        leaderboardState={{ status: "success", players }}
        winnerIds={["uid"]}
      />,
    );

    const banner = screen.getByText(/final results/i);
    expect(banner.className).toContain("text-brand-navy");
    expect(banner.className).not.toContain("text-brand-gold");
  });
});
