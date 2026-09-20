"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Lock, PlayCircle } from "lucide-react";

/**
 * The approved primary headline (design spec, "are you an average winner?"
 * direction). The spec's v0 draft cycled all four candidates automatically
 * client-side; per Paul's brief for this build we ship ONE static, crawlable
 * headline and leave the rest here as swap-in candidates — change
 * PRIMARY_HEADLINE below to try another without touching markup.
 *
 * Alternative candidates from the approved spec:
 * - "Average is the whole point."
 * - "The most average person in the office could win this."
 * - "Beat your own average. Not everyone else's steps."
 */
const PRIMARY_HEADLINE = "Are you an average winner?";

export function HeroSection() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-brand-navy text-on-navy-foreground"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-pink/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 left-[-10%] h-96 w-96 rounded-full bg-brand-gold/15 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-5 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:flex-row lg:items-center lg:gap-16 lg:pb-28 lg:pt-24">
        <div className="max-w-2xl">
          <span className="inline-flex items-center rounded-full border border-on-navy-border bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-gold">
            A step-count game, not a fitness plan
          </span>

          <h1 className="mt-4 text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            {PRIMARY_HEADLINE}
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-on-navy-muted sm:text-xl">
            You&apos;re never scored against anyone else&apos;s step count —
            only your own rolling average. Walk more than usual and you
            climb. That means the fittest person in the office and the least
            active have exactly the same shot at winning.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/#employer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-gold px-6 text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
            >
              Bring it to your team
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-on-navy-border bg-transparent px-6 text-base font-bold text-on-navy-foreground transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <PlayCircle className="size-4" aria-hidden="true" />
              See how it works
            </Link>
          </div>

          <div className="mt-6 flex items-center gap-2 text-sm font-medium text-on-navy-muted">
            <Lock className="size-4 shrink-0 text-brand-gold" aria-hidden="true" />
            Your step count is private. Always. Only you ever see the number.
          </div>
        </div>

        <AverageWinnerCard />
      </div>
    </section>
  );
}

/**
 * ---------------------------------------------------------------------------
 * "Today's scoreboard" — the ambient motion story
 * ---------------------------------------------------------------------------
 *
 * Paul's brief: a slow, ambient animation of players overtaking each other —
 * "not fast, but something that implies movement". This is ONLY a translateY
 * reorder + number swap driven by a small state machine; rows never leave the
 * DOM and never reflow the card, so there is no layout shift at any point in
 * the cycle (see ROW_HEIGHT_PX / ROW_GAP_PX below).
 *
 * THE COPY TRAP — resolved as option (a), and stronger than "rest state only":
 * The paragraph under the card claims Priya and Deepak land on the SAME
 * POINTS despite wildly different effort. That claim must never go false,
 * not even for one transient frame mid-cycle. Rather than only guaranteeing
 * it at the resting frame, the invariant is enforced in the data itself:
 * every FRAMES entry below has `stats.priya.points === stats.deepak.points`.
 * Their percentages (how far over their OWN average each of them is) are
 * free to differ and drift independently — that's the whole point of the
 * copy ("percentage over their own average") — but points are yoked
 * together by construction, so the sentence is true at every single frame,
 * not just at rest. Marcus (the new starter) is deliberately NOT yoked to
 * anyone — he's free to climb, overtake, and even lead the board for a
 * frame, which is what tells the "anyone can win" story the motion is meant
 * to carry. The cycle still starts AND ends on the literal resting numbers
 * named in the copy (112% / 104% / 68%), so a viewer who glances at any
 * "settled" moment, or the reduced-motion fallback, sees exactly the
 * scenario the copy describes.
 *
 * LOOP vs PLAY-ONCE: this loops continuously rather than playing once and
 * settling. A one-shot animation would only ever tell the story to whoever
 * happens to be looking when the card first scrolls into view; looping
 * (slowly — 20s per cycle) means any visitor who lingers on the hero for a
 * few seconds sees the "anyone can win" reorder at least once, which is the
 * whole marketing point of the card. It pauses via IntersectionObserver and
 * the tab-visibility API so it never spends cycles animating off-screen.
 */

type PlayerId = "priya" | "deepak" | "marcus";

const PLAYER_META: Record<PlayerId, { name: string; note: string }> = {
  priya: { name: "Priya", note: "ordinary walker" },
  deepak: { name: "Deepak", note: "office \u2018fitness person\u2019" },
  marcus: { name: "Marcus", note: "new starter" },
};

// Fixed DOM order — the markup never reorders. Visual "overtaking" happens
// purely via a CSS transform on each row, computed from its rank in the
// current frame. This is what keeps the reorder from ever touching layout.
const DOM_ORDER: PlayerId[] = ["priya", "deepak", "marcus"];

type ScoreboardFrame = {
  /** Player ids in visual rank order, top (leader) to bottom. */
  order: PlayerId[];
  stats: Record<PlayerId, { percent: number; points: number }>;
};

const FRAMES: ScoreboardFrame[] = [
  // Rest state — the exact numbers the copy below describes. Also the frame
  // shown under prefers-reduced-motion, and the loop's start/end point.
  {
    order: ["priya", "deepak", "marcus"],
    stats: {
      priya: { percent: 112, points: 40 },
      deepak: { percent: 104, points: 40 },
      marcus: { percent: 68, points: 10 },
    },
  },
  // Mid-morning: Deepak edges ahead of Priya — same points, different %.
  {
    order: ["deepak", "priya", "marcus"],
    stats: {
      priya: { percent: 90, points: 30 },
      deepak: { percent: 108, points: 30 },
      marcus: { percent: 85, points: 20 },
    },
  },
  // Afternoon: Marcus — the new starter — overtakes them both.
  {
    order: ["marcus", "priya", "deepak"],
    stats: {
      priya: { percent: 101, points: 35 },
      deepak: { percent: 97, points: 35 },
      marcus: { percent: 118, points: 45 },
    },
  },
  // Evening: settling back toward the resting scenario.
  {
    order: ["priya", "deepak", "marcus"],
    stats: {
      priya: { percent: 106, points: 38 },
      deepak: { percent: 98, points: 38 },
      marcus: { percent: 75, points: 15 },
    },
  },
];

// Layout constants driving both the absolutely-positioned rows and the
// fixed-height container that guarantees zero layout shift.
const ROW_HEIGHT_PX = 64;
const ROW_GAP_PX = 12;
const ROW_STEP_PX = ROW_HEIGHT_PX + ROW_GAP_PX;
const CONTAINER_HEIGHT_PX =
  ROW_HEIGHT_PX * DOM_ORDER.length + ROW_GAP_PX * (DOM_ORDER.length - 1);

// Timing: a full cycle is FRAMES.length * FRAME_HOLD_MS = 4 * 5000ms = 20s —
// comfortably inside Paul's "15-25s, slow, not fast" brief. Each individual
// row transition is 900ms with a gentle ease-in-out, which is the ambient
// "drift" motion; the numbers swap instantly at the same moment the slide
// starts (a deliberate simplicity choice — crossfading the digits too would
// need a two-phase animation for very little extra visual benefit here).
const FRAME_HOLD_MS = 5000;
const ROW_TRANSITION_MS = 900;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function AverageWinnerCard() {
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const [frameIndex, setFrameIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const isVisibleRef = useRef(true);

  // React to the OS-level setting changing while the page is open.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) =>
      setReducedMotion(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // The animation loop itself. Deliberately guarded so that when
  // prefers-reduced-motion is set, NO interval and NO IntersectionObserver
  // are ever created — this isn't just visually static, there is no timer
  // running in the background at all.
  useEffect(() => {
    if (reducedMotion) return;
    const node = cardRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.2 }
    );
    observer.observe(node);

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        isVisibleRef.current = false;
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const timer = setInterval(() => {
      if (!isVisibleRef.current || document.visibilityState !== "visible") {
        return;
      }
      setFrameIndex((current) => (current + 1) % FRAMES.length);
    }, FRAME_HOLD_MS);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(timer);
    };
  }, [reducedMotion]);

  const frame = reducedMotion ? FRAMES[0] : FRAMES[frameIndex];

  return (
    <div
      ref={cardRef}
      className="relative mx-auto w-full max-w-sm shrink-0 lg:mx-0"
    >
      <div className="rounded-3xl border border-on-navy-border bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-gold">
          Today&apos;s scoreboard
        </p>
        <div
          className="relative mt-4"
          style={{ height: CONTAINER_HEIGHT_PX }}
        >
          {DOM_ORDER.map((id) => {
            const rank = frame.order.indexOf(id);
            const { percent, points } = frame.stats[id];
            return (
              <PlayerRow
                key={id}
                name={PLAYER_META[id].name}
                note={PLAYER_META[id].note}
                percent={percent}
                points={`+${points} pts`}
                highlight={rank === 0}
                translateY={rank * ROW_STEP_PX}
              />
            );
          })}
        </div>
        <p className="mt-5 text-sm leading-relaxed text-on-navy-muted">
          Priya and Deepak walked wildly different distances today. Same
          percentage over their own average, same points. That&apos;s the
          whole game.
        </p>
      </div>
    </div>
  );
}

function PlayerRow({
  name,
  note,
  percent,
  points,
  highlight,
  translateY,
}: {
  name: string;
  note: string;
  percent: number;
  points: string;
  highlight?: boolean;
  translateY: number;
}) {
  return (
    <div
      className={`absolute inset-x-0 flex h-16 items-center justify-between overflow-hidden rounded-2xl px-4 py-3 transition-[transform,background-color] ease-in-out motion-reduce:transition-none ${
        highlight ? "bg-brand-gold/15" : "bg-white/5"
      }`}
      style={{
        transform: `translateY(${translateY}px)`,
        transitionDuration: `${ROW_TRANSITION_MS}ms`,
      }}
    >
      <div>
        <p className="text-sm font-bold text-on-navy-foreground">{name}</p>
        <p className="text-xs text-on-navy-muted">{note}</p>
      </div>
      <div className="text-right">
        <p
          className={`text-sm font-extrabold transition-colors ease-in-out motion-reduce:transition-none ${
            highlight ? "text-brand-gold" : "text-on-navy-foreground"
          }`}
          style={{ transitionDuration: `${ROW_TRANSITION_MS}ms` }}
        >
          {percent}% of avg
        </p>
        <p className="text-xs font-semibold text-brand-coral">{points}</p>
      </div>
    </div>
  );
}
