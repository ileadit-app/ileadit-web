// Deterministic, made-up usage documents for the tests of the admin usage page
// (WEB-PORTAL-USAGE-1). Pure: no Firebase, no I/O, no randomness. Shaped like the
// documents the engine's nightly job writes to `ops/metrics/daily/*`, so the page
// is exercised against the real layout. Counts only: no step figure exists in the
// shape and none is invented here. Not imported by any page.
//
// This is a smaller stand-in for the old viewer's `usage-fixtures.mjs` (which
// simulated a population); the sets keep the same names and the properties the
// reference tests rely on (provisional yesterday, a stuck old day, robots
// excluded on recent days, a listed and a folded competition).

import { addDays, londonDate } from "./usageMetrics";

export const FIXTURE_NAMES = ["0", "5", "500", "none", "failed", "short"] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];

type Obj = Record<string, unknown>;

export interface FixtureSet {
  daily: { id: string; data: Obj }[];
  live: { dates: Record<string, number>; computedAt: Date } | null;
  /** Newest first, as the page reads them. */
  runs: Obj[];
}

const FINAL_HOUR_UTC = 22;

/** The instant a game day becomes final: 22:00 UTC on the next calendar day. */
export function finalAt(date: string): Date {
  return new Date(Date.parse(`${addDays(date, 1)}T00:00:00Z`) + FINAL_HOUR_UTC * 3600000);
}

const AGE_KEYS = [...Array.from({ length: 31 }, (_, i) => String(i)), "31-60", "61-90", "91+", "unknown"];
const EARNED = ["welcome", "competition_payout", "refunds", "other"];
const SPENT = ["challenge-escrow", "challenge-bounce", "challenge-pass", "force-field-purchase", "stick-to-purchase", "other"];
const zero = (keys: string[]): Record<string, number> => Object.fromEntries(keys.map((k) => [k, 0]));

interface Shape {
  /** Accounts at the newest day. */
  players: number;
  /** Daily documents. */
  days: number;
  /** Sign-ups per day while the population grows. */
  signupsPerDay: number;
  /** Listed competitions (>= 5 members) on the newest day. */
  table: Obj[];
}

function tableFor(name: FixtureName): Obj[] {
  if (name === "500") {
    return [
      { kind: "competition", id: "fx-live", name: "Autumn Stride", status: "active", members: 89, active: 41, eliminated: 12, joinedViaInvite: 20 },
      { kind: "competition", id: "fx-office", name: "Office Cup", status: "active", members: 64, active: 30, eliminated: 9, joinedViaInvite: 16 },
      { kind: "competition", id: "fx-harbour", name: "Harbour Loop", status: "finished", members: 27, active: 0, eliminated: 8, joinedViaInvite: 6 },
      { kind: "competition", id: "fx-lunch", name: "Lunchtime Legends", status: "active", members: 12, active: 5, eliminated: 2, joinedViaInvite: 3 },
      { kind: "small", competitions: 3, members: 9, active: 3, eliminated: 1, joinedViaInvite: 2 },
    ];
  }
  if (name === "5") {
    return [
      { kind: "competition", id: "fx-live", name: "Autumn Stride", status: "active", members: 5, active: 3, eliminated: 1, joinedViaInvite: 1 },
      { kind: "small", competitions: 1, members: 2, active: 1, eliminated: 0, joinedViaInvite: 0 },
    ];
  }
  return [];
}

function dayDoc(name: FixtureName, shape: Shape, k: number, date: string, now: Date, docCount: number): Obj {
  const grown = Math.min(shape.players, Math.max(1, Math.round((shape.players * (k + 1)) / Math.max(1, docCount * 0.6))));
  const total = Math.min(shape.players, grown);
  const dau = Math.max(0, Math.round(total * (0.38 + 0.05 * Math.sin(k))));
  const mau = Math.min(total, Math.max(dau, Math.round(total * 0.9)));
  const wau = Math.min(mau, Math.max(dau, Math.round(total * 0.7)));
  const newActive = Math.min(dau, shape.signupsPerDay);
  const final = now.getTime() >= finalAt(date).getTime();
  // One old day stays provisional forever: a night the job did not finish it.
  const stuck = k === docCount - 12;
  const hasRobots = k >= docCount - 6;
  const ages = zero(AGE_KEYS);
  ages["0"] = newActive;
  ages["1"] = Math.min(dau - newActive, Math.ceil(shape.signupsPerDay * 0.6));
  ages["7"] = Math.min(dau - newActive - ages["1"], Math.ceil(shape.signupsPerDay * 0.4));
  ages["30"] = k >= 30 ? 1 : 0;
  const welcome = shape.signupsPerDay * 150;
  const escrow = Math.round(dau * 4);
  return {
    v: 1,
    date,
    final: stuck ? false : final,
    backfilled: false,
    partial: [],
    computedAt: final ? finalAt(date) : new Date(now.getTime() - 40 * 60000),
    runId: `fixture-${name}-${date}`,
    excluded: { demo: 1, listed: 2, robots: hasRobots ? 3 : 0 },
    accounts: { total, ageConfirmed: total, seeded: Math.max(0, total - 1), everJoined: Math.round(total * 0.6), inLiveCompetition: Math.round(total * 0.5) },
    signups: shape.signupsPerDay,
    deletionsDerived: null,
    active: { dau, wau, mau, new: newActive, returning: dau - newActive, lapsed: Math.max(0, total - 1 - mau) },
    activeBySignupAge: ages,
    funnel7: {
      cohortDate: addDays(date, -7),
      created: shape.signupsPerDay,
      ageConfirmed: shape.signupsPerDay,
      seeded: shape.signupsPerDay,
      synced: Math.max(0, shape.signupsPerDay - 1),
      joined: Math.ceil(shape.signupsPerDay * 0.6),
    },
    competitions: {
      scheduled: 1,
      live: 1,
      finishedTotal: k >= 10 ? 1 : 0,
      created: k % 9 === 0 ? 1 : 0,
      finalised: k === 10 ? 1 : 0,
      membersLive: Math.round(total * 0.5),
      joins: k % 4 === 0 ? 3 : 0,
      joinsViaInvite: k % 4 === 0 ? 1 : 0,
      eliminations: k % 3 === 0 ? 1 : 0,
      finishers: k === 10 ? 3 : 0,
      finishedMembers: k === 10 ? 4 : 0,
    },
    competitionsTable: tableFor(name),
    challenges: {
      created: { direct: { "75": k % 2, "100": Math.floor(k / 3) % 2, "125": k % 5 === 0 ? 1 : 0 }, duel: k % 6 === 0 ? 1 : 0, streak: 0 },
    },
    tools: { forceField: 0, stickTo: 0, enabled: { forceField: false, stickTo: false, duel: true, streak: false } },
    coins: {
      outstanding: 1000 + k * 20,
      earned: { ...zero(EARNED), welcome, competition_payout: k === 10 ? 300 : 0 },
      spent: { ...zero(SPENT), "challenge-escrow": escrow, "challenge-pass": k % 12 === 0 ? 40 : 0 },
    },
  };
}

function zeroDoc(date: string, now: Date): Obj {
  const final = now.getTime() >= finalAt(date).getTime();
  return {
    v: 1,
    date,
    final,
    backfilled: false,
    partial: [],
    computedAt: final ? finalAt(date) : new Date(now.getTime() - 40 * 60000),
    runId: `fixture-0-${date}`,
    excluded: { demo: 0, listed: 0, robots: 0 },
    accounts: { total: 0, ageConfirmed: 0, seeded: 0, everJoined: 0, inLiveCompetition: 0 },
    signups: 0,
    deletionsDerived: null,
    active: { dau: 0, wau: 0, mau: 0, new: 0, returning: 0, lapsed: 0 },
    activeBySignupAge: zero(AGE_KEYS),
    funnel7: { cohortDate: addDays(date, -7), created: 0, ageConfirmed: 0, seeded: 0, synced: 0, joined: 0 },
    competitions: { scheduled: 0, live: 0, finishedTotal: 0, created: 0, finalised: 0, membersLive: 0, joins: 0, joinsViaInvite: 0, eliminations: 0, finishers: 0, finishedMembers: 0 },
    competitionsTable: [],
    challenges: { created: { direct: { "75": 0, "100": 0, "125": 0 }, duel: 0, streak: 0 } },
    tools: { forceField: 0, stickTo: 0, enabled: { forceField: false, stickTo: false, duel: true, streak: false } },
    coins: { outstanding: 0, earned: zero(EARNED), spent: zero(SPENT) },
  };
}

function runDoc(now: Date, minutesAgo: number, status: "ok" | "failed"): Obj {
  const startedAt = new Date(now.getTime() - minutesAgo * 60000);
  if (status === "ok") return { job: "usageMetrics", status, startedAt, finishedAt: new Date(startedAt.getTime() + 41000) };
  return { job: "usageMetrics", status, startedAt, failedAt: new Date(startedAt.getTime() + 9000), stage: "runUsageMetrics", errorCode: "none" };
}

export function buildFixture(name: FixtureName, now: Date): FixtureSet {
  const newest = addDays(londonDate(now), -1);
  if (name === "none") return { daily: [], live: null, runs: [] };
  if (name === "0") {
    const docs = Array.from({ length: 10 }, (_, i) => zeroDoc(addDays(newest, -(9 - i)), now));
    return {
      daily: docs.map((d) => ({ id: d.date as string, data: d })),
      live: { dates: { [londonDate(now)]: 0, [newest]: 0 }, computedAt: new Date(now.getTime() - 9 * 60000) },
      runs: [runDoc(now, 22, "ok")],
    };
  }
  const shape: Shape =
    name === "500"
      ? { players: 500, days: 90, signupsPerDay: 6, table: tableFor(name) }
      : { players: 5, days: name === "short" ? 3 : 24, signupsPerDay: 1, table: tableFor(name) };
  const total = name === "short" ? 24 : shape.days;
  const all = Array.from({ length: total }, (_, k) => {
    const date = addDays(newest, -(total - 1 - k));
    return { id: date, data: dayDoc(name, shape, k, date, now, total) };
  });
  const daily = name === "short" ? all.slice(-3) : all;
  const last = daily[daily.length - 1].data as { active: { dau: number } };
  return {
    daily,
    live: {
      dates: { [londonDate(now)]: Math.round(last.active.dau * 0.6), [newest]: last.active.dau },
      computedAt: new Date(now.getTime() - 9 * 60000),
    },
    runs: name === "failed" ? [runDoc(now, 20, "failed"), runDoc(now, 80, "ok")] : [runDoc(now, 22, "ok"), runDoc(now, 82, "ok")],
  };
}
