import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayCard } from "./TodayCard";
import type { OwnPlayerData } from "@/lib/competitionDetail";

/**
 * Pins the Today Card's render states (ticket W7-TODAY), each mutation-proven
 * (mutate the source, confirm RED, revert, confirm GREEN — see the ticket's
 * findings for the log). Mocks only the module boundaries `TodayCard`
 * actually reads: `@/lib/todayCard` (`useAccountGameState`) and
 * `@/lib/gameConfig` (`useWarmupDaysConfig`) — `resolveWarmupStatus` itself
 * is the REAL function, not mocked, so these tests also exercise the real
 * wiring between the two hooks and the pure calculation, not just the
 * component's own conditionals.
 *
 * MUT-AVERAGE-NULL-VS-SET pins the one privacy-compliant substitute this
 * ticket could build for the design spec's `steps: null` vs `steps: 0`
 * no-data rule (see `src/lib/todayCard.ts`'s header for why the literal ask
 * is blocked): `private/game.average === null` must render distinctly from
 * a resolved average, using ONLY the field's existence, never its number.
 */

const useAccountGameStateMock = vi.fn();
vi.mock("@/lib/todayCard", async () => {
  const actual = await vi.importActual<typeof import("@/lib/todayCard")>("@/lib/todayCard");
  return {
    ...actual,
    useAccountGameState: () => useAccountGameStateMock(),
  };
});

const useWarmupDaysConfigMock = vi.fn();
vi.mock("@/lib/gameConfig", () => ({
  useWarmupDaysConfig: () => useWarmupDaysConfigMock(),
}));

function player(overrides: Partial<OwnPlayerData> = {}): OwnPlayerData {
  return {
    displayName: "Amy",
    avatarIndex: 0,
    points: 4200,
    todayPoints: 380,
    livesRemaining: 3,
    eliminated: false,
    ...overrides,
  };
}

beforeEach(() => {
  useAccountGameStateMock.mockReset();
  useWarmupDaysConfigMock.mockReset();
  useAccountGameStateMock.mockReturnValue({ status: "loading" });
  useWarmupDaysConfigMock.mockReturnValue({ status: "loading" });
});

describe("TodayCard", () => {
  it("MUT-ELIMINATED: an eliminated player sees the locked-in copy, not the points-today framing", () => {
    render(<TodayCard uid="u1" player={player({ eliminated: true, points: 7000, todayPoints: 0 })} />);

    expect(screen.getByText(/out — final score locked in/i)).toBeInTheDocument();
    expect(screen.getByText(/7000 points locked in/i)).toBeInTheDocument();
    expect(screen.queryByText(/points today/i)).not.toBeInTheDocument();
  });

  it("MUT-WARMUP-PILL: an active warm-up shows the Day N of 7 pill, the warm-up copy, and the shield (not heart pips)", () => {
    useAccountGameStateMock.mockReturnValue({
      status: "success",
      state: {
        averageEstablished: false,
        timeZone: "Europe/London",
        firstDay: "2026-09-18",
        warmupEndsOn: "2026-09-24",
      },
    });
    useWarmupDaysConfigMock.mockReturnValue({ status: "success", warmupDays: 7 });

    render(<TodayCard uid="u1" player={player({ todayPoints: 120 })} />);

    expect(screen.getByText(/warm-up · day 3 of 7/i)).toBeInTheDocument();
    expect(screen.getByText(/no lives on the line yet/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/protected during warm-up/i)).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
  });

  it("MUT-AVERAGE-NULL-VS-SET (no data): before an average is established, shows the 'finding your rhythm' copy", () => {
    useAccountGameStateMock.mockReturnValue({
      status: "success",
      state: { averageEstablished: false, timeZone: "Europe/London", firstDay: null, warmupEndsOn: null },
    });
    useWarmupDaysConfigMock.mockReturnValue({ status: "success", warmupDays: 7 });

    render(<TodayCard uid="u1" player={player()} />);

    expect(screen.getByText(/still finding your rhythm/i)).toBeInTheDocument();
  });

  it("MUT-AVERAGE-NULL-VS-SET (has data): once an average is established, the 'finding your rhythm' copy must NOT render — a real value must not look like no-data", () => {
    useAccountGameStateMock.mockReturnValue({
      status: "success",
      state: { averageEstablished: true, timeZone: "Europe/London", firstDay: null, warmupEndsOn: null },
    });
    useWarmupDaysConfigMock.mockReturnValue({ status: "success", warmupDays: 7 });

    render(<TodayCard uid="u1" player={player()} />);

    expect(screen.queryByText(/still finding your rhythm/i)).not.toBeInTheDocument();
  });

  it("MUT-LIVES-PIPS: outside warm-up, renders exactly livesRemaining filled hearts out of 3", () => {
    useAccountGameStateMock.mockReturnValue({
      status: "success",
      state: { averageEstablished: true, timeZone: "Europe/London", firstDay: null, warmupEndsOn: null },
    });
    useWarmupDaysConfigMock.mockReturnValue({ status: "success", warmupDays: 7 });

    render(<TodayCard uid="u1" player={player({ livesRemaining: 1 })} />);

    expect(screen.getByLabelText(/1 of 3 lives remaining/i)).toBeInTheDocument();
    const { container } = render(<TodayCard uid="u1" player={player({ livesRemaining: 1 })} />);
    const filled = container.querySelectorAll(".fill-brand-coral");
    expect(filled.length).toBe(1);
  });

  it("does not show the todayPoints figure as the eliminated player's headline number", () => {
    render(<TodayCard uid="u1" player={player({ eliminated: true, todayPoints: 999 })} />);

    expect(screen.queryByText("999")).not.toBeInTheDocument();
  });

  /**
   * W9-A11Y. `aria-label` on a plain `<div>` (implicit `role="generic"`) is
   * not reliably exposed as an accessible name by screen readers — it needs
   * an explicit `role="img"` alongside it (same bug/fix pattern as
   * `CompetitionLeaderboard.tsx`'s `RankBadge`). `getByLabelText` above
   * (MUT-LIVES-PIPS) only checks the `aria-label` attribute directly and
   * would pass whether or not `role="img"` is present, so it does NOT pin
   * this fix — this test uses `getByRole("img", { name })` instead, which
   * does require the role. Mutation-proven: removed `role="img"` from the
   * lives-indicator div in `TodayCard.tsx`, confirmed RED, reverted,
   * confirmed GREEN.
   */
  it("MUT-A11Y-LIVES-IMG-ROLE: the lives indicator exposes an img role, not just a bare aria-label on a generic div", () => {
    useAccountGameStateMock.mockReturnValue({
      status: "success",
      state: { averageEstablished: true, timeZone: "Europe/London", firstDay: null, warmupEndsOn: null },
    });
    useWarmupDaysConfigMock.mockReturnValue({ status: "success", warmupDays: 7 });

    render(<TodayCard uid="u1" player={player({ livesRemaining: 2 })} />);

    expect(screen.getByRole("img", { name: /2 of 3 lives remaining/i })).toBeInTheDocument();
  });
});
