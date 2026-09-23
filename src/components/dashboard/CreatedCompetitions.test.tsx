import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CreatedCompetitions } from "./CreatedCompetitions";
import type { CreatedCompetitionSummary } from "@/lib/competitions";

/**
 * PORTAL-NAV-1, BUG 1: same fix, applied to the "competitions you created"
 * section — see `PlayingCompetitions.test.tsx`'s header comment for the full
 * reasoning, deliberately mirrored here rather than re-derived.
 *
 * Mocking boundary: `next/link` and `@/lib/competitions`'s
 * `useCreatedCompetitions` only.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const useCreatedCompetitionsMock = vi.fn();
vi.mock("@/lib/competitions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/competitions")>("@/lib/competitions");
  return {
    ...actual,
    useCreatedCompetitions: (uid: string | null) => useCreatedCompetitionsMock(uid),
  };
});

const COMPETITION: CreatedCompetitionSummary = {
  id: "comp-xyz789",
  name: "Office Step-Off",
  status: "scheduled",
  startDate: "2026-10-01",
  endDate: "2026-10-08",
  playerCount: 24,
  timeZone: "Europe/London",
  visibility: "private",
};

beforeEach(() => {
  useCreatedCompetitionsMock.mockReset();
});

describe("CreatedCompetitions — PORTAL-NAV-1 card navigation", () => {
  it("PORTAL-NAV-1-E: renders the card as a link to /competitions/{id}", () => {
    useCreatedCompetitionsMock.mockReturnValue({
      status: "success",
      competitions: [COMPETITION],
    });

    render(<CreatedCompetitions uid="u1" />);

    const link = screen.getByRole("link", { name: /office step-off/i });
    expect(link).toHaveAttribute("href", "/competitions/comp-xyz789");
  });

  it("PORTAL-NAV-1-F: the accessible name includes the competition name", () => {
    useCreatedCompetitionsMock.mockReturnValue({
      status: "success",
      competitions: [COMPETITION],
    });

    render(<CreatedCompetitions uid="u1" />);

    expect(screen.getByRole("link", { name: "View Office Step-Off" })).toBeInTheDocument();
  });

  it("PORTAL-NAV-1-G: carries a visible focus ring class following the light-background convention", () => {
    useCreatedCompetitionsMock.mockReturnValue({
      status: "success",
      competitions: [COMPETITION],
    });

    render(<CreatedCompetitions uid="u1" />);

    const link = screen.getByRole("link", { name: /office step-off/i });
    expect(link.className).toContain("focus-visible:outline-brand-navy");
  });

  it("PORTAL-NAV-1-H: is keyboard-reachable and does not nest a second interactive element inside it", () => {
    useCreatedCompetitionsMock.mockReturnValue({
      status: "success",
      competitions: [COMPETITION],
    });

    render(<CreatedCompetitions uid="u1" />);

    const link = screen.getByRole("link", { name: /office step-off/i });
    link.focus();
    expect(link).toHaveFocus();
    expect(link.querySelectorAll("a, button").length).toBe(0);

    fireEvent.keyDown(link, { key: "Enter", code: "Enter" });
    expect(link.tagName).toBe("A");
  });
});
