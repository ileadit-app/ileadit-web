/**
 * Pure logic for the admin usage page (`/admin/usage`, WEB-PORTAL-USAGE-1).
 *
 * A TypeScript port of `admin-web/public/usage-model.js` in the ileadit engine
 * repo (origin/main), which is the source of truth for what each number means.
 * No Firebase, no DOM and no globals used at import time, so everything here
 * runs under plain Vitest `node`.
 *
 * The page reads the aggregate documents the nightly engine job writes
 * (engine `docs/usage-metrics/DESIGN.md` section 4.3, `docs/FIRESTORE_SCHEMA.md`
 * "Usage metrics"): `ops/metrics/daily/{date}`, `ops/metrics/live/current`,
 * `ops/jobRuns/usageMetrics/{runId}` and, for existence only, the failure alert
 * `ops/alerts/jobFailed/usageMetrics` (its content is never read). Counts and coin sums only: there is no
 * step figure, uid or email in those documents and none is read here. Every
 * normaliser below copies named, documented fields only, so anything else a
 * document might carry cannot reach the page.
 *
 * Deliberate differences from the reference:
 * - No emulator switch and no fixture paths: the page only ever reads the
 *   four production paths in `USAGE_PATHS`.
 * - The alert document is read for existence only (`alertPresent`), as the
 *   reference does, so a failure still shows the banner when the run-document
 *   write itself failed. The next successful run deletes it again.
 */

// ---------------------------------------------------------------------------
// The only Firestore paths this page may read
// ---------------------------------------------------------------------------

export const USAGE_PATHS = Object.freeze({
  daily: ["ops", "metrics", "daily"] as const,
  live: ["ops", "metrics", "live", "current"] as const,
  runs: ["ops", "jobRuns", "usageMetrics"] as const,
  alert: ["ops", "alerts", "jobFailed", "usageMetrics"] as const,
});

// ---------------------------------------------------------------------------
// Dates and numbers (yyyy-MM-dd strings; all arithmetic in UTC so there is no
// local-time drift. They are labels, not instants.)
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function weekdayShort(date: string): string {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(date, -dow);
}

export function fmtDate(date: string | null): string {
  if (!isDateKey(date)) return "";
  return `${Number(date.slice(8))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}

export function fmtDayMonth(date: string | null): string {
  if (!isDateKey(date)) return "";
  return `${Number(date.slice(8))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
}

/**
 * The Europe/London calendar date of an instant: the engine's own date for
 * instant events, and the page's meaning of "today".
 */
export function londonDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function fmtCount(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "-";
  return Math.round(n).toLocaleString("en-GB");
}

/** Percentages only when the denominator is 20 or more (DESIGN 5.3). */
export const PERCENT_MIN_DENOMINATOR = 20;

/** "3 of 5 accounts", or "120 of 500 accounts (24%)". */
export function ofText(k: number | null, total: number | null, noun?: string): string {
  const base = `${fmtCount(k)} of ${fmtCount(total)}${noun ? ` ${noun}` : ""}`;
  if (typeof total === "number" && total >= PERCENT_MIN_DENOMINATOR && typeof k === "number") {
    return `${base} (${Math.round((k / total) * 100)}%)`;
  }
  return base;
}

/** Firestore Timestamp (has toDate), Date, or {seconds}: to a Date or null. */
export function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "object") return null;
  const v = value as { toDate?: unknown; seconds?: unknown };
  if (typeof v.toDate === "function") {
    const d = (v.toDate as () => unknown)();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (typeof v.seconds === "number") return new Date(v.seconds * 1000);
  return null;
}

export function fmtDateTimeUtc(value: unknown): string {
  const d = toDate(value);
  if (d === null) return "";
  const iso = d.toISOString();
  return `${fmtDate(iso.slice(0, 10))} ${iso.slice(11, 16)} UTC`;
}

/** One decimal only when it is not a whole number: 3 or 3.4, never 3.0. */
export function fmtOne(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r)
    ? fmtCount(r)
    : r.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// ---------------------------------------------------------------------------
// Normalising a daily snapshot. Older documents lack newer fields (robots,
// activeBySignupAge.unknown, ...) and a malformed one must not break the page:
// every count is a finite non-negative number or 0.
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;

function asObj(value: unknown): Obj | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : null;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function at(obj: unknown, ...path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    const o = asObj(cur);
    if (o === null) return undefined;
    cur = o[key];
  }
  return cur;
}

export const EARNED_REASONS = ["welcome", "competition_payout", "refunds", "other"] as const;
export const SPENT_REASONS = [
  "challenge-escrow",
  "challenge-bounce",
  "challenge-pass",
  "force-field-purchase",
  "stick-to-purchase",
  "other",
] as const;
export type EarnedReason = (typeof EARNED_REASONS)[number];
export type SpentReason = (typeof SPENT_REASONS)[number];

export const REASON_LABELS: Record<string, string> = {
  welcome: "Welcome coins",
  competition_payout: "Competition payout",
  refunds: "Refunds",
  "challenge-escrow": "Challenge entered",
  "challenge-bounce": "Challenge bounced",
  "challenge-pass": "Challenge passed on",
  "force-field-purchase": "Force field",
  "stick-to-purchase": "Stick-to",
  other: "Other",
};

/**
 * The colour token (the N of `--usage-cat-N` in globals.css) each coin reason
 * is drawn in, in the chart and its legend. Every reason has its own, so a
 * legend entry is never mistaken for another.
 */
export const COIN_REASON_TOKENS = {
  earned: { welcome: 1, competition_payout: 3, refunds: 8, other: 9 } as Record<EarnedReason, number>,
  spent: {
    "challenge-escrow": 2,
    "challenge-bounce": 4,
    "challenge-pass": 7,
    "force-field-purchase": 5,
    "stick-to-purchase": 6,
    other: 10,
  } as Record<SpentReason, number>,
};

function reasonCounts<K extends string>(obj: unknown, keys: readonly K[]): Record<K, number> {
  const o = asObj(obj);
  const out = {} as Record<K, number>;
  for (const k of keys) out[k] = count(o ? o[k] : undefined);
  return out;
}

/**
 * The fold line of the per-competition table: the job lists a competition only
 * at this many members or more, and sums the rest into one row (engine
 * `functions/src/services/usageMetrics.ts` SMALL_COMPETITION_MEMBERS).
 */
export const SMALL_COMPETITION_MEMBERS = 5;
const TABLE_MAX_ROWS = 200;

export interface TableCounts {
  members: number;
  active: number;
  eliminated: number;
  joinedViaInvite: number;
}
export interface CompetitionRow extends TableCounts {
  id: string;
  name: string | null;
  status: "active" | "finished";
}
export interface SmallRow extends TableCounts {
  competitions: number;
}
export interface CompetitionsTable {
  list: CompetitionRow[];
  small: SmallRow | null;
}

function tableCounts(r: Obj): TableCounts {
  return {
    members: count(r.members),
    active: count(r.active),
    eliminated: count(r.eliminated),
    joinedViaInvite: count(r.joinedViaInvite),
  };
}

/**
 * `competitionsTable` of one day: null when the day has none (written before
 * the table existed), otherwise { list, small }. Only the documented counting
 * fields are read. A name is kept only for a row of SMALL_COMPETITION_MEMBERS or
 * more: a folded row is never named.
 */
export function normalizeCompetitionsTable(value: unknown): CompetitionsTable | null {
  if (!Array.isArray(value)) return null;
  const list: CompetitionRow[] = [];
  let small: SmallRow | null = null;
  for (const raw of value.slice(0, TABLE_MAX_ROWS)) {
    const r = asObj(raw);
    if (r === null) continue;
    if (r.kind === "competition") {
      const c = tableCounts(r);
      if (c.members < SMALL_COMPETITION_MEMBERS) continue;
      list.push({
        id: typeof r.id === "string" ? r.id : "",
        name: typeof r.name === "string" && r.name.trim() !== "" ? r.name.trim().slice(0, 80) : null,
        status: r.status === "finished" ? "finished" : "active",
        ...c,
      });
    } else if (r.kind === "small" && small === null) {
      small = { competitions: count(r.competitions), ...tableCounts(r) };
    }
  }
  return { list, small: small !== null && small.competitions > 0 ? small : null };
}

export interface Funnel7 {
  cohortDate: string | null;
  created: number;
  ageConfirmed: number;
  seeded: number;
  synced: number;
  joined: number;
}
export interface ToolsEnabled {
  forceField: boolean;
  stickTo: boolean;
  duel: boolean;
  streak: boolean;
}
export type ToolKey = keyof ToolsEnabled;

export interface UsageDay {
  date: string;
  final: boolean;
  backfilled: boolean;
  partial: string[];
  excluded: { demo: number; listed: number; robots: number };
  accounts: { total: number; seeded: number; inLive: number };
  signups: number;
  dau: number;
  wau: number;
  mau: number;
  newActive: number;
  returning: number;
  lapsed: number;
  /** Not written by the v1 job; null means "not recorded", never zero. */
  resurrected: number | null;
  signupAge: Record<string, number>;
  funnel7: Funnel7 | null;
  competitions: {
    scheduled: number;
    live: number;
    finishedTotal: number;
    membersLive: number;
    joins: number;
    joinsViaInvite: number;
    eliminations: number;
    finalised: number;
    finishers: number;
    finishedMembers: number;
  };
  competitionsTable: CompetitionsTable | null;
  challenges: {
    d75: number;
    d100: number;
    d125: number;
    duel: number;
    streak: number;
    forceField: number;
    stickTo: number;
  };
  /** true / false when the job recorded the switch; null when it did not. */
  toolsEnabled: ToolsEnabled | null;
  coins: {
    outstanding: number;
    earned: Record<EarnedReason, number>;
    spent: Record<SpentReason, number>;
  };
}

export function normalizeDay(doc: unknown): UsageDay | null {
  const d = asObj(doc);
  if (d === null || !isDateKey(d.date)) return null;
  const funnel = asObj(d.funnel7);
  const enabled = asObj(at(d, "tools", "enabled"));
  const ageRaw = asObj(d.activeBySignupAge);
  const signupAge: Record<string, number> = {};
  if (ageRaw) {
    for (const [k, v] of Object.entries(ageRaw)) if (typeof v === "number") signupAge[k] = count(v);
  }
  const resurrected = at(d, "active", "resurrected");
  return {
    date: d.date,
    final: d.final === true,
    backfilled: d.backfilled === true,
    partial: Array.isArray(d.partial) ? d.partial.filter((p): p is string => typeof p === "string") : [],
    excluded: {
      demo: count(at(d, "excluded", "demo")),
      listed: count(at(d, "excluded", "listed")),
      robots: count(at(d, "excluded", "robots")),
    },
    accounts: {
      total: count(at(d, "accounts", "total")),
      seeded: count(at(d, "accounts", "seeded")),
      inLive: count(at(d, "accounts", "inLiveCompetition")),
    },
    signups: count(d.signups),
    dau: count(at(d, "active", "dau")),
    wau: count(at(d, "active", "wau")),
    mau: count(at(d, "active", "mau")),
    newActive: count(at(d, "active", "new")),
    returning: count(at(d, "active", "returning")),
    lapsed: count(at(d, "active", "lapsed")),
    resurrected: typeof resurrected === "number" ? count(resurrected) : null,
    signupAge,
    funnel7: funnel
      ? {
          cohortDate: isDateKey(funnel.cohortDate) ? funnel.cohortDate : null,
          created: count(funnel.created),
          ageConfirmed: count(funnel.ageConfirmed),
          seeded: count(funnel.seeded),
          synced: count(funnel.synced),
          joined: count(funnel.joined),
        }
      : null,
    competitions: {
      scheduled: count(at(d, "competitions", "scheduled")),
      live: count(at(d, "competitions", "live")),
      finishedTotal: count(at(d, "competitions", "finishedTotal")),
      membersLive: count(at(d, "competitions", "membersLive")),
      joins: count(at(d, "competitions", "joins")),
      joinsViaInvite: count(at(d, "competitions", "joinsViaInvite")),
      eliminations: count(at(d, "competitions", "eliminations")),
      finalised: count(at(d, "competitions", "finalised")),
      finishers: count(at(d, "competitions", "finishers")),
      finishedMembers: count(at(d, "competitions", "finishedMembers")),
    },
    competitionsTable: normalizeCompetitionsTable(d.competitionsTable),
    challenges: {
      d75: count(at(d, "challenges", "created", "direct", "75")),
      d100: count(at(d, "challenges", "created", "direct", "100")),
      d125: count(at(d, "challenges", "created", "direct", "125")),
      duel: count(at(d, "challenges", "created", "duel")),
      streak: count(at(d, "challenges", "created", "streak")),
      forceField: count(at(d, "tools", "forceField")),
      stickTo: count(at(d, "tools", "stickTo")),
    },
    toolsEnabled: enabled
      ? {
          forceField: enabled.forceField === true,
          stickTo: enabled.stickTo === true,
          duel: enabled.duel === true,
          streak: enabled.streak === true,
        }
      : null,
    coins: {
      outstanding: count(at(d, "coins", "outstanding")),
      earned: reasonCounts(at(d, "coins", "earned"), EARNED_REASONS),
      spent: reasonCounts(at(d, "coins", "spent"), SPENT_REASONS),
    },
  };
}

// ---------------------------------------------------------------------------
// The last job run. Only a short allowlist is ever kept: `errorMessage` and the
// run id are never read into the page (they could carry detail that is not for
// display).
// ---------------------------------------------------------------------------

/**
 * The run statuses the page recognises. The engine job writes "ok" and
 * "failed" (`functions/src/scheduled/usageMetrics.ts`, `services/ops.ts`);
 * "running" is accepted for an in-progress record. Anything else is "unknown".
 */
export const RUN_STATUSES = ["ok", "failed", "running"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export function knownRunStatus(value: unknown): RunStatus | null {
  return typeof value === "string" && (RUN_STATUSES as readonly string[]).includes(value) ? (value as RunStatus) : null;
}

export interface UsageRun {
  status: string | null;
  stage: string | null;
  errorCode: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  failedAt: Date | null;
}

/**
 * The failure record's stage and errorCode are short fixed identifiers the
 * engine writes. Kept only when they look like one. A gRPC/Firestore error code
 * is usually a number (for example 14), so a whole number is kept as its
 * decimal text.
 */
export function failureIdentifier(value: unknown): string | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 1e6) return String(value);
  return typeof value === "string" && /^[A-Za-z0-9_.:/-]{1,60}$/.test(value) ? value : null;
}

export function normalizeRun(raw: unknown): UsageRun | null {
  const r = asObj(raw);
  if (r === null) return null;
  return {
    status: typeof r.status === "string" ? r.status : null,
    stage: failureIdentifier(r.stage),
    errorCode: failureIdentifier(r.errorCode),
    startedAt: toDate(r.startedAt),
    finishedAt: toDate(r.finishedAt),
    failedAt: toDate(r.failedAt),
  };
}

// ---------------------------------------------------------------------------
// The view model
// ---------------------------------------------------------------------------

export const RANGES = Object.freeze({ "7": 7, "28": 28, "90": 90, all: Infinity }) as Readonly<
  Record<string, number>
>;
export type RangeKey = "7" | "28" | "90" | "all";
export const RANGE_KEYS: readonly RangeKey[] = ["7", "28", "90", "all"];
export const DEFAULT_RANGE: RangeKey = "28";

/**
 * Read enough documents for the range; "All" is bounded so the page never
 * issues an open-ended read. Never fewer than 28 days: stickiness and the
 * 7-day average read that far back.
 */
export function rangeLimit(rangeKey: string): number {
  const n = RANGES[rangeKey] ?? RANGES[DEFAULT_RANGE];
  return Number.isFinite(n) ? Math.max(28, n) : 400;
}

/** Sorted, de-duplicated, normalised daily rows. */
export function normalizeDays(docs: unknown): UsageDay[] {
  const byDate = new Map<string, UsageDay>();
  for (const doc of Array.isArray(docs) ? docs : []) {
    const day = normalizeDay(doc);
    if (day !== null) byDate.set(day.date, day);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function selectRange(days: UsageDay[], rangeKey: string): UsageDay[] {
  if (days.length === 0) return [];
  const n = RANGES[rangeKey] ?? RANGES[DEFAULT_RANGE];
  if (!Number.isFinite(n)) return days;
  const newest = days[days.length - 1].date;
  const from = addDays(newest, -(n - 1));
  return days.filter((d) => d.date >= from);
}

/**
 * A failed job: the latest run is recorded as failed, or the engine's alert
 * document is present (the next successful run deletes it).
 */
export function jobFailed(lastRun: { status?: unknown } | null | undefined, alertPresent = false): boolean {
  return alertPresent === true || (lastRun !== null && lastRun !== undefined && lastRun.status === "failed");
}

export interface Tile {
  key: "today" | "yesterday" | "wau" | "mau" | "signups" | "live";
  label: string;
  value: number | null;
  context: string;
}

export interface UsageModelBase {
  range: RangeKey;
  failed: boolean;
  lastRun: UsageRun | null;
}
export interface EmptyModel extends UsageModelBase {
  state: "empty";
  all: UsageDay[];
  rows: UsageDay[];
  newest: null;
}
export interface ReadyModel extends UsageModelBase {
  state: "ready";
  all: UsageDay[];
  rows: UsageDay[];
  newest: UsageDay;
  byDate: Map<string, UsageDay>;
  tiles: Tile[];
  today: string;
  yesterday: string;
  liveComputedAt: Date | null;
}
export type UsageModel = EmptyModel | ReadyModel;

export interface BuildModelInput {
  /** Raw daily documents. */
  docs: unknown;
  /** `ops/metrics/live/current` data or null. */
  live: unknown;
  /** Newest `ops/jobRuns/usageMetrics` document (raw or normalised) or null. */
  lastRun: unknown;
  /** True when `ops/alerts/jobFailed/usageMetrics` exists. */
  alertPresent?: boolean;
  now: Date;
  rangeKey: string;
}

export function buildModel({ docs, live, lastRun, alertPresent, now, rangeKey }: BuildModelInput): UsageModel {
  const range: RangeKey = (RANGE_KEYS as readonly string[]).includes(rangeKey) ? (rangeKey as RangeKey) : DEFAULT_RANGE;
  const all = normalizeDays(docs);
  const run = normalizeRun(lastRun);
  const failed = jobFailed(run, alertPresent === true);
  const base: UsageModelBase = { range, failed, lastRun: run };
  if (all.length === 0) return { ...base, state: "empty", all, rows: [], newest: null };
  const rows = selectRange(all, range);
  const newest = all[all.length - 1];
  const today = londonDate(now);
  const yesterday = addDays(today, -1);
  const liveObj = asObj(live);
  const liveDates = asObj(liveObj ? liveObj.dates : undefined) ?? {};
  const liveFor = (d: string): number | null => (typeof liveDates[d] === "number" ? count(liveDates[d]) : null);
  const byDate = new Map(all.map((d) => [d.date, d] as const));
  const yDay = byDate.get(yesterday);
  const total = newest.accounts.total;
  const todayLive = liveFor(today);
  const yesterdayLive = liveFor(yesterday);

  const tiles: Tile[] = [
    {
      key: "today",
      label: "Active today so far",
      value: todayLive,
      context: todayLive === null ? "No live count yet" : `${ofText(todayLive, total, "accounts")}, live`,
    },
    {
      key: "yesterday",
      label: "Active yesterday",
      value: yDay ? yDay.dau : yesterdayLive,
      context: yDay
        ? `${ofText(yDay.dau, total, "accounts")}${yDay.final ? "" : ", provisional"}`
        : yesterdayLive === null
          ? "No count for yesterday yet"
          : `${ofText(yesterdayLive, total, "accounts")}, live count`,
    },
    { key: "wau", label: "Active in 7 days", value: newest.wau, context: ofText(newest.wau, total, "accounts") },
    { key: "mau", label: "Active in 28 days", value: newest.mau, context: ofText(newest.mau, total, "accounts") },
    {
      key: "signups",
      label: "New sign-ups",
      value: rows.reduce((s, d) => s + d.signups, 0),
      context: range === "all" ? "in all recorded days" : `in the last ${range} days`,
    },
    {
      key: "live",
      label: "In a live competition",
      value: newest.accounts.inLive,
      context: ofText(newest.accounts.inLive, total, "accounts"),
    },
  ];

  return {
    ...base,
    state: "ready",
    all,
    rows,
    newest,
    byDate,
    tiles,
    today,
    yesterday,
    liveComputedAt: liveObj ? toDate(liveObj.computedAt) : null,
  };
}

// ---------------------------------------------------------------------------
// Section calculations
// ---------------------------------------------------------------------------

/** Fewer than 7 recorded days: a chart is replaced by a row of day values. */
export const MIN_CHART_DAYS = 7;
export const MIN_AVERAGE_DAYS = 14;

export function isShortSeries(rows: UsageDay[]): boolean {
  return rows.length < MIN_CHART_DAYS;
}

type NumericDayField = "dau" | "wau" | "mau" | "newActive" | "returning" | "lapsed" | "signups";

/** Trailing 7-day mean of daily actives, only where all 7 calendar days exist. */
export function trailingAverage(
  rows: UsageDay[],
  field: NumericDayField = "dau",
  window = 7,
): { date: string; value: number }[] {
  if (rows.length < MIN_AVERAGE_DAYS) return [];
  const byDate = new Map(rows.map((r) => [r.date, r] as const));
  const out: { date: string; value: number }[] = [];
  for (const r of rows) {
    let sum = 0;
    let ok = true;
    for (let i = 0; i < window; i += 1) {
      const prev = byDate.get(addDays(r.date, -i));
      if (!prev) {
        ok = false;
        break;
      }
      sum += prev[field];
    }
    if (ok) out.push({ date: r.date, value: sum / window });
  }
  return out;
}

/**
 * Stickiness = mean DAU over the last 28 calendar days / MAU. Only given when
 * all 28 days are present and there are 20 or more active players in the month.
 */
export const STICKINESS_MIN_PLAYERS = 20;

export interface Stickiness {
  meanDau: number | null;
  mau: number | null;
  ratio: number | null;
  reason: string | null;
}

export function stickiness(all: UsageDay[]): Stickiness {
  if (all.length === 0) return { meanDau: null, mau: null, ratio: null, reason: "No data yet." };
  const newest = all[all.length - 1];
  const byDate = new Map(all.map((d) => [d.date, d] as const));
  const days: UsageDay[] = [];
  for (let i = 0; i < 28; i += 1) {
    const d = byDate.get(addDays(newest.date, -i));
    if (d) days.push(d);
  }
  const meanDau = days.length === 0 ? null : days.reduce((s, d) => s + d.dau, 0) / days.length;
  if (days.length < 28) {
    return {
      meanDau,
      mau: newest.mau,
      ratio: null,
      reason: `Stickiness needs 28 days of data. This page has ${days.length}.`,
    };
  }
  if (newest.mau < STICKINESS_MIN_PLAYERS) {
    return {
      meanDau,
      mau: newest.mau,
      ratio: null,
      reason: `Stickiness is hidden until ${STICKINESS_MIN_PLAYERS} players have been active in 28 days.`,
    };
  }
  return { meanDau, mau: newest.mau, ratio: (meanDau as number) / newest.mau, reason: null };
}

export interface FunnelStep {
  key: "created" | "ageConfirmed" | "seeded" | "synced" | "joined";
  label: string;
  value: number;
}

/**
 * Funnel over the final days in the range: each daily document carries the
 * cohort that signed up 7 days earlier. A provisional day is left out: its own
 * day is not complete, so the "synced" step could be low.
 */
export function funnel(rows: UsageDay[]): { cohorts: number; created: number; steps: FunnelStep[] } {
  const sums = { created: 0, ageConfirmed: 0, seeded: 0, synced: 0, joined: 0 };
  let cohorts = 0;
  for (const r of rows) {
    if (!r.final || r.funnel7 === null) continue;
    cohorts += 1;
    sums.created += r.funnel7.created;
    sums.ageConfirmed += r.funnel7.ageConfirmed;
    sums.seeded += r.funnel7.seeded;
    sums.synced += r.funnel7.synced;
    sums.joined += r.funnel7.joined;
  }
  return {
    cohorts,
    created: sums.created,
    steps: [
      { key: "created", label: "Created an account", value: sums.created },
      { key: "ageConfirmed", label: "Confirmed their age", value: sums.ageConfirmed },
      { key: "seeded", label: "Reached their first game day", value: sums.seeded },
      { key: "synced", label: "Synced in their first week", value: sums.synced },
      { key: "joined", label: "Joined a competition", value: sums.joined },
    ],
  };
}

export const RETENTION_AGES = [1, 7, 14, 30] as const;

type CohortCell =
  | { state: "pending" }
  | { state: "missing" }
  | { state: "ok"; k: number; of: number; provisional: boolean };

/**
 * One cohort day C at age n: players of C active exactly on C+n, over the
 * frozen signups of C. Not "ok" = not reached yet or no snapshot for that day.
 */
function cohortCell(byDate: Map<string, UsageDay>, newestDate: string, cohort: UsageDay, n: number): CohortCell {
  const target = addDays(cohort.date, n);
  if (target > newestDate) return { state: "pending" };
  const day = byDate.get(target);
  if (!day) return { state: "missing" };
  const k = count(day.signupAge[String(n)]);
  return { state: "ok", k, of: cohort.signups, provisional: !day.final };
}

export type RetentionCell =
  | { n: number; state: "none" }
  | { n: number; state: "ok"; k: number; of: number; partial: boolean; provisional: boolean };

export interface RetentionRow {
  key: string;
  label: string;
  size: number;
  cells: RetentionCell[];
}

/** Cohort rows: one per sign-up week, or per day when the range is 7 days. */
export function retentionRows(all: UsageDay[], rows: UsageDay[], rangeKey: string): RetentionRow[] {
  if (rows.length === 0) return [];
  const byDate = new Map(all.map((d) => [d.date, d] as const));
  const newestDate = all[all.length - 1].date;
  const perDay = rangeKey === "7";
  const groups = new Map<string, UsageDay[]>();
  for (const c of rows) {
    const key = perDay ? c.date : weekStart(c.date);
    const g = groups.get(key);
    if (g) g.push(c);
    else groups.set(key, [c]);
  }
  return [...groups.entries()]
    .map(([key, cohorts]) => {
      const size = cohorts.reduce((s, c) => s + c.signups, 0);
      const cells = RETENTION_AGES.map((n): RetentionCell => {
        let k = 0;
        let of = 0;
        let reached = 0;
        let provisional = false;
        for (const c of cohorts) {
          const cell = cohortCell(byDate, newestDate, c, n);
          if (cell.state !== "ok") continue;
          reached += 1;
          k += cell.k;
          of += cell.of;
          provisional = provisional || cell.provisional;
        }
        if (reached === 0 || of === 0) return { n, state: "none" };
        return { n, state: "ok", k, of, partial: reached < cohorts.length, provisional };
      });
      return { key, label: perDay ? fmtDate(key) : `Week of ${fmtDayMonth(key)}`, size, cells };
    })
    .filter((row) => row.size > 0); // a cohort with no sign-ups has nothing to retain
}

/**
 * Daily cohorts that have a D1 and D7 value, for the small trend chart. Shown
 * only with 8 or more cohorts and at least 20 sign-ups between them.
 */
export const RETENTION_TREND_MIN_COHORTS = 8;

export interface RetentionTrend {
  enough: boolean;
  points: { date: string; d1: number; d7: number | null }[];
  cohorts: number;
  signups: number;
}

export function retentionTrend(all: UsageDay[]): RetentionTrend {
  if (all.length === 0) return { enough: false, points: [], cohorts: 0, signups: 0 };
  const byDate = new Map(all.map((d) => [d.date, d] as const));
  const newestDate = all[all.length - 1].date;
  const points: RetentionTrend["points"] = [];
  let signups = 0;
  for (const c of all) {
    if (c.signups === 0) continue;
    const d1 = cohortCell(byDate, newestDate, c, 1);
    const d7 = cohortCell(byDate, newestDate, c, 7);
    if (d1.state !== "ok") continue;
    signups += c.signups;
    points.push({
      date: c.date,
      d1: d1.k / c.signups,
      d7: d7.state === "ok" ? d7.k / c.signups : null,
    });
  }
  return {
    enough: points.length >= RETENTION_TREND_MIN_COHORTS && signups >= PERCENT_MIN_DENOMINATOR,
    points,
    cohorts: points.length,
    signups,
  };
}

/** When the first D30 value can exist: the oldest cohort plus 30 days. */
export function firstD30Date(all: UsageDay[]): string | null {
  return all.length === 0 ? null : addDays(all[0].date, 30);
}

export function hasAnyD30(rows: RetentionRow[]): boolean {
  return rows.some((r) => r.cells.some((c) => c.n === 30 && c.state === "ok"));
}

export interface KindRow {
  key: "d75" | "d100" | "d125" | "duel" | "streak" | "forceField" | "stickTo";
  label: string;
  tool: boolean;
}

export const KIND_ROWS: readonly KindRow[] = [
  { key: "d75", label: "Direct challenge, 75% of average", tool: false },
  { key: "d100", label: "Direct challenge, 100% of average", tool: false },
  { key: "d125", label: "Direct challenge, 125% of average", tool: false },
  { key: "duel", label: "Duel", tool: true },
  { key: "streak", label: "Streak", tool: true },
  { key: "forceField", label: "Force field", tool: true },
  { key: "stickTo", label: "Stick-to", tool: true },
];

/**
 * Totals per kind over the range, with an "off" flag from the newest
 * snapshot's recorded tool switches (false when the job did not record them).
 */
export function challengeKinds(rows: UsageDay[], newest: UsageDay | null): (KindRow & { total: number; off: boolean })[] {
  const enabled = newest ? newest.toolsEnabled : null;
  return KIND_ROWS.map((k) => ({
    ...k,
    total: rows.reduce((s, r) => s + r.challenges[k.key], 0),
    off: k.tool && enabled !== null && enabled[k.key as ToolKey] === false,
  }));
}

/** Coin totals by reason over the range, per side, in a fixed order. */
export function coinTotals(rows: UsageDay[]): {
  earned: Record<EarnedReason, number>;
  spent: Record<SpentReason, number>;
} {
  const earned = {} as Record<EarnedReason, number>;
  const spent = {} as Record<SpentReason, number>;
  for (const k of EARNED_REASONS) earned[k] = rows.reduce((s, r) => s + r.coins.earned[k], 0);
  for (const k of SPENT_REASONS) spent[k] = rows.reduce((s, r) => s + r.coins.spent[k], 0);
  return { earned, spent };
}

export function partialDays(rows: UsageDay[]): number {
  return rows.filter((r) => r.partial.some((p) => p === "signups" || p === "competitions" || p === "coins")).length;
}
