// Pure chart geometry for the admin usage page (WEB-PORTAL-USAGE-1). No React,
// no DOM, no Firebase: each function turns normalised days into numbers and
// strings that the SVG components draw. Port of the chart helpers in the old
// admin viewer's usage-render.js, with the virtual-node layer removed.

import {
  COIN_REASON_TOKENS,
  EARNED_REASONS,
  REASON_LABELS,
  SPENT_REASONS,
  addDays,
  daysBetween,
  fmtCount,
  fmtDate,
  fmtDayMonth,
  type UsageDay,
} from "./usageMetrics";

/** Plot margins inside the SVG viewBox. */
export const MARGIN = { l: 38, r: 8, t: 10, b: 24 } as const;

/** Whole-number axis from zero: 0..top in integer steps, at most four steps. */
export function niceScale(max: number): { step: number; top: number; ticks: number[] } {
  const m = Math.max(0, Math.ceil(Number.isFinite(max) ? max : 0));
  for (const mag of [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000]) {
    for (const f of [1, 2, 5]) {
      const step = f * mag;
      if (Math.ceil(m / step) <= 4) {
        const top = Math.max(2, Math.ceil(m / step) * step);
        const ticks: number[] = [];
        for (let v = 0; v <= top; v += step) ticks.push(v);
        return { step, top, ticks };
      }
    }
  }
  return { step: m, top: m, ticks: [0, m] };
}

/** The calendar dates from the first to the last row, so a missing day is a gap. */
export function dateSpan(rows: { date: string }[]): string[] {
  if (rows.length === 0) return [];
  const out: string[] = [];
  const last = rows[rows.length - 1].date;
  for (let d = rows[0].date; d <= last; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Indices of the dates that get an x-axis label, counted back from the newest. */
export function xTicks(dates: string[], plotW: number): number[] {
  const maxTicks = Math.max(2, Math.floor(plotW / 64));
  const step = Math.max(1, Math.ceil(dates.length / maxTicks));
  const out: number[] = [];
  for (let i = dates.length - 1; i >= 0; i -= step) out.push(i);
  return out.reverse();
}

export interface Axis {
  /** Horizontal grid / axis lines and their y-axis labels. */
  yLines: { y: number; label: string; axis: boolean }[];
  xLabels: { x: number; label: string }[];
}

export interface Frame {
  width: number;
  height: number;
  plotW: number;
  plotH: number;
  slot: number;
  dates: string[];
  scale: ReturnType<typeof niceScale>;
}

function makeFrame(width: number, height: number, dates: string[], max: number): Frame {
  const plotW = width - MARGIN.l - MARGIN.r;
  return {
    width,
    height,
    plotW,
    plotH: height - MARGIN.t - MARGIN.b,
    slot: plotW / Math.max(1, dates.length),
    dates,
    scale: niceScale(max),
  };
}

function xLabelsFor(f: Frame): Axis["xLabels"] {
  return xTicks(f.dates, f.plotW).map((i) => ({
    x: MARGIN.l + (i + 0.5) * f.slot,
    label: fmtDayMonth(f.dates[i]),
  }));
}

const fix = (n: number): string => n.toFixed(1);

// ---------------------------------------------------------------------------
// Line chart
// ---------------------------------------------------------------------------

export interface LineSeriesInput {
  name: string;
  singular?: string;
  cls: string;
  points: { date: string; value: number; provisional: boolean }[];
}

export interface LineGeometry {
  frame: Frame;
  axis: Axis;
  series: {
    cls: string;
    solid: string;
    dashed: string;
    dots: { cx: string; cy: string; r: number; provisional: boolean; title: string }[];
  }[];
}

export function lineGeometry(input: {
  rows: { date: string }[];
  series: LineSeriesInput[];
  width: number;
  height?: number;
}): LineGeometry {
  const { rows, series, width, height = 200 } = input;
  const dates = dateSpan(rows);
  const max = Math.max(0, ...series.flatMap((s) => s.points.map((p) => p.value)));
  const f = makeFrame(width, height, dates, max);
  const idx = new Map(dates.map((d, i) => [d, i] as const));
  const yFor = (v: number) => MARGIN.t + f.plotH - (v / f.scale.top) * f.plotH;
  const xFor = (d: string) => MARGIN.l + ((idx.get(d) ?? 0) + 0.5) * f.slot;

  const axis: Axis = {
    yLines: f.scale.ticks.map((v) => ({ y: yFor(v), label: fmtCount(v), axis: v === 0 })),
    xLabels: xLabelsFor(f),
  };

  const out: LineGeometry["series"] = series.map((s) => {
    let solid = "";
    let dashed = "";
    let prev: { date: string; x: number; y: number; provisional: boolean } | null = null;
    for (const p of s.points) {
      const x = xFor(p.date);
      const y = yFor(p.value);
      if (prev !== null && daysBetween(prev.date, p.date) === 1) {
        const seg = `M${fix(prev.x)} ${fix(prev.y)}L${fix(x)} ${fix(y)}`;
        if (p.provisional || prev.provisional) dashed += seg;
        else solid += seg;
      }
      prev = { date: p.date, x, y, provisional: p.provisional };
    }
    return {
      cls: s.cls,
      solid,
      dashed,
      dots: s.points.map((p) => ({
        cx: fix(xFor(p.date)),
        cy: fix(yFor(p.value)),
        r: s.points.length > 45 ? 1.5 : 3,
        provisional: p.provisional,
        title: `${fmtDate(p.date)}: ${fmtCount(p.value)} ${p.value === 1 && s.singular ? s.singular : s.name}${p.provisional ? " (provisional)" : ""}`,
      })),
    };
  });
  return { frame: f, axis, series: out };
}

// ---------------------------------------------------------------------------
// Stacked bars
// ---------------------------------------------------------------------------

export interface BarKey {
  key: string;
  label: string;
  singular?: string;
  /** Colour token 1..10. */
  cat: number;
}

export interface Bar {
  cat: number;
  provisional: boolean;
  x: string;
  y: string;
  width: string;
  height: string;
  title: string;
}

export interface BarsGeometry {
  frame: Frame;
  axis: Axis;
  bars: Bar[];
}

function barWidth(slot: number): number {
  return Math.max(1, Math.min(28, slot * 0.7));
}

export function stackedGeometry(input: {
  rows: UsageDay[];
  keys: BarKey[];
  value: (row: UsageDay, key: string) => number;
  width: number;
  height?: number;
}): BarsGeometry {
  const { rows, keys, value, width, height = 200 } = input;
  const dates = dateSpan(rows);
  const byDate = new Map(rows.map((r) => [r.date, r] as const));
  const max = Math.max(0, ...rows.map((r) => keys.reduce((s, k) => s + value(r, k.key), 0)));
  const f = makeFrame(width, height, dates, max);
  const yFor = (v: number) => MARGIN.t + f.plotH - (v / f.scale.top) * f.plotH;
  const bw = barWidth(f.slot);
  const axis: Axis = {
    yLines: f.scale.ticks.map((v) => ({ y: yFor(v), label: fmtCount(v), axis: v === 0 })),
    xLabels: xLabelsFor(f),
  };
  const bars: Bar[] = [];
  dates.forEach((d, i) => {
    const r = byDate.get(d);
    if (!r) return;
    let acc = 0;
    const x = MARGIN.l + (i + 0.5) * f.slot - bw / 2;
    for (const k of keys) {
      const v = value(r, k.key);
      if (v <= 0) continue;
      const y0 = yFor(acc);
      const y1 = yFor(acc + v);
      bars.push({
        cat: k.cat,
        provisional: !r.final,
        x: fix(x),
        y: fix(y1),
        width: fix(bw),
        height: fix(Math.max(0.5, y0 - y1)),
        title: `${fmtDate(d)}: ${fmtCount(v)} ${v === 1 && k.singular ? k.singular : k.label}${r.final ? "" : " (provisional)"}`,
      });
      acc += v;
    }
  });
  return { frame: f, axis, bars };
}

// ---------------------------------------------------------------------------
// Coins: earned above the axis, spent below, each stacked by reason
// ---------------------------------------------------------------------------

export interface TwoSidedGeometry {
  frame: Frame;
  /** Gridlines above (and mirrored below) the zero line. */
  yLines: { y: number; label: string; axis: boolean }[];
  xLabels: { x: number; label: string }[];
  bars: Bar[];
}

const sum = (o: Record<string, number>): number => Object.values(o).reduce((s, v) => s + v, 0);

export function twoSidedGeometry(input: { rows: UsageDay[]; width: number; height?: number }): TwoSidedGeometry {
  const { rows, width, height = 240 } = input;
  const dates = dateSpan(rows);
  const byDate = new Map(rows.map((r) => [r.date, r] as const));
  const max = Math.max(0, ...rows.map((r) => Math.max(sum(r.coins.earned), sum(r.coins.spent))));
  const f = makeFrame(width, height, dates, max);
  const half = f.plotH / 2;
  const mid = MARGIN.t + half;
  const yUp = (v: number) => mid - (v / f.scale.top) * half;
  const yDown = (v: number) => mid + (v / f.scale.top) * half;
  const bw = barWidth(f.slot);

  const yLines: TwoSidedGeometry["yLines"] = [];
  for (const v of f.scale.ticks) {
    yLines.push({ y: yUp(v), label: fmtCount(v), axis: v === 0 });
    if (v !== 0) yLines.push({ y: yDown(v), label: fmtCount(v), axis: false });
  }

  const bars: Bar[] = [];
  dates.forEach((d, i) => {
    const r = byDate.get(d);
    if (!r) return;
    const x = MARGIN.l + (i + 0.5) * f.slot - bw / 2;
    let acc = 0;
    for (const k of EARNED_REASONS) {
      const v = r.coins.earned[k];
      if (v <= 0) continue;
      const y1 = yUp(acc + v);
      bars.push({
        cat: COIN_REASON_TOKENS.earned[k],
        provisional: !r.final,
        x: fix(x),
        y: fix(y1),
        width: fix(bw),
        height: fix(Math.max(0.5, yUp(acc) - y1)),
        title: `${fmtDate(d)}: ${fmtCount(v)} coins earned, ${REASON_LABELS[k]}`,
      });
      acc += v;
    }
    acc = 0;
    for (const k of SPENT_REASONS) {
      const v = r.coins.spent[k];
      if (v <= 0) continue;
      const y1 = yDown(acc + v);
      bars.push({
        cat: COIN_REASON_TOKENS.spent[k],
        provisional: !r.final,
        x: fix(x),
        y: fix(yDown(acc)),
        width: fix(bw),
        height: fix(Math.max(0.5, y1 - yDown(acc))),
        title: `${fmtDate(d)}: ${fmtCount(v)} coins spent, ${REASON_LABELS[k]}`,
      });
      acc += v;
    }
  });
  return { frame: f, yLines, xLabels: xLabelsFor(f), bars };
}
