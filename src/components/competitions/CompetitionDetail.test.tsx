import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompetitionDetail } from "./CompetitionDetail";

/**
 * Pins WEB-3 item 6's "Back to dashboard" link on the happy path. Before
 * this ticket, that link only existed in `StatusPage` (the
 * not-found/denied/error branches) — a signed-in, successfully-loaded
 * render had no way back to `/dashboard` except the browser's own back
 * button.
 *
 * Deliberately picks a "not-member, scheduled" competition state, which is
 * the cheapest state to mock: `TodayCard` and `CompetitionLeaderboard` are
 * both gated on membership and never mount, so this file only needs to
 * mock the three hooks `CompetitionDetail.tsx` itself calls
 * unconditionally (`useCompetitionDetail`, `useOwnMembership`,
 * `useCompetitionPlayers`) plus `useUser` — same mocking boundary already
 * used by `InviteLanding.test.tsx` for the first two.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const useUserMock = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useUser: () => useUserMock(),
}));

const useCompetitionDetailMock = vi.fn();
const useOwnMembershipMock = vi.fn();
const useCompetitionPlayersMock = vi.fn();
vi.mock("@/lib/competitionDetail", () => ({
  useCompetitionDetail: (id: string) => useCompetitionDetailMock(id),
  useOwnMembership: (uid: string | null, id: string) => useOwnMembershipMock(uid, id),
  useCompetitionPlayers: (id: string, enabled: boolean) => useCompetitionPlayersMock(id, enabled),
}));

vi.mock("@/lib/joinCompetition", () => ({ joinCompetition: vi.fn() }));
vi.mock("@/lib/leaveCompetition", () => ({ leaveCompetition: vi.fn() }));

const COMPETITION_ID = "comp-123";

beforeEach(() => {
  useUserMock.mockReset();
  useCompetitionDetailMock.mockReset();
  useOwnMembershipMock.mockReset();
  useCompetitionPlayersMock.mockReset();

  useUserMock.mockReturnValue({ user: { uid: "u1" } });
  useCompetitionDetailMock.mockReturnValue({
    status: "success",
    competition: {
      id: COMPETITION_ID,
      name: "March Madness Steps",
      description: null,
      imageUrl: null,
      backgroundImageUrl: null,
      status: "scheduled",
      startDate: "2026-10-01",
      endDate: "2026-10-08",
      durationDays: 7,
      playerCount: 12,
      winnerIds: [],
    },
  });
  useOwnMembershipMock.mockReturnValue({ status: "not-member" });
  useCompetitionPlayersMock.mockReturnValue({ status: "loading" });
});

describe("CompetitionDetail — WEB-3 item 6 back-to-dashboard link", () => {
  it("MUT-BACKLINK: the happy path renders a link back to /dashboard", () => {
    render(<CompetitionDetail competitionId={COMPETITION_ID} />);

    const backLink = screen.getByRole("link", { name: /back to dashboard/i });
    expect(backLink).toHaveAttribute("href", "/dashboard");
  });
});
