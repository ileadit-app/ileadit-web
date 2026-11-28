"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import {
  MARGIN,
  lineGeometry,
  stackedGeometry,
  twoSidedGeometry,
  type Bar,
  type BarKey,
  type Axis,
  type LineSeriesInput,
} from "@/lib/usageCharts";
import type { UsageDay } from "@/lib/usageMetrics";

/**
 * Hand-written inline SVG charts for the admin usage page. No chart library
 * and no external request. All geometry comes from `src/lib/usageCharts.ts`.
 *
 * Every chart is drawn at the width of its container (measured with a
 * ResizeObserver, 1 SVG unit = 1 CSS pixel), never scaled down from a fixed
 * viewBox, so the 12px axis text stays 12px on a 360px phone. Before the first
 * measurement (server render, tests) it uses CHART_WIDTH. Series are told apart by pattern and a
 * labelled legend as well as by colour: categories 4 to 6 are hatched unless a
 * chart asks for solid fills (coin reasons, which each have their own colour).
 */

export const CHART_WIDTH = 440;
/** Widest a chart is drawn (the old max-w-2xl) and the narrowest we will plot. */
export const CHART_MAX_WIDTH = 672;
export const CHART_MIN_WIDTH = 240;
/** Axis text size in CSS pixels. At least 11px at every width. */
export const AXIS_FONT_PX = 12;

export function clampChartWidth(measured: number): number {
  if (!Number.isFinite(measured) || measured <= 0) return CHART_WIDTH;
  return Math.max(CHART_MIN_WIDTH, Math.min(CHART_MAX_WIDTH, Math.floor(measured)));
}

/** Width of the element the ref is attached to, clamped; CHART_WIDTH until measured. */
function useChartWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(CHART_WIDTH);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(clampChartWidth(el.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const catColour = (n: number): string => `var(--usage-cat-${n})`;

/** Hatched categories (the 4th to 6th) so a key is told apart without colour. */
export const HATCHED_FROM = 4;
export const HATCHED_TO = 6;

/** One hidden <svg> holds the hatch patterns every chart and swatch refers to. */
export function UsageSvgDefs() {
  const ids: number[] = [];
  for (let i = HATCHED_FROM; i <= HATCHED_TO; i += 1) ids.push(i);
  return (
    <svg width={0} height={0} aria-hidden="true" focusable="false" className="absolute">
      <defs>
        {ids.map((i) => (
          <pattern
            key={i}
            id={`usage-pat-${i}`}
            width={6}
            height={6}
            patternUnits="userSpaceOnUse"
            patternTransform={i === 5 ? "rotate(-45)" : "rotate(45)"}
          >
            <rect width={6} height={6} fill={catColour(i)} />
            <line x1={0} y1={0} x2={0} y2={6} stroke="#ffffff" strokeWidth={2} />
          </pattern>
        ))}
      </defs>
    </svg>
  );
}

function fillFor(cat: number, solid: boolean): string {
  return !solid && cat >= HATCHED_FROM && cat <= HATCHED_TO ? `url(#usage-pat-${cat})` : catColour(cat);
}

export function Swatch({ cat, solid = false }: { cat: number; solid?: boolean }) {
  return (
    <svg viewBox="0 0 14 14" width={14} height={14} aria-hidden="true" className="shrink-0">
      <rect width={14} height={14} rx={2} fill={fillFor(cat, solid)} />
    </svg>
  );
}

export interface LegendItem {
  cat: number;
  solid?: boolean;
  label: string;
  note?: string;
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Legend">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <Swatch cat={it.cat} solid={it.solid} />
          <span>{it.label}</span>
          {it.note ? <span>{it.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}

const AXIS_STROKE = "#44566c";
const GRID_STROKE = "#dfe2ee";

function AxisLines({ axis, width }: { axis: Pick<Axis, "yLines">; width: number }) {
  return (
    <>
      {axis.yLines.map((l, i) => (
        <g key={`y${i}`}>
          <line
            x1={MARGIN.l}
            x2={width - MARGIN.r}
            y1={l.y}
            y2={l.y}
            stroke={l.axis ? AXIS_STROKE : GRID_STROKE}
            strokeWidth={1}
          />
          <text x={MARGIN.l - 6} y={l.y + 4} textAnchor="end" fontSize={AXIS_FONT_PX} fill={AXIS_STROKE}>
            {l.label}
          </text>
        </g>
      ))}
    </>
  );
}

function XLabels({ labels, height }: { labels: Axis["xLabels"]; height: number }) {
  return (
    <>
      {labels.map((l, i) => (
        <text key={`x${i}`} x={l.x} y={height - 6} textAnchor="middle" fontSize={AXIS_FONT_PX} fill={AXIS_STROKE}>
          {l.label}
        </text>
      ))}
    </>
  );
}

function Svg({
  width,
  height,
  label,
  wrapRef,
  children,
}: {
  width: number;
  height: number;
  label: string;
  wrapRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  return (
    <div ref={wrapRef} className="w-full max-w-2xl" data-chart-width={width}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        className="block h-auto max-w-full overflow-visible"
      >
        <title>{label}</title>
        {children}
      </svg>
    </div>
  );
}

function BarRects({ bars, solid }: { bars: Bar[]; solid: boolean }) {
  return (
    <>
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width={b.width}
          height={b.height}
          fill={fillFor(b.cat, solid)}
          opacity={b.provisional ? 0.55 : 1}
          stroke={b.provisional ? "#12172a" : undefined}
          strokeWidth={b.provisional ? 1 : undefined}
          strokeDasharray={b.provisional ? "3 2" : undefined}
          data-provisional={b.provisional ? "true" : undefined}
        >
          <title>{b.title}</title>
        </rect>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------

/** Line colour per series class: main = cat 1, average = cat 2. */
const LINE_CAT: Record<string, number> = { "line-main": 1, "line-avg": 2 };

export function LineChart({
  rows,
  series,
  label,
  height = 200,
}: {
  rows: { date: string }[];
  series: LineSeriesInput[];
  label: string;
  height?: number;
}) {
  const [ref, width] = useChartWidth();
  const g = lineGeometry({ rows, series, width, height });
  return (
    <Svg width={width} height={height} label={label} wrapRef={ref}>
      <AxisLines axis={g.axis} width={width} />
      <XLabels labels={g.axis.xLabels} height={height} />
      {g.series.map((s) => {
        const colour = catColour(LINE_CAT[s.cls] ?? 1);
        const common = { fill: "none", stroke: colour, strokeWidth: s.cls === "line-avg" ? 1.5 : 2 };
        return (
          <g key={s.cls}>
            {s.solid ? <path d={s.solid} {...common} /> : null}
            {s.dashed ? <path d={s.dashed} {...common} strokeDasharray="4 3" data-dashed="true" /> : null}
            {s.dots.map((d, i) => (
              <circle
                key={i}
                cx={d.cx}
                cy={d.cy}
                r={d.r}
                fill={d.provisional ? "#ffffff" : colour}
                stroke={colour}
                strokeWidth={d.provisional ? 2 : 0}
                data-provisional={d.provisional ? "true" : undefined}
              >
                <title>{d.title}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </Svg>
  );
}

export function StackedBars({
  rows,
  keys,
  value,
  label,
  height = 200,
}: {
  rows: UsageDay[];
  keys: BarKey[];
  value: (row: UsageDay, key: string) => number;
  label: string;
  height?: number;
}) {
  const [ref, width] = useChartWidth();
  const g = stackedGeometry({ rows, keys, value, width, height });
  return (
    <Svg width={width} height={height} label={label} wrapRef={ref}>
      <AxisLines axis={g.axis} width={width} />
      <XLabels labels={g.axis.xLabels} height={height} />
      <BarRects bars={g.bars} solid={false} />
    </Svg>
  );
}

export function TwoSidedBars({ rows, label, height = 240 }: { rows: UsageDay[]; label: string; height?: number }) {
  const [ref, width] = useChartWidth();
  const g = twoSidedGeometry({ rows, width, height });
  return (
    <Svg width={width} height={height} label={label} wrapRef={ref}>
      <AxisLines axis={{ yLines: g.yLines }} width={width} />
      <XLabels labels={g.xLabels} height={height} />
      <BarRects bars={g.bars} solid />
    </Svg>
  );
}

/** A plain horizontal bar. `share` is 0..1 of the widest. */
export function HBar({ share, cat = 1, hatched = false }: { share: number; cat?: number; hatched?: boolean }) {
  const pct = Math.round(Math.max(0, Math.min(1, share)) * 100);
  const style: CSSProperties = { width: `${pct}%`, background: catColour(cat) };
  return (
    <span className="block h-3 w-full overflow-hidden rounded-full bg-muted" role="presentation">
      <span
        className="block h-full rounded-full"
        style={
          hatched
            ? {
                ...style,
                backgroundImage: "repeating-linear-gradient(45deg, transparent 0 3px, rgba(255,255,255,0.85) 3px 5px)",
              }
            : style
        }
        data-share={pct}
      />
    </span>
  );
}
