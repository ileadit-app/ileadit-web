import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompetitionStatusChip } from "./CompetitionStatusChip";

/**
 * Pins `CompetitionStatusChip` (ticket W10-STATECHIP) — the single
 * competition-scoped status renderer that replaced three independent
 * `STATUS_LABEL`/`StatusBadge` copies (`CompetitionDetail.tsx`,
 * `CreatedCompetitions.tsx`, `PlayingCompetitions.tsx`). Every test below is
 * mutation-proven the same way as `leaderboardRank.test.ts`: the source
 * (`competition-status.ts` or this component) was edited to break exactly
 * the rule claimed, confirmed RED, restored, confirmed GREEN.
 *
 * The most important test here is MUT-UNKNOWN-NOT-SCHEDULED — the whole
 * reason `"unknown"` is a first-class config entry rather than a fallback
 * bolted on afterwards is so a competition doc whose `status` hasn't
 * resolved yet never gets silently mislabelled as `"scheduled"`.
 */

describe("CompetitionStatusChip", () => {
  it("MUT-SCHEDULED: renders the Scheduled label", () => {
    render(<CompetitionStatusChip status="scheduled" />);
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
  });

  it("MUT-ACTIVE: renders the Live label with an animated (pulsing) dot as a non-colour signal", () => {
    const { container } = render(<CompetitionStatusChip status="active" />);
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("MUT-FINALISING: renders the Finalising label with the inverted (dark-fill) treatment, not a tint of the active state", () => {
    render(<CompetitionStatusChip status="finalising" />);
    expect(screen.getByText("Finalising")).toBeInTheDocument();
    // Inverted fill direction is the whole point of this state (see
    // competition-status.ts's doc comment) — assert the chip's own fill is
    // navy, not gold, so this can never quietly regress into looking like a
    // paler "active".
    const chip = screen.getByText("Finalising").closest("span");
    expect(chip?.className).toContain("bg-brand-navy");
  });

  it("MUT-FINISHED: renders the Finished label with a visible border (the only outlined chip)", () => {
    render(<CompetitionStatusChip status="finished" />);
    const chip = screen.getByText("Finished").closest("span");
    expect(chip?.className).toContain("border");
    expect(chip?.className).not.toContain("border-dashed");
  });

  it("MUT-UNKNOWN-NOT-SCHEDULED: status=null renders a distinct 'unavailable' label — never silently 'Scheduled'", () => {
    render(<CompetitionStatusChip status={null} />);
    expect(screen.getByText("Status unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Scheduled")).not.toBeInTheDocument();
  });

  it("MUT-UNKNOWN-DASHED: the unknown state has a dashed border, distinguishing it from every solid-fill or solid-border state", () => {
    render(<CompetitionStatusChip status={null} />);
    const chip = screen.getByText("Status unavailable").closest("span");
    expect(chip?.className).toContain("border-dashed");
  });

  it("every state renders a non-colour marker (icon or pulsing dot) alongside its label, never text alone", () => {
    (["scheduled", "finalising", "finished", null] as const).forEach((status) => {
      const { container, unmount } = render(<CompetitionStatusChip status={status} />);
      expect(container.querySelector("svg")).toBeTruthy();
      unmount();
    });
    // `active` swaps the icon for the pulsing dot marker instead (covered by
    // MUT-ACTIVE above) — its own non-colour signal, not an absence of one.
    const { container } = render(<CompetitionStatusChip status="active" />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });
});
