import { describe, expect, it } from "vitest";
import { lineGeometry, niceScale, stackedGeometry, twoSidedGeometry, xTicks, dateSpan } from "./usageCharts";
import { normalizeDays } from "./usageMetrics";
import { buildFixture } from "./usageMetricsFixtures";

const NOW = new Date("2026-11-26T12:00:00Z");

function rowsFor(name: "5" | "500" | "0") {
  return normalizeDays(buildFixture(name, NOW).daily.map((d) => d.data));
}

describe("niceScale", () => {
  it("axis scales are whole numbers from zero with at most four steps", () => {
    for (const max of [0, 1, 3, 7, 12, 99, 154, 437, 1234, 98765]) {
      const s = niceScale(max);
      expect(s.ticks[0]).toBe(0);
      expect(s.top).toBeGreaterThanOrEqual(max);
      expect(s.ticks.length).toBeLessThanOrEqual(5);
      expect(s.ticks.every(Number.isInteger)).toBe(true);
    }
    expect(niceScale(NaN).top).toBe(2);
  });
});

describe("axis helpers", () => {
  it("dateSpan fills calendar gaps; xTicks counts back from the newest", () => {
    expect(dateSpan([{ date: "2026-11-01" }, { date: "2026-11-04" }])).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
    ]);
    expect(dateSpan([])).toEqual([]);
    const ticks = xTicks(dateSpan([{ date: "2026-10-01" }, { date: "2026-11-26" }]), 394);
    expect(ticks[ticks.length - 1]).toBe(56);
  });
});

describe("geometry tolerates thin and empty input", () => {
  it("a single row and an empty range do not throw", () => {
    const one = rowsFor("5").slice(-1);
    expect(() =>
      lineGeometry({
        rows: one,
        series: [{ name: "x", cls: "line-main", points: one.map((r) => ({ date: r.date, value: r.dau, provisional: false })) }],
        width: 440,
      }),
    ).not.toThrow();
    expect(() =>
      stackedGeometry({ rows: [], keys: [{ key: "signups", label: "s", cat: 1 }], value: () => 0, width: 440 }),
    ).not.toThrow();
    expect(() => twoSidedGeometry({ rows: [], width: 440 })).not.toThrow();
  });

  it("no geometry value is NaN, for 500 players or none", () => {
    for (const name of ["500", "0"] as const) {
      const rows = rowsFor(name);
      const g = stackedGeometry({
        rows,
        keys: [{ key: "signups", label: "Sign-ups", cat: 1 }],
        value: (r) => r.signups,
        width: 440,
      });
      const t = twoSidedGeometry({ rows, width: 440 });
      expect(JSON.stringify([g, t])).not.toMatch(/NaN|Infinity|undefined/);
    }
  });
});

describe("provisional days", () => {
  it("are flagged in bars and dashed in lines", () => {
    const rows = rowsFor("5");
    const bars = stackedGeometry({ rows, keys: [{ key: "dau", label: "Active", cat: 1 }], value: (r) => r.dau, width: 440 });
    expect(bars.bars.some((b) => b.provisional)).toBe(true);
    expect(bars.bars.some((b) => !b.provisional)).toBe(true);
    expect(bars.bars.find((b) => b.provisional)?.title).toMatch(/\(provisional\)/);
    const line = lineGeometry({
      rows,
      series: [{ name: "active", cls: "line-main", points: rows.map((r) => ({ date: r.date, value: r.dau, provisional: !r.final })) }],
      width: 440,
    });
    expect(line.series[0].dashed).not.toBe("");
    expect(line.series[0].solid).not.toBe("");
  });
});
