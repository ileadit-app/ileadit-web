"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { CompetitionStatusChip } from "@/components/status/CompetitionStatusChip";
import {
  competitionActiveTimeLabel,
  competitionScheduledTimeLabel,
  formatShortDate,
} from "@/lib/competitionDates";
import type { CompetitionStatus } from "@/lib/competitionDetail";

/**
 * WEB-4 item 2 — a `now` that re-renders at least once a minute, so the
 * last-day countdown in `dateLineFor` below counts down instead of freezing
 * at whatever moment the component first mounted. 60s, not something finer
 * (e.g. per-second) — the copy's own resolution is minutes ("5h 12m"), so a
 * faster tick would only cause extra re-renders with no visible benefit.
 * `setInterval`-driven re-render is already an established pattern in this
 * codebase (`HeroSection.tsx`'s rotating-frame timer), just simpler here
 * since there's no visibility/intersection gating need for a small text
 * label the way there is for that hero's larger animation.
 */
function useTickingNow(intervalMs: number = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * The competition hero — the banner band, the status/date line, the name,
 * and the round logo plate that overlaps the band's bottom edge.
 *
 * Extracted verbatim from `CompetitionDetail.tsx` so the creation form's
 * artwork preview can render THE hero rather than a lookalike. That
 * matters specifically because the preview's whole job is to tell an
 * admin what their crop will look like: an approximation that drifts from
 * the real page is worse than no preview, because it is confidently
 * wrong. `CompetitionDetail` now imports this; there is no second copy.
 *
 * The only thing added during extraction is the `size` prop below.
 */

/**
 * The band's height and corner treatment.
 *
 * `responsive` is the real detail page, byte-identical to what
 * `CompetitionDetail` rendered before this extraction: 200px tall below
 * Tailwind's `sm` (640px viewport), 280px at and above it.
 *
 * `phone` and `desktop` pin one of those two cases regardless of the
 * viewport, and exist ONLY for the creation form's preview, which shows
 * both side by side inside a desktop browser window. A viewport-keyed
 * `sm:` class cannot do that — inside a 390px-wide preview frame on a
 * 1440px screen, `sm:h-[280px]` still applies, so a "phone" frame built
 * that way would silently show the desktop band and lie about exactly
 * the thing the preview exists to show. Keeping all three in one map is
 * what stops the preview's numbers drifting from the page's.
 */
const HERO_BAND_CLASS = {
  responsive: "h-[200px] sm:h-[280px] sm:rounded-b-3xl",
  phone: "h-[200px]",
  desktop: "h-[280px] rounded-b-3xl",
} as const;

/**
 * Corner treatment only, for the layout used when a banner image is set
 * (COMP-BRAND-1): the banner is shown as its own 3:1 strip — exactly what
 * a player sees on the list card — and the text block below it sizes to
 * its content instead of a fixed 200/280px. `responsive` mirrors the
 * no-banner `sm:` rounding; `phone` is square; `desktop` is rounded.
 */
const HERO_TEXT_BLOCK_CLASS = {
  responsive: "sm:rounded-b-3xl",
  phone: "",
  desktop: "rounded-b-3xl",
} as const;

/** Banner shape: 3:1, same as `BANNER_ASPECT` in `competitionArtwork.ts`. */
const BANNER_STRIP_CLASS = "aspect-[3/1]";

/**
 * The logo plate, matching the app's details screen (COMP-BRAND-1): a
 * 64 px round white plate with a thin ring. The WHOLE logo is fitted
 * (`object-contain`) inside the square inscribed in the plate's inner
 * circle, so a square logo's corners stay inside the ring and nothing is
 * cropped. Inner circle = 64 − 2 × 2 px border = 60 px; the inscribed
 * square is 60 / √2 ≈ 42 px.
 */
const HERO_LOGO_PLATE_PX = 64;
const HERO_LOGO_INNER_SQUARE_PX = 42;

function HeroLogo({
  imageUrl,
  className,
}: {
  imageUrl: string | null;
  className: string;
}) {
  return (
    <span
      data-testid="hero-logo-plate"
      style={{ width: HERO_LOGO_PLATE_PX, height: HERO_LOGO_PLATE_PX }}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-white shadow-lg ${className}`}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          style={{ width: HERO_LOGO_INNER_SQUARE_PX, height: HERO_LOGO_INNER_SQUARE_PX }}
          className="object-contain"
        />
      ) : (
        <LogoMark className="h-8 w-8" />
      )}
    </span>
  );
}

export type CompetitionHeroSize = keyof typeof HERO_BAND_CLASS;

export interface CompetitionHeroCompetition {
  name: string | null;
  imageUrl: string | null;
  backgroundImageUrl: string | null;
  status: CompetitionStatus | null;
  startDate: string | null;
  endDate: string | null;
  durationDays: number | null;
  /** IANA zone the competition's own dates are computed in (WEB-3 item 3) —
   * feeds `CompetitionStatusChip`'s "Starting today" copy override. */
  timeZone: string | null;
  /** WEB-SPONSOR-NAME — optional; when set (non-blank), a "Sponsored by …"
   * line shows under the name. The detail page reads it from the
   * competition document's `sponsorName` field (`competitionDetail.ts`);
   * the creation form's preview supplies it from the form value. */
  sponsorName?: string | null;
}

function dateLineFor(
  competition: {
    status: CompetitionStatus | null;
    startDate: string | null;
    endDate: string | null;
    durationDays: number | null;
  },
  now: Date,
): string {
  const { status, startDate, endDate, durationDays } = competition;

  if (status === "active") {
    return competitionActiveTimeLabel(startDate, endDate, durationDays, now);
  }
  if (status === "finalising") {
    return "Results locking in";
  }
  if (status === "finished") {
    const endShort = formatShortDate(endDate);
    return endShort ? `Finished ${endShort}` : "Finished";
  }
  // scheduled (or status still resolving) — WEB-4 item 2: "Starts
  // tomorrow"/"Starts Mon 22 Sep", replacing the old start–end range.
  return competitionScheduledTimeLabel(startDate, now);
}

export function CompetitionHero({
  competition,
  size = "responsive",
}: {
  competition: CompetitionHeroCompetition;
  size?: CompetitionHeroSize;
}) {
  // Only the "active" branch's last-day countdown actually changes between
  // ticks; every other status renders a static string from this same
  // `now`. Ticking unconditionally (rather than only for active
  // competitions) keeps this one hook call unconditional per the rules of
  // hooks, and the cost of an idle 60s timer on a static-copy hero is
  // negligible.
  const now = useTickingNow();
  const sponsorName = competition.sponsorName?.trim() ?? "";
  const hasBanner = Boolean(competition.backgroundImageUrl);

  const textBlock = (
    <div
      className={`mx-auto flex max-w-5xl flex-col px-5 sm:px-6 ${
        hasBanner ? "pb-8 pt-10" : "relative z-10 h-full justify-end pb-8"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <CompetitionStatusChip
          status={competition.status}
          startDate={competition.startDate}
          timeZone={competition.timeZone}
        />
        {/* `tabular-nums` — WEB-4 item 2's "no layout shift" requirement:
            the last-day countdown's digits change every tick
            (`5h 12m` -> `5h 11m`), and proportional digit widths in the
            body font would otherwise cause the surrounding chip/heading
            to visibly reflow by a pixel or two once a minute. */}
        <span className="text-sm tabular-nums text-on-navy-muted">{dateLineFor(competition, now)}</span>
      </div>
      <h1 className="mt-2 text-2xl font-extrabold text-on-navy-foreground sm:text-3xl">
        {competition.name ?? "Untitled competition"}
      </h1>
      {sponsorName ? (
        <p className="mt-1 break-words text-sm text-on-navy-muted">Sponsored by {sponsorName}</p>
      ) : null}
    </div>
  );

  if (hasBanner) {
    return (
      <div className="relative">
        <div className={`bg-brand-navy ${HERO_TEXT_BLOCK_CLASS[size]}`}>
          {/* The banner at its real 3:1 shape — what a player sees on the
              list card. `object-cover`, so an older 16:9 upload is trimmed
              into the frame rather than stretched. The round logo straddles
              the strip's bottom-left, mirroring the app, which is exactly
              the corner the crop dialog tints as "logo overlap". */}
          <div className="relative mx-auto max-w-5xl sm:px-6 sm:pt-4">
            <div
              data-testid="hero-banner"
              className={`relative overflow-hidden bg-brand-navy-deep sm:rounded-2xl ${BANNER_STRIP_CLASS}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote,
                  admin-supplied URL; not a build-time-known asset. */}
              <img
                src={competition.backgroundImageUrl ?? undefined}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <HeroLogo
              imageUrl={competition.imageUrl}
              className="absolute bottom-0 left-5 translate-y-1/2 sm:left-12"
            />
          </div>
          {textBlock}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className={`relative overflow-hidden bg-brand-navy ${HERO_BAND_CLASS[size]}`}>
        <div
          className="absolute -right-10 -top-10 size-56 rounded-full bg-brand-pink/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-16 left-10 size-64 rounded-full bg-brand-gold/15 blur-3xl"
          aria-hidden="true"
        />
        {/* No-prize-field note: the design doc specifies a speculative prize
            pill here (§4), gated on a `prizeDescription`-shaped field that
            does not exist anywhere in the engine schema (grep of
            `functions/src` and `firestore.rules` for "prize" is zero
            matches). Deliberately not rendered — an empty slot beats a
            fabricated placeholder string. */}
        {textBlock}
      </div>

      <div className="mx-auto max-w-5xl px-5 sm:px-6">
        <HeroLogo imageUrl={competition.imageUrl} className="relative -mt-8" />
      </div>
    </div>
  );
}
