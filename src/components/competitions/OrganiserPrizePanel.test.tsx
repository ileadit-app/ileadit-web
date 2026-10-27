import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OrganiserPrizePanel } from "./OrganiserPrizePanel";

/**
 * PRZ-W1 (W5) — pins the organiser "hand out the prize" panel's two
 * required behaviours: (1) "Mark as given" calls `markPrizeGiven` with
 * `{competitionId, uid}` ONLY after the confirm dialog is accepted, never on
 * the first click; (2) a claim already `given`/`sent` shows a "Given ..."
 * state with no button, never a re-clickable action. Mocks
 * `@/lib/prizeClaims` (the claims hook) and `@/lib/markPrizeGiven` (the
 * callable wrapper) directly — the same "mock the module boundary this
 * component actually reads" discipline every other test file in this
 * directory already uses, never the raw `httpsCallable`/Firestore SDK for a
 * component this far from that boundary.
 */

const usePrizeClaimsMock = vi.fn();
vi.mock("@/lib/prizeClaims", async () => {
  const actual = await vi.importActual<typeof import("@/lib/prizeClaims")>("@/lib/prizeClaims");
  return {
    ...actual,
    usePrizeClaims: (id: string, enabled: boolean) => usePrizeClaimsMock(id, enabled),
  };
});

const markPrizeGivenMock = vi.fn();
vi.mock("@/lib/markPrizeGiven", () => ({
  markPrizeGiven: (competitionId: string, uid: string) => markPrizeGivenMock(competitionId, uid),
}));

const PRIZE = {
  kind: "perk" as const,
  places: 1 as const,
  items: [{ place: 1 as const, title: "£100 voucher", description: "" }],
  forfeitLoserText: null,
  adultOnly: false,
};

const WINNER = { place: 1, uid: "uid-winner", displayName: "Alex Winner", method: "points" as const };

beforeEach(() => {
  usePrizeClaimsMock.mockReset();
  markPrizeGivenMock.mockReset();
  markPrizeGivenMock.mockResolvedValue({ status: "success" });
  usePrizeClaimsMock.mockReturnValue({ status: "success", claims: [{ uid: "uid-winner", place: 1, status: "ready", givenAt: null }] });
});

describe("OrganiserPrizePanel", () => {
  it("renders nothing when there's no prize", () => {
    const { container } = render(
      <OrganiserPrizePanel
        competitionId="comp-1"
        prize={null}
        prizeWinners={[]}
        leaderboardState={{ status: "idle" }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("Mark as given: does NOT call markPrizeGiven on the first click — only after confirming", async () => {
    render(
      <OrganiserPrizePanel
        competitionId="comp-1"
        prize={PRIZE}
        prizeWinners={[WINNER]}
        leaderboardState={{ status: "idle" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^mark as given$/i }));
    expect(markPrizeGivenMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /yes, mark as given/i }));

    await waitFor(() => expect(markPrizeGivenMock).toHaveBeenCalledTimes(1));
    expect(markPrizeGivenMock).toHaveBeenCalledWith("comp-1", "uid-winner");
  });

  it('a claim already "given" shows a Given state with no action button', () => {
    usePrizeClaimsMock.mockReturnValue({
      status: "success",
      claims: [{ uid: "uid-winner", place: 1, status: "given", givenAt: null }],
    });

    render(
      <OrganiserPrizePanel
        competitionId="comp-1"
        prize={PRIZE}
        prizeWinners={[WINNER]}
        leaderboardState={{ status: "idle" }}
      />,
    );

    expect(screen.getByText(/^given$/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark as given/i })).not.toBeInTheDocument();
  });

  it("shows the winner's points when the leaderboard data is available", () => {
    render(
      <OrganiserPrizePanel
        competitionId="comp-1"
        prize={PRIZE}
        prizeWinners={[WINNER]}
        leaderboardState={{
          status: "success",
          players: [
            {
              id: "uid-winner",
              displayName: "Alex Winner",
              avatarIndex: null,
              points: 842,
              todayPoints: 0,
              livesRemaining: 3,
              eliminated: false,
              frozenRank: 1,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText(/842 points/i)).toBeInTheDocument();
  });
});
