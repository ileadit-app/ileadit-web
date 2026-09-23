import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlayingCompetitions } from "./PlayingCompetitions";
import type { PlayingCompetitionSummary } from "@/lib/playerCompetitions";

/**
 * PORTAL-NAV-1, BUG 1: before this fix, `PlayingCompetitionCard` was a plain
 * `div` — a player landing on the Dashboard had no way to reach
 * `/competitions/{id}` (details, leaderboard, Leave competition) from here.
 * These tests pin the fix: each card is a real `<Link>` whose `href` carries
 * the competition id, with an accessible name that includes the competition
 * name and a `role="link"` reachable by keyboard.
 *
 * Mocking boundary: `next/link` (plain `<a>`, same convention as
 * `InviteCodeLanding.test.tsx`) and `@/lib/playerCompetitions`'s
 * `usePlayingCompetitions` — everything else (the status/visibility chips)
 * is the real implementation, since neither touches Firebase.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const usePlayingCompetitionsMock = vi.fn();
vi.mock("@/lib/playerCompetitions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/playerCompetitions")>(
    "@/lib/playerCompetitions",
  );
  return {
    ...actual,
    usePlayingCompetitions: (uid: string | null) => usePlayingCompetitionsMock(uid),
  };
});

const COMPETITION: PlayingCompetitionSummary = {
  id: "comp-abc123",
  name: "Step Champs",
  status: "active",
  startDate: "2026-09-15",
  endDate: "2026-09-22",
  playerCount: 12,
  points: 40,
  position: 3,
  timeZone: "Europe/London",
  visibility: "public",
};

beforeEach(() => {
  usePlayingCompetitionsMock.mockReset();
});

describe("PlayingCompetitions — PORTAL-NAV-1 card navigation", () => {
  it("PORTAL-NAV-1-A: renders the card as a link to /competitions/{id}", () => {
    usePlayingCompetitionsMock.mockReturnValue({
      status: "success",
      competitions: [COMPETITION],
    });

    render(<PlayingCompetitions uid="u1" />);

    const link = screen.getByRole("link", { name: /step champs/i });
    expect(link).toHaveAttribute("href", "/competitions/comp-abc123");
  });

  it("PORTAL-NAV-1-B: the accessible name includes the competition name", () => {
    usePlayingCompetitionsMock.mockReturnValue({
      status: "success",
      competitions: [COMPETITION],
    });

    render(<PlayingCompetitions uid="u1" />);

    expect(screen.getByRole("link", { name: "View Step Champs" })).toBeInTheDocument();
  });

  it("PORTAL-NAV-1-C: carries a visible focus ring class following the light-background convention", () => {
    usePlayingCompetitionsMock.mockReturnValue({
      status: "success",
      competitions: [COMPETITION],
    });

    render(<PlayingCompetitions uid="u1" />);

    const link = screen.getByRole("link", { name: /step champs/i });
    expect(link.className).toContain("focus-visible:outline-brand-navy");
  });

  it("PORTAL-NAV-1-D: is keyboard-reachable and does not nest a second interactive element inside it", () => {
    usePlayingCompetitionsMock.mockReturnValue({
      status: "success",
      competitions: [COMPETITION],
    });

    render(<PlayingCompetitions uid="u1" />);

    const link = screen.getByRole("link", { name: /step champs/i });
    link.focus();
    expect(link).toHaveFocus();
    // No nested link/button inside the card's own link.
    expect(link.querySelectorAll("a, button").length).toBe(0);

    // Enter on a real anchor is native browser/jsdom navigation behaviour,
    // not something React needs to wire up — this just confirms the element
    // IS a real anchor (the thing that makes Enter work), not e.g. a div
    // with an onClick handler standing in for one.
    fireEvent.keyDown(link, { key: "Enter", code: "Enter" });
    expect(link.tagName).toBe("A");
  });
});
