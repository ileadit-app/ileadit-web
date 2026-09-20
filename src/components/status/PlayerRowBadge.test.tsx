import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerRowBadge } from "./PlayerRowBadge";

/**
 * Pins `PlayerRowBadge` (ticket W10-STATECHIP) — the player-scoped modifier
 * badge shared by `CompetitionLeaderboard.tsx`'s row and "your position"
 * card, replacing two independently hand-written copies of the same
 * "Out — final score locked in" markup that used to live in that one file.
 *
 * MUT-ELIMINATED-NOT-GREYED is the acceptance-critical test: the W5
 * leaderboard design decision was that an eliminated player's badge is a
 * full-strength STATE, not a muted/greyed penalty — this extraction must
 * not lose that. Mutation-proven: changed `bg-brand-coral` to
 * `bg-brand-coral/15` (the old, pre-W10 tint) in `player-row-state.ts`,
 * confirmed RED, reverted, confirmed GREEN.
 */

describe("PlayerRowBadge", () => {
  it("MUT-NULL-RENDERS-NOTHING: state=null renders no badge at all — absence is itself meaningful, not a sixth state", () => {
    const { container } = render(<PlayerRowBadge state={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("MUT-ELIMINATED-LABEL: state='eliminated' shows the exact locked-in copy, not a generic 'Eliminated'", () => {
    render(<PlayerRowBadge state="eliminated" />);
    expect(screen.getByText("Out — final score locked in")).toBeInTheDocument();
  });

  it("MUT-ELIMINATED-NOT-GREYED: the eliminated badge is a full-strength coral fill with white text, never a muted/tinted treatment", () => {
    render(<PlayerRowBadge state="eliminated" />);
    const badge = screen.getByText("Out — final score locked in").closest("span");
    expect(badge?.className).toContain("bg-brand-coral");
    expect(badge?.className).not.toMatch(/bg-brand-coral\/\d/);
    expect(badge?.className).not.toContain("text-muted-foreground");
  });

  it("MUT-WARMUP-LABEL: state='warm-up' shows 'Protected' with an outline, not a filled, treatment", () => {
    render(<PlayerRowBadge state="warm-up" />);
    const badge = screen.getByText("Protected").closest("span");
    expect(badge).toBeInTheDocument();
    expect(badge?.className).toContain("border-brand-gold");
  });

  it("MUT-SHAPE-DISTINCT: uses rounded-md, never rounded-full, so this component family is never mistaken for CompetitionStatusChip", () => {
    render(<PlayerRowBadge state="eliminated" />);
    const badge = screen.getByText("Out — final score locked in").closest("span");
    expect(badge?.className).toContain("rounded-md");
    expect(badge?.className).not.toContain("rounded-full");
  });

  it("every variant renders an icon alongside its label — never colour/label alone", () => {
    (["eliminated", "warm-up"] as const).forEach((state) => {
      const { container, unmount } = render(<PlayerRowBadge state={state} />);
      expect(container.querySelector("svg")).toBeTruthy();
      unmount();
    });
  });
});
