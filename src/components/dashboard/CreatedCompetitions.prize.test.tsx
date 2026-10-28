import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreatedCompetitions } from "./CreatedCompetitions";

/**
 * PRZ-W1 (W7) — pins the dashboard card's prize line and the "Prize to hand
 * out" badge, both introduced on top of the pre-existing `CreatedCompetitions`
 * component. Mocks `@/lib/competitions`'s `useCreatedCompetitions` directly
 * (the one hook this component reads), same discipline as the other test
 * files in this ticket. `next/link` is stubbed to a plain anchor since no
 * App Router context is set up here — only each link's `href`/text matters.
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
    useCreatedCompetitions: (uid: string) => useCreatedCompetitionsMock(uid),
  };
});

function baseCompetition(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "comp-1",
    name: "Marketing team step-off",
    status: "finished",
    startDate: "2026-09-01",
    endDate: "2026-09-08",
    playerCount: 12,
    timeZone: "Europe/London",
    prize: null,
    prizeState: null,
    ...overrides,
  };
}

beforeEach(() => {
  useCreatedCompetitionsMock.mockReset();
});

describe("CreatedCompetitions — prize line and hand-out badge (W7)", () => {
  it("no prize: shows no prize line and no hand-out badge", () => {
    useCreatedCompetitionsMock.mockReturnValue({ status: "success", competitions: [baseCompetition()] });
    render(<CreatedCompetitions uid="uid-1" />);

    expect(screen.queryByText(/^win:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/prize to hand out/i)).not.toBeInTheDocument();
  });

  it("has a prize: shows the prize line chip", () => {
    useCreatedCompetitionsMock.mockReturnValue({
      status: "success",
      competitions: [
        baseCompetition({
          prize: {
            kind: "perk",
            places: 1,
            items: [{ place: 1, title: "£100 voucher", description: "" }],
            forfeitLoserText: null,
            adultOnly: false,
          },
        }),
      ],
    });
    render(<CreatedCompetitions uid="uid-1" />);

    expect(screen.getByText(/win: £100 voucher/i)).toBeInTheDocument();
  });

  it('finished + prizeState "ready": shows the "Prize to hand out" badge linking to the competition page', () => {
    useCreatedCompetitionsMock.mockReturnValue({
      status: "success",
      competitions: [
        baseCompetition({
          status: "finished",
          prizeState: "ready",
          prize: {
            kind: "perk",
            places: 1,
            items: [{ place: 1, title: "£100 voucher", description: "" }],
            forfeitLoserText: null,
            adultOnly: false,
          },
        }),
      ],
    });
    render(<CreatedCompetitions uid="uid-1" />);

    const badge = screen.getByRole("link", { name: /prize to hand out/i });
    expect(badge).toHaveAttribute("href", "/competitions/comp-1");
  });

  it('prizeState "ready" but NOT finished: no badge yet', () => {
    useCreatedCompetitionsMock.mockReturnValue({
      status: "success",
      competitions: [baseCompetition({ status: "active", prizeState: "ready" })],
    });
    render(<CreatedCompetitions uid="uid-1" />);

    expect(screen.queryByText(/prize to hand out/i)).not.toBeInTheDocument();
  });

  it('finished but prizeState "closed": no badge', () => {
    useCreatedCompetitionsMock.mockReturnValue({
      status: "success",
      competitions: [baseCompetition({ status: "finished", prizeState: "closed" })],
    });
    render(<CreatedCompetitions uid="uid-1" />);

    expect(screen.queryByText(/prize to hand out/i)).not.toBeInTheDocument();
  });
});
