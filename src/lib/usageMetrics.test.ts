// Ported from admin-web/test/usage-model.test.mjs (ileadit engine repo). The
// emulator-switch tests and the coin-ledger replay are not ported: this page has
// no emulator mode and its fixtures are a smaller stand-in (see
// usageMetricsFixtures.ts). The alert-document read IS ported (`alert` path).
import { describe, expect, it } from "vitest";
import {
  SMALL_COMPETITION_MEMBERS,
  USAGE_PATHS,
  addDays,
  buildModel,
  challengeKinds,
  coinTotals,
  firstD30Date,
  fmtCount,
  funnel,
  hasAnyD30,
  isShortSeries,
  jobFailed,
  londonDate,
  normalizeCompetitionsTable,
  normalizeDay,
  normalizeDays,
  normalizeRun,
  knownRunStatus,
  partialDays,
  ofText,
  rangeLimit,
  retentionRows,
  retentionTrend,
  selectRange,
  stickiness,
  trailingAverage,
  weekStart,
} from "./usageMetrics";
import { FIXTURE_NAMES, buildFixture } from "./usageMetricsFixtures";

const NOW = new Date("2026-11-26T12:00:00Z");

function doc(date: string, over: Record<string, unknown> = {}) {
  return {
    date,
    final: true,
    partial: [],
    excluded: { demo: 0, listed: 0, robots: 0 },
    accounts: { total: 5, seeded: 5, inLiveCompetition: 3 },
    signups: 0,
    active: { dau: 2, wau: 4, mau: 5, new: 0, returning: 2, lapsed: 0 },
    activeBySignupAge: {},
    ...over,
  };
}

describe("paths", () => {
  it("reads only the three engine paths", () => {
    expect(USAGE_PATHS.daily).toEqual(["ops", "metrics", "daily"]);
    expect(USAGE_PATHS.live).toEqual(["ops", "metrics", "live", "current"]);
    expect(USAGE_PATHS.runs).toEqual(["ops", "jobRuns", "usageMetrics"]);
    expect(USAGE_PATHS.alert).toEqual(["ops", "alerts", "jobFailed", "usageMetrics"]);
    expect(Object.keys(USAGE_PATHS).sort()).toEqual(["alert", "daily", "live", "runs"]);
  });
});

describe("numbers and text", () => {
  it("counts first, and a percentage only from 20 accounts", () => {
    expect(ofText(3, 5, "accounts")).toBe("3 of 5 accounts");
    expect(ofText(3, 19, "accounts")).toBe("3 of 19 accounts");
    expect(ofText(4, 20, "accounts")).toBe("4 of 20 accounts (20%)");
    expect(ofText(120, 500, "accounts")).toBe("120 of 500 accounts (24%)");
    expect(ofText(0, 0, "accounts")).toBe("0 of 0 accounts");
    expect(ofText(2, 3)).toBe("2 of 3");
    expect(fmtCount(1234567)).toBe("1,234,567");
    expect(fmtCount(NaN)).toBe("-");
    expect(fmtCount(undefined)).toBe("-");
  });

  it("dates: London date of an instant and plain-date arithmetic", () => {
    expect(londonDate(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02");
    expect(londonDate(new Date("2026-12-01T23:30:00Z"))).toBe("2026-12-01");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(weekStart("2026-11-26")).toBe("2026-11-23");
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
  });
});

describe("normalising documents", () => {
  it("an old or malformed document never breaks normalising", () => {
    expect(normalizeDay(null)).toBeNull();
    expect(normalizeDay({})).toBeNull();
    expect(normalizeDay({ date: "2026-13-45" })).toBeNull();
    expect(normalizeDay("x")).toBeNull();
    const old = normalizeDay({ date: "2026-11-01", signups: -4, active: { dau: "many" }, excluded: { demo: 1 } });
    expect(old?.signups).toBe(0);
    expect(old?.dau).toBe(0);
    expect(old?.excluded).toEqual({ demo: 1, listed: 0, robots: 0 });
    expect(old?.funnel7).toBeNull();
    expect(old?.resurrected).toBeNull();
    expect(old?.toolsEnabled).toBeNull();
    expect(old?.partial).toEqual([]);
  });

  it("days are sorted and de-duplicated", () => {
    const days = normalizeDays([doc("2026-11-03"), doc("2026-11-01"), doc("2026-11-03", { signups: 9 }), { nope: 1 }, null]);
    expect(days.map((d) => d.date)).toEqual(["2026-11-01", "2026-11-03"]);
    expect(normalizeDays(undefined)).toEqual([]);
  });

  it("a run keeps only a short allowlist: no message, no run id", () => {
    const run = normalizeRun({
      status: "failed",
      stage: "runUsageMetrics",
      errorCode: 14,
      errorMessage: "secret detail",
      runId: "abc",
      startedAt: new Date("2026-11-26T01:00:00Z"),
    });
    expect(run?.status).toBe("failed");
    expect(run?.stage).toBe("runUsageMetrics");
    expect(run?.errorCode).toBe("14");
    expect(JSON.stringify(run)).not.toMatch(/secret|abc/);
    expect(normalizeRun({ status: "failed", stage: "has spaces and <b>", errorCode: "x".repeat(80) })).toMatchObject({
      stage: null,
      errorCode: null,
    });
    expect(normalizeRun(null)).toBeNull();
  });
});

describe("the view model", () => {
  it("no documents is the empty state, whatever the range", () => {
    for (const rangeKey of ["7", "28", "90", "all", "bogus"]) {
      const m = buildModel({ docs: [], live: null, lastRun: null, now: NOW, rangeKey });
      expect(m.state).toBe("empty");
      expect(m.rows).toEqual([]);
    }
  });

  it("a failed last run is a failed job", () => {
    expect(jobFailed(null)).toBe(false);
    expect(jobFailed({ status: "ok" })).toBe(false);
    expect(jobFailed({ status: "failed" })).toBe(true);
    expect(jobFailed(undefined)).toBe(false);
    // The engine's alert document alone is enough (the run write itself may have failed).
    expect(jobFailed(null, true)).toBe(true);
    expect(jobFailed({ status: "ok" }, true)).toBe(true);
    expect(jobFailed({ status: "ok" }, false)).toBe(false);
  });

  it("range limits read enough history and never open-endedly", () => {
    expect(rangeLimit("7")).toBe(28);
    expect(rangeLimit("28")).toBe(28);
    expect(rangeLimit("90")).toBe(90);
    expect(rangeLimit("all")).toBe(400);
    expect(rangeLimit("nonsense")).toBe(28);
  });

  it("range selection counts calendar days back from the newest document", () => {
    const days = normalizeDays(Array.from({ length: 40 }, (_, i) => doc(addDays("2026-10-01", i))));
    expect(selectRange(days, "7")).toHaveLength(7);
    expect(selectRange(days, "28")).toHaveLength(28);
    expect(selectRange(days, "90")).toHaveLength(40);
    expect(selectRange(days, "all")).toHaveLength(40);
  });

  it("tiles say how many of how many, and flag a provisional yesterday", () => {
    const docs = [doc("2026-11-24"), doc("2026-11-25", { final: false })];
    const live = { dates: { "2026-11-26": 2, "2026-11-25": 3 }, computedAt: new Date("2026-11-26T11:50:00Z") };
    const m = buildModel({ docs, live, lastRun: null, now: NOW, rangeKey: "28" });
    if (m.state !== "ready") throw new Error("expected ready");
    const t = Object.fromEntries(m.tiles.map((x) => [x.key, x]));
    expect(t.today.value).toBe(2);
    expect(t.today.context).toBe("2 of 5 accounts, live");
    expect(t.yesterday.value).toBe(2);
    expect(t.yesterday.context).toBe("2 of 5 accounts, provisional");
    expect(t.wau.context).toBe("4 of 5 accounts");
    expect(t.live.context).toBe("3 of 5 accounts");
  });

  it("a missing live count is a dash with a reason, not a zero", () => {
    const m = buildModel({ docs: [doc("2026-11-25")], live: null, lastRun: null, now: NOW, rangeKey: "28" });
    if (m.state !== "ready") throw new Error("expected ready");
    const today = m.tiles.find((x) => x.key === "today");
    expect(today?.value).toBeNull();
    expect(today?.context).toBe("No live count yet");
  });

  it("short series: fewer than 7 days are listed, not charted", () => {
    expect(isShortSeries(normalizeDays([doc("2026-11-01")]))).toBe(true);
    const six = normalizeDays(Array.from({ length: 6 }, (_, i) => doc(addDays("2026-11-01", i))));
    expect(isShortSeries(six)).toBe(true);
    const seven = normalizeDays(Array.from({ length: 7 }, (_, i) => doc(addDays("2026-11-01", i))));
    expect(isShortSeries(seven)).toBe(false);
  });

  it("the 7-day average needs 14 days and 7 consecutive calendar days", () => {
    const mk = (n: number) =>
      normalizeDays(Array.from({ length: n }, (_, i) => doc(addDays("2026-11-01", i), { active: { dau: i + 1 } })));
    expect(trailingAverage(mk(13))).toEqual([]);
    const avg = trailingAverage(mk(14));
    expect(avg).toHaveLength(8);
    expect(avg[0].value).toBe(4);
    const gappy = normalizeDays(Array.from({ length: 14 }, (_, i) => doc(addDays("2026-11-01", i))).filter((_, i) => i !== 10));
    expect(trailingAverage(gappy).every((a) => a.date < "2026-11-11" || a.date > "2026-11-17")).toBe(true);
  });

  it("stickiness needs 28 days and 20 active players, and says why not", () => {
    const mk = (n: number, mau: number) =>
      normalizeDays(Array.from({ length: n }, (_, i) => doc(addDays("2026-10-01", i), { active: { dau: 10, mau } })));
    expect(stickiness([]).ratio).toBeNull();
    const few = stickiness(mk(20, 40));
    expect(few.ratio).toBeNull();
    expect(few.reason).toMatch(/28 days of data\. This page has 20/);
    const small = stickiness(mk(28, 12));
    expect(small.ratio).toBeNull();
    expect(small.reason).toMatch(/20 players/);
    const ok = stickiness(mk(28, 40));
    expect(ok.ratio).toBe(0.25);
    expect(ok.reason).toBeNull();
  });

  it("funnel sums only final days and only days carrying a cohort", () => {
    const f7 = (created: number, joined: number) => ({
      cohortDate: "2026-10-01",
      created,
      ageConfirmed: created,
      seeded: created,
      synced: created,
      joined,
    });
    const rows = normalizeDays([
      doc("2026-11-01", { funnel7: f7(4, 2) }),
      doc("2026-11-02", { funnel7: f7(6, 3) }),
      doc("2026-11-03", { final: false, funnel7: f7(100, 100) }),
      doc("2026-11-04"),
    ]);
    const f = funnel(rows);
    expect(f.cohorts).toBe(2);
    expect(f.created).toBe(10);
    expect(f.steps.find((s) => s.key === "joined")?.value).toBe(5);
  });

  it("retention: k of N over frozen sign-ups, pending / missing ages, empty cohorts skipped", () => {
    const days = normalizeDays([
      doc("2026-11-01", { signups: 4 }),
      doc("2026-11-02", { activeBySignupAge: { 1: 3 } }),
      doc("2026-11-03", { signups: 0 }),
      doc("2026-11-08", { activeBySignupAge: { 7: 2 } }),
      doc("2026-11-09", { final: false }),
    ]);
    const rows = retentionRows(days, days, "28");
    expect(rows).toHaveLength(1);
    const cells = Object.fromEntries(rows[0].cells.map((c) => [c.n, c]));
    expect(cells[1]).toMatchObject({ state: "ok", k: 3, of: 4 });
    expect(cells[7]).toMatchObject({ state: "ok", k: 2, of: 4 });
    expect(cells[14].state).toBe("none");
    expect(cells[30].state).toBe("none");
  });

  it('retention days older than the snapshots are "none", not 0 of N', () => {
    const days = normalizeDays([doc("2026-11-01", { signups: 5 }), doc("2026-11-20")]);
    const rows = retentionRows(days, days, "28");
    expect(rows[0].cells.find((c) => c.n === 1)?.state).toBe("none");
  });

  it("the retention trend chart needs 8 cohorts and 20 sign-ups", () => {
    const mk = (n: number, signups: number) =>
      normalizeDays(
        Array.from({ length: n }, (_, i) => doc(addDays("2026-10-01", i), { signups, activeBySignupAge: { 1: 1, 7: 1 } })),
      );
    expect(retentionTrend(mk(20, 1)).enough).toBe(false);
    expect(retentionTrend(mk(12, 3)).enough).toBe(true);
    expect(retentionTrend(mk(5, 10)).enough).toBe(false);
    expect(retentionTrend([]).enough).toBe(false);
  });

  it("the first D30 value date is the oldest cohort plus 30 days", () => {
    const days = normalizeDays([doc("2026-11-02"), doc("2026-11-20")]);
    expect(firstD30Date(days)).toBe("2026-12-02");
    expect(firstD30Date([])).toBeNull();
    expect(hasAnyD30([])).toBe(false);
  });

  it("challenge and coin totals, with tool switches from the newest snapshot", () => {
    const base = {
      challenges: { created: { direct: { 75: 1, 100: 2, 125: 3 }, duel: 4, streak: 5 } },
      tools: { forceField: 6, stickTo: 7, enabled: { forceField: false, stickTo: true, duel: true, streak: false } },
      coins: { outstanding: 10, earned: { welcome: 100, competition_payout: 5 }, spent: { "challenge-escrow": 50, mystery: 9 } },
    };
    const rows = normalizeDays([doc("2026-11-01", base), doc("2026-11-02", base)]);
    const kinds = Object.fromEntries(challengeKinds(rows, rows[1]).map((k) => [k.key, k]));
    expect(kinds.d100.total).toBe(4);
    expect(kinds.forceField.total).toBe(12);
    expect(kinds.forceField.off).toBe(true);
    expect(kinds.stickTo.off).toBe(false);
    expect(kinds.d75.off).toBe(false);
    const c = coinTotals(rows);
    expect(c.earned.welcome).toBe(200);
    expect(c.spent["challenge-escrow"]).toBe(100);
    expect(c.spent.other).toBe(0);
    const one = normalizeDays([doc("2026-11-01")]);
    expect(challengeKinds(one, one[0]).every((k) => k.off === false)).toBe(true);
  });
});

describe("the per-competition table", () => {
  it("absent field is null, empty list is an empty table", () => {
    expect(normalizeCompetitionsTable(undefined)).toBeNull();
    expect(normalizeCompetitionsTable(null)).toBeNull();
    expect(normalizeCompetitionsTable("x")).toBeNull();
    expect(normalizeCompetitionsTable([])).toEqual({ list: [], small: null });
    expect(SMALL_COMPETITION_MEMBERS).toBe(5);
  });

  it("keeps listed rows and the small row, counts only", () => {
    const t = normalizeCompetitionsTable([
      { kind: "competition", id: "c1", name: " Office Cup ", status: "finished", members: 12, active: 7, eliminated: 3, joinedViaInvite: 4, uid: "leak", stepsAchieved: 9999 },
      { kind: "small", competitions: 3, members: 9, active: 2, eliminated: 1, joinedViaInvite: 0, name: "Secret Club" },
    ]);
    expect(t?.list).toEqual([{ id: "c1", name: "Office Cup", status: "finished", members: 12, active: 7, eliminated: 3, joinedViaInvite: 4 }]);
    expect(t?.small).toEqual({ competitions: 3, members: 9, active: 2, eliminated: 1, joinedViaInvite: 0 });
    expect(JSON.stringify(t)).not.toMatch(/leak|9999|Secret Club|uid|steps/);
  });

  it("a row under 5 members is never listed or named, even if a document says so", () => {
    const t = normalizeCompetitionsTable([
      { kind: "competition", id: "c1", name: "Four Friends", status: "active", members: 4, active: 1, eliminated: 0, joinedViaInvite: 0 },
      { kind: "competition", id: "c2", name: "Five Friends", status: "active", members: 5, active: 1, eliminated: 0, joinedViaInvite: 0 },
    ]);
    expect(t?.list.map((r) => r.name)).toEqual(["Five Friends"]);
    expect(t?.small).toBeNull();
  });

  it("bad counts become 0, an unknown status is live, a blank name is null, an empty small row is dropped", () => {
    const t = normalizeCompetitionsTable([
      { kind: "competition", id: "c1", name: "   ", status: "weird", members: 6, active: -2, eliminated: "x", joinedViaInvite: NaN },
      { kind: "mystery", members: 50 },
      null,
      { kind: "small", competitions: 0, members: 0, active: 0, eliminated: 0, joinedViaInvite: 0 },
    ]);
    expect(t?.list).toEqual([{ id: "c1", name: null, status: "active", members: 6, active: 0, eliminated: 0, joinedViaInvite: 0 }]);
    expect(t?.small).toBeNull();
  });
});

// The key tree of one daily document as the engine writes it (the `fresh` object
// in fullPass, functions/src/services/usageMetrics.ts). The fixtures must have
// the same, so a page test never runs against a shape the job does not write.
const WRITER_DAILY_KEYS = [
  "v", "date", "final", "backfilled", "partial", "computedAt", "runId",
  "excluded.demo", "excluded.listed", "excluded.robots",
  "accounts.total", "accounts.ageConfirmed", "accounts.seeded", "accounts.everJoined", "accounts.inLiveCompetition",
  "signups", "deletionsDerived",
  "active.dau", "active.wau", "active.mau", "active.new", "active.returning", "active.lapsed",
  "activeBySignupAge",
  "funnel7.cohortDate", "funnel7.created", "funnel7.ageConfirmed", "funnel7.seeded", "funnel7.synced", "funnel7.joined",
  "competitions.scheduled", "competitions.live", "competitions.finishedTotal", "competitions.created", "competitions.finalised",
  "competitions.membersLive", "competitions.joins", "competitions.joinsViaInvite", "competitions.eliminations",
  "competitions.finishers", "competitions.finishedMembers",
  "competitionsTable",
  "challenges.created.direct", "challenges.created.duel", "challenges.created.streak",
  "tools.forceField", "tools.stickTo", "tools.enabled",
  "coins.outstanding", "coins.earned", "coins.spent",
];
const OPAQUE_MAPS = new Set(["activeBySignupAge", "challenges.created.direct", "tools.enabled", "coins.earned", "coins.spent"]);

function keyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v) && !OPAQUE_MAPS.has(p)) {
      out.push(...keyPaths(v as Record<string, unknown>, p));
    } else out.push(p);
  }
  return out;
}

const sumOf = (o: unknown): number => Object.values(o as Record<string, number>).reduce((s, v) => s + v, 0);

describe("fixtures: shape and consistency", () => {
  it("daily documents have exactly the writer key tree", () => {
    for (const name of ["0", "5", "500", "short", "failed"] as const) {
      const f = buildFixture(name, NOW);
      expect(f.daily.length, name).toBeGreaterThan(0);
      for (const { id, data } of f.daily) {
        expect((data as { date: string }).date).toBe(id);
        expect(keyPaths(data).sort(), `${name} ${id}`).toEqual([...WRITER_DAILY_KEYS].sort());
      }
    }
  });

  it("5 players: coins spent never exceed coins earned across the fixture", () => {
    const f = buildFixture("5", NOW);
    const coins = f.daily.map((d) => (d.data as { coins: { earned: unknown; spent: unknown; outstanding: number } }).coins);
    const earned = coins.reduce((s, c) => s + sumOf(c.earned), 0);
    const spent = coins.reduce((s, c) => s + sumOf(c.spent), 0);
    expect(spent).toBeLessThanOrEqual(earned);
    expect(coins[coins.length - 1].outstanding).toBeGreaterThan(0);
    expect(spent).toBeGreaterThan(0);
  });

  it("no table row carries more eliminated or active than members", () => {
    for (const name of ["5", "500"] as const) {
      for (const { data } of buildFixture(name, NOW).daily) {
        const table = (data as { competitionsTable: { members: number; active: number; eliminated: number }[] }).competitionsTable;
        expect(table.length, name).toBeGreaterThan(0);
        for (const r of table) {
          expect(r.active, `${name} ${JSON.stringify(r)}`).toBeLessThanOrEqual(r.members);
          expect(r.eliminated, `${name} ${JSON.stringify(r)}`).toBeLessThanOrEqual(r.members);
        }
      }
    }
  });

  it("only the failed set carries the alert document", () => {
    expect(buildFixture("failed", NOW).alert).not.toBeNull();
    for (const name of ["0", "5", "500", "none", "short"] as const) expect(buildFixture(name, NOW).alert).toBeNull();
  });
});

describe("partialDays", () => {
  const rows = (...partials: string[][]) => partials.map((partial, i) => normalizeDay(doc(`2026-11-0${i + 1}`, { partial }))!);

  it("counts a day for each of the late-written reasons: signups, competitions, coins", () => {
    expect(partialDays(rows(["signups"]))).toBe(1);
    expect(partialDays(rows(["competitions"]))).toBe(1);
    expect(partialDays(rows(["coins"]))).toBe(1);
  });

  it("does not count deletions-only, unknown reasons or complete days; a day counts once", () => {
    expect(partialDays(rows(["deletions"], ["mystery"], []))).toBe(0);
    expect(partialDays(rows(["signups", "competitions", "coins", "deletions"], ["coins"], []))).toBe(2);
  });
});

describe("run status", () => {
  it("knows ok, failed and running; anything else is null", () => {
    expect(knownRunStatus("ok")).toBe("ok");
    expect(knownRunStatus("failed")).toBe("failed");
    expect(knownRunStatus("running")).toBe("running");
    for (const bad of ["OK", "done", "", null, undefined, 1, {}]) expect(knownRunStatus(bad)).toBeNull();
  });
});

describe("fixtures", () => {
  it("sizes, provisional days, robots, stuck day, failed and empty states", () => {
    const five = buildFixture("5", NOW);
    expect(five.daily.length).toBeGreaterThanOrEqual(21);
    const last = five.daily[five.daily.length - 1].data as { final: boolean; date: string; accounts: { total: number } };
    expect(last.final).toBe(false);
    expect(five.daily.some((d) => (d.data as { final: boolean; excluded: { robots: number } }).final && (d.data as { excluded: { robots: number } }).excluded.robots > 0)).toBe(true);
    expect(five.daily.some((d) => !(d.data as { final: boolean }).final && (d.data as { date: string }).date < addDays(last.date, -5))).toBe(true);
    expect(last.accounts.total).toBe(5);
    const big = buildFixture("500", NOW).daily;
    expect((big[big.length - 1].data as { accounts: { total: number } }).accounts.total).toBe(500);
    const zero = buildFixture("0", NOW).daily;
    expect((zero[zero.length - 1].data as { accounts: { total: number } }).accounts.total).toBe(0);
    expect(buildFixture("none", NOW).daily).toHaveLength(0);
    expect(buildFixture("short", NOW).daily).toHaveLength(3);
    expect(buildFixture("failed", NOW).runs[0].status).toBe("failed");
  });

  it("are deterministic and carry no step figures", () => {
    const a = JSON.stringify(buildFixture("5", NOW));
    expect(a).toBe(JSON.stringify(buildFixture("5", NOW)));
    expect(a).not.toMatch(/steps|average/i);
  });

  it("every fixture builds a model without throwing, in every range", () => {
    for (const name of FIXTURE_NAMES) {
      const f = buildFixture(name, NOW);
      for (const rangeKey of ["7", "28", "90", "all"]) {
        const m = buildModel({ docs: f.daily.map((d) => d.data), live: f.live, lastRun: f.runs[0] ?? null, now: NOW, rangeKey });
        expect(m.state).toBe(f.daily.length === 0 ? "empty" : "ready");
      }
    }
  });

  it("the 5-player set has a listed and a folded competition, the 500 set several of each", () => {
    const table = (n: "5" | "500") => {
      const d = buildFixture(n, NOW).daily;
      return normalizeDay(d[d.length - 1].data)?.competitionsTable;
    };
    const five = table("5");
    expect(five?.list).toHaveLength(1);
    expect(five?.small?.competitions).toBe(1);
    const big = table("500");
    expect(big?.list.length).toBeGreaterThanOrEqual(3);
    expect(big?.small?.competitions).toBe(3);
    expect(big?.list.every((r) => r.members >= 5)).toBe(true);
    expect(big?.list.map((r) => r.members)).toEqual([...(big?.list.map((r) => r.members) ?? [])].sort((a, b) => b - a));
    expect(big?.list.some((r) => r.status === "finished")).toBe(true);
    expect(big?.list.some((r) => r.status === "active")).toBe(true);
  });
});
