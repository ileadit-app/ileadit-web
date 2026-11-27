// Render checks for the admin usage page, ported from
// admin-web/test/usage-render.test.mjs (ileadit engine repo): the written empty
// states, markers and meanings, run against fixture models.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildModel } from "@/lib/usageMetrics";
import { buildFixture, type FixtureName } from "@/lib/usageMetricsFixtures";
import { CompetitionTable, UsageBanner, UsageContent, UsageEmpty, UsageLastRun, UsageMeta } from "./UsageView";

const NOW = new Date("2026-11-26T12:00:00Z");

function modelFor(name: FixtureName, rangeKey = "28", mapDocs?: (docs: Record<string, unknown>[]) => unknown[]) {
  const f = buildFixture(name, NOW);
  const docs = f.daily.map((d) => d.data);
  return buildModel({ docs: mapDocs ? mapDocs(docs) : docs, live: f.live, lastRun: f.runs[0] ?? null, now: NOW, rangeKey });
}

const content = (name: FixtureName, range = "28") => render(<UsageContent model={modelFor(name, range)} />);

describe("written states", () => {
  it("no snapshot at all says the nightly job has not run yet", () => {
    const m = modelFor("none");
    expect(m.state).toBe("empty");
    const { container } = render(
      <>
        <UsageMeta model={m} />
        <UsageContent model={m} />
      </>,
    );
    expect(screen.getByText("The nightly job has not run yet.")).toBeInTheDocument();
    expect(screen.getByText("No data yet")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Excluded|Data to/);
    expect(container.querySelector("svg[role=img]")).toBeNull();
  });

  it("an empty page with a recorded run says when it last ran", () => {
    const m = buildModel({ docs: [], live: null, lastRun: { status: "ok", startedAt: new Date("2026-11-26T01:00:00Z") }, now: NOW, rangeKey: "28" });
    render(<UsageEmpty model={m} />);
    expect(screen.getByText(/Its last recorded run was 26 Nov 2026 01:00 UTC\./)).toBeInTheDocument();
  });

  it("a failed job shows a banner and keeps the last good numbers", () => {
    const m = modelFor("failed");
    const { container } = render(
      <>
        <UsageBanner model={m} />
        <UsageContent model={m} />
      </>,
    );
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("The nightly job failed");
    expect(banner).toHaveTextContent("The last good snapshot is for 25 Nov 2026");
    expect(screen.getByRole("heading", { name: "Activity" })).toBeInTheDocument();
    expect(container.querySelectorAll("[role=alert]")).toHaveLength(1);
  });

  it("no banner when the last run succeeded", () => {
    render(<UsageBanner model={modelFor("5")} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a failed job with no snapshot says so", () => {
    const m = buildModel({ docs: [], live: null, lastRun: { status: "failed", startedAt: new Date("2026-11-26T11:20:00Z") }, now: NOW, rangeKey: "28" });
    render(<UsageBanner model={m} />);
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("There is no snapshot to show yet.");
    expect(banner).toHaveTextContent("26 Nov 2026 11:20 UTC");
  });

  it("the banner shows stage and error code as text, never the message or run id", () => {
    const lastRun = {
      status: "failed",
      startedAt: new Date("2026-11-26T11:20:00Z"),
      failedAt: new Date("2026-11-26T11:21:00Z"),
      stage: "runUsageMetrics",
      errorCode: "unavailable",
      errorMessage: "SECRET-MESSAGE-TEXT with detail",
      jobRunId: "run-SECRET-ID-123",
    };
    render(<UsageBanner model={buildModel({ docs: [], live: null, lastRun, now: NOW, rangeKey: "28" })} />);
    const text = screen.getByRole("alert").textContent ?? "";
    expect(text).toMatch(/Stage: runUsageMetrics\./);
    expect(text).toMatch(/Error code: unavailable\./);
    expect(text).not.toMatch(/SECRET/);
  });

  it("the banner without stage or error code shows neither label", () => {
    const lastRun = { status: "failed", startedAt: new Date("2026-11-26T11:20:00Z"), errorMessage: "SECRET", jobRunId: "run-SECRET" };
    render(<UsageBanner model={buildModel({ docs: [], live: null, lastRun, now: NOW, rangeKey: "28" })} />);
    const text = screen.getByRole("alert").textContent ?? "";
    expect(text).not.toMatch(/Stage:|Error code:|SECRET|undefined|null/);
    expect(text).toMatch(/The nightly job failed at 26 Nov 2026 11:20 UTC\./);
  });

  it("a numeric error code (gRPC style) is shown; other non-strings are not", () => {
    const show = (errorCode: unknown) => {
      const lastRun = { status: "failed", startedAt: new Date("2026-11-26T11:20:00Z"), stage: "runUsageMetrics", errorCode };
      const { unmount } = render(<UsageBanner model={buildModel({ docs: [], live: null, lastRun, now: NOW, rangeKey: "28" })} />);
      const text = screen.getByRole("alert").textContent ?? "";
      unmount();
      return text;
    };
    expect(show(14)).toMatch(/Stage: runUsageMetrics\. Error code: 14\./);
    expect(show(0)).toMatch(/Error code: 0\./);
    for (const bad of [1.5, -1, 1e6, NaN, Infinity, { code: 1 }, [14], true]) expect(show(bad)).not.toMatch(/Error code:/);
  });

  it("the last-run line names the outcome, and stays out of the way of the failure banner", () => {
    const ok = modelFor("5");
    const { unmount } = render(<UsageLastRun run={ok.lastRun} />);
    expect(screen.getByTestId("last-run")).toHaveTextContent(/^Last run: ok at 26 Nov 2026/);
    expect(screen.getByTestId("last-run")).not.toHaveTextContent(/nightly/i);
    unmount();
    render(<UsageLastRun run={modelFor("failed").lastRun} />);
    expect(screen.queryByTestId("last-run")).toBeNull();
  });

  it("the last-run status is shown only when known; anything else reads unknown", () => {
    const at = new Date("2026-11-26T01:00:00Z");
    for (const status of ["ok", "running"]) {
      const { unmount } = render(<UsageLastRun run={{ status, stage: null, errorCode: null, startedAt: at, finishedAt: null, failedAt: null }} />);
      expect(screen.getByTestId("last-run")).toHaveTextContent(`Last run: ${status} at`);
      unmount();
    }
    for (const status of ["weird", "<b>x</b>", "OK", null]) {
      const { unmount } = render(<UsageLastRun run={{ status, stage: null, errorCode: null, startedAt: at, finishedAt: null, failedAt: null }} />);
      const line = screen.getByTestId("last-run");
      expect(line).toHaveTextContent("Last run: unknown at");
      expect(line.textContent).not.toMatch(/weird|<b>|OK/);
      unmount();
    }
  });

  it("the banner shows for the alert document alone, with no stage or code from an ok run", () => {
    const f = buildFixture("5", NOW);
    const m = buildModel({ docs: f.daily.map((d) => d.data), live: f.live, lastRun: f.runs[0], alertPresent: true, now: NOW, rangeKey: "28" });
    expect(m.failed).toBe(true);
    render(<UsageBanner model={m} />);
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("The nightly job failed.");
    expect(banner).not.toHaveTextContent(/Stage:|Error code:/);
  });

  it("long stage and error-code identifiers wrap instead of widening the page", () => {
    const m = modelFor("failed");
    const long = "A".repeat(58);
    const run = { ...m.lastRun!, stage: long, errorCode: long };
    render(<UsageBanner model={{ ...m, lastRun: run }} />);
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent(long);
    expect(banner.className).toMatch(/break-words/);
    expect(banner.className).toMatch(/overflow-wrap:anywhere/);
  });

  it("the excluded line lists demo, listed and robots separately", () => {
    const { container } = render(<UsageMeta model={modelFor("5")} />);
    expect(container.textContent).toContain("Excluded accounts: 1 demo, 2 listed, 3 robots.");
    const zero = render(<UsageMeta model={modelFor("0")} />);
    expect(zero.container.textContent).toContain("No accounts are excluded.");
    const only = buildModel({
      docs: [{ date: "2026-11-25", final: true, excluded: { demo: 0, listed: 0, robots: 7 } }],
      live: null,
      lastRun: null,
      now: NOW,
      rangeKey: "28",
    });
    const o = render(<UsageMeta model={only} />);
    expect(o.container.textContent).toMatch(/0 demo, 0 listed, 7 robots/);
  });
});

describe("tiles", () => {
  it("are counts first with 'k of n'", () => {
    content("5");
    const tiles = screen.getByRole("region", { name: "Headline numbers" });
    expect(tiles).toHaveTextContent("Active yesterday");
    expect(tiles.textContent).toMatch(/\d of 5 accounts/);
    expect(tiles.textContent).not.toMatch(/\d%/);
  });

  it("show a percentage from 20 accounts", () => {
    content("500");
    expect(screen.getByRole("region", { name: "Headline numbers" }).textContent).toMatch(/\d+ of 500 accounts \(\d+%\)/);
  });
});

describe("charts and series", () => {
  it("the 3-day set lists day values instead of drawing charts", () => {
    const { container } = content("short");
    expect(container.querySelectorAll("svg[role=img]")).toHaveLength(0);
    expect(screen.getAllByTestId("day-values").length).toBeGreaterThan(0);
    expect(container.textContent).toMatch(/Fewer than 7 days of data, so the days are listed instead of charted\./);
    const text = screen.getAllByTestId("day-values")[0].textContent ?? "";
    expect(text).toMatch(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+/);
    expect(text).toMatch(/\(provisional\)/);
  });

  it("charts are inline SVG with a label and title, and nothing external", () => {
    const { container } = content("5");
    const charts = Array.from(container.querySelectorAll("svg[role=img]"));
    expect(charts.length).toBeGreaterThanOrEqual(3);
    for (const s of charts) {
      expect(s.getAttribute("aria-label")).toBeTruthy();
      expect(s.querySelector("title")).not.toBeNull();
    }
    expect(container.innerHTML).not.toMatch(/https?:\/\//);
    expect(container.querySelector("script, img, iframe, a[href]")).toBeNull();
  });

  it("provisional days are drawn differently from final days", () => {
    const { container } = content("5");
    expect(container.querySelectorAll("[data-provisional=true]").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("[data-dashed=true]").length).toBeGreaterThan(0);
  });

  it("500 players render in every range and stay free of NaN", () => {
    for (const range of ["7", "28", "90", "all"]) {
      const { container, unmount } = content("500", range);
      expect(container.textContent).not.toMatch(/NaN|undefined|Infinity/);
      expect(container.innerHTML).not.toMatch(/NaN|undefined|Infinity/);
      expect(container.querySelectorAll("svg[role=img]").length).toBeGreaterThanOrEqual(3);
      unmount();
    }
  });

  it("charts are drawn 1:1 at their width (1 unit = 1 CSS px) with axis text of at least 11px", () => {
    const { container } = content("500");
    const svgs = Array.from(container.querySelectorAll("svg[role=img]"));
    expect(svgs.length).toBeGreaterThanOrEqual(3);
    for (const s of svgs) {
      const w = s.getAttribute("width");
      expect(s.getAttribute("viewBox")).toBe(`0 0 ${w} ${s.getAttribute("height")}`);
      const sizes = Array.from(s.querySelectorAll("text")).map((t) => Number(t.getAttribute("font-size")));
      expect(sizes.length).toBeGreaterThan(0);
      for (const size of sizes) expect(size).toBeGreaterThanOrEqual(11);
    }
  });

  it("a chart follows its container's measured width, clamped, so a phone does not shrink the text", () => {
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    try {
      for (const [measured, drawn] of [[288, 288], [100, 240], [2000, 672]] as const) {
        spy.mockReturnValue({ width: measured, height: 0, x: 0, y: 0, top: 0, left: 0, right: measured, bottom: 0, toJSON: () => ({}) });
        const { container, unmount } = content("500");
        for (const s of Array.from(container.querySelectorAll("svg[role=img]"))) {
          expect(s.getAttribute("width")).toBe(String(drawn));
          expect(s.getAttribute("viewBox")).toBe(`0 0 ${drawn} ${s.getAttribute("height")}`);
          for (const t of Array.from(s.querySelectorAll("text"))) expect(Number(t.getAttribute("font-size"))).toBeGreaterThanOrEqual(11);
        }
        unmount();
      }
    } finally {
      spy.mockRestore();
    }
  });

  it("provisional bars have a dashed outline as well as lower opacity", () => {
    const { container } = content("5");
    const bars = Array.from(container.querySelectorAll("rect[data-provisional=true]"));
    expect(bars.length).toBeGreaterThan(0);
    for (const b of bars) {
      expect(b.getAttribute("stroke-dasharray")).toBeTruthy();
      expect(b.getAttribute("stroke")).toBeTruthy();
      expect(Number(b.getAttribute("opacity"))).toBeLessThan(1);
    }
    const finals = Array.from(container.querySelectorAll("svg[role=img] rect[fill]:not([data-provisional])"));
    for (const r of finals) expect(r.getAttribute("stroke-dasharray")).toBeNull();
  });
});

describe("narrow screens", () => {
  it("every scroll box that holds sr-only text is positioned, so it cannot widen the page", () => {
    for (const name of ["5", "500", "failed"] as const) {
      const { container, unmount } = content(name);
      const boxes = Array.from(container.querySelectorAll(".overflow-x-auto"));
      expect(boxes.length, name).toBeGreaterThanOrEqual(2);
      for (const box of boxes) expect(box.className, name).toMatch(/(^|\s)relative(\s|$)/);
      unmount();
    }
  });

  it("retention cells that include a provisional day say so to a screen reader", () => {
    const { container } = content("5");
    const cells = Array.from(container.querySelectorAll("td[data-provisional=true]"));
    expect(cells.length).toBeGreaterThan(0);
    for (const td of cells) {
      const sr = td.querySelector("span.sr-only");
      expect(sr).not.toBeNull();
      expect(sr).toHaveTextContent("(provisional)");
    }
    expect(container.querySelectorAll("td:not([data-provisional=true]) .sr-only")).toHaveLength(0);
  });
});

describe("sections", () => {
  it("every section is present, with sentences not NaN, on the 0-player set", () => {
    const { container } = content("0");
    for (const name of ["Activity", "Sign-ups and funnel", "Retention", "Competitions", "Challenges and tools", "Coins"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    expect(container.textContent).not.toMatch(/NaN|undefined|Infinity/);
  });

  it("retention shows 'k of N' cells and the D30 sentence", () => {
    const { container } = content("5");
    expect(container.textContent).toMatch(/\d of \d/);
    expect(container.textContent).toMatch(/Day 30 retention needs 31 days of history\. First value on \d+ \w+ \d{4}\./);
  });

  it("stickiness is withheld with a reason for 5 players", () => {
    const { container } = content("5");
    expect(container.textContent).toMatch(/Stickiness (needs|is hidden)/);
  });

  it("a field the v1 job does not write is not drawn as zero", () => {
    const { container } = content("5");
    expect(container.textContent).toMatch(/not recorded/i);
  });

  it("a rendered page carries no step figure", () => {
    for (const name of ["5", "500", "0"] as const) {
      const { container, unmount } = render(
        <>
          <UsageMeta model={modelFor(name)} />
          <UsageContent model={modelFor(name)} />
        </>,
      );
      expect(container.textContent).not.toMatch(
        /\d\s*steps?\b|steps?\s*[:=]\s*\d|stepsAchieved|dailyAverage|average steps/i,
      );
      unmount();
    }
  });

  it("shows no uid or email", () => {
    const { container } = content("500");
    expect(container.textContent).not.toMatch(/@|\buid\b/i);
  });
});

describe("the coins chart and legend", () => {
  it("give every reason its own colour", () => {
    const every = {
      outstanding: 500,
      earned: { welcome: 150, competition_payout: 300, refunds: 50, other: 20 },
      spent: { "challenge-escrow": 100, "challenge-bounce": 25, "challenge-pass": 40, "force-field-purchase": 250, "stick-to-purchase": 150, other: 10 },
    };
    const model = modelFor("500", "28", (docs) => docs.map((d) => ({ ...d, coins: every })));
    const { container } = render(<UsageContent model={model} />);
    const coins = container.querySelector("#coins") as HTMLElement;
    const legend = within(coins).getByRole("list", { name: "Legend" });
    const items = Array.from(legend.querySelectorAll("li"));
    expect(items).toHaveLength(10);
    const fills = items.map((li) => li.querySelector("rect")?.getAttribute("fill") ?? "");
    expect(new Set(fills).size).toBe(10);
    expect(fills.every((f) => /^var\(--usage-cat-\d+\)$/.test(f))).toBe(true);
    const bars = Array.from(coins.querySelectorAll("svg[role=img] rect[fill]")).map((r) => r.getAttribute("fill"));
    expect(new Set(bars)).toEqual(new Set(fills));
  });
});

describe("the per-competition table", () => {
  const rowsOf = (table: HTMLElement) =>
    Array.from(table.querySelectorAll("tbody tr")).map((tr) => Array.from(tr.children).map((c) => c.textContent ?? ""));

  it("shows headed columns, listed rows biggest first, and the small row last", () => {
    content("500");
    const table = screen.getByTestId("by-competition");
    const heads = Array.from(table.querySelectorAll("thead th")).map((t) => t.textContent);
    expect(heads).toEqual(["Competition", "Status", "Members", "Active", "Eliminated", "Joined by invite"]);
    const rows = rowsOf(table);
    expect(rows[0][0]).toBe("Autumn Stride");
    expect(rows[0].slice(1, 3)).toEqual(["Live", "89"]);
    expect(rows.some((r) => r[0] === "Harbour Loop" && r[1] === "Finished")).toBe(true);
    const last = rows[rows.length - 1];
    expect(last[0]).toBe("3 small competitions (under 5 members)");
    expect(last[1]).toBe("-");
    expect(screen.getAllByTestId("small-row")).toHaveLength(1);
    const sizes = rows.slice(0, -1).map((r) => Number(r[2].replace(/,/g, "")));
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    expect(screen.getByText("Competitions that finished")).toBeInTheDocument();
  });

  it("5 players: one listed and one folded competition, the single folded one is singular", () => {
    content("5");
    const rows = rowsOf(screen.getByTestId("by-competition"));
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe("Autumn Stride");
    expect(rows[1][0]).toBe("1 small competition (under 5 members)");
  });

  it("no small row when nothing was folded; empty and not-recorded states are written out", () => {
    const one = render(
      <CompetitionTable
        date="2026-11-25"
        table={{ list: [{ id: "a", name: "Solo Cup", status: "active", members: 7, active: 2, eliminated: 0, joinedViaInvite: 1 }], small: null }}
      />,
    );
    expect(rowsOf(screen.getByTestId("by-competition"))).toEqual([["Solo Cup", "Live", "7", "2", "0", "1"]]);
    expect(screen.queryByTestId("small-row")).toBeNull();
    one.unmount();
    const none = render(<CompetitionTable date="2026-11-25" table={{ list: [], small: null }} />);
    expect(screen.queryByTestId("by-competition")).toBeNull();
    expect(none.container.textContent).toMatch(/No competition was live or finished on this day\./);
    none.unmount();
    const old = render(<CompetitionTable date="2026-11-25" table={null} />);
    expect(old.container.textContent).toMatch(/This day has no per-competition table/);
    old.unmount();
    render(<CompetitionTable date="2026-11-25" table={{ list: [], small: { competitions: 2, members: 6, active: 1, eliminated: 0, joinedViaInvite: 0 } }} />);
    expect(rowsOf(screen.getByTestId("by-competition"))).toEqual([["2 small competitions (under 5 members)", "-", "6", "1", "0", "0"]]);
  });

  it("a competition name is text, never markup", () => {
    const payload = "<img src=x onerror=alert(1)>";
    const { container } = render(
      <CompetitionTable
        date="2026-11-25"
        table={{ list: [{ id: "abcdef-uid-4242", name: payload, status: "active", members: 9, active: 1, eliminated: 0, joinedViaInvite: 0 }], small: null }}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain(payload);
  });

  it("the id is never shown, and a folded row never shows a competition name", () => {
    const { container } = content("500");
    const table = screen.getByTestId("by-competition");
    expect(table.textContent).not.toMatch(/fx-/);
    const small = screen.getByTestId("small-row");
    for (const name of ["Corner Shop Crew", "Bridge Club", "Allotment Gang"]) {
      expect(container.textContent).not.toContain(name);
      expect(small.textContent).not.toContain(name);
    }
  });
});
