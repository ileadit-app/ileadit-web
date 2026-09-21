"use client";

import { LogoMark } from "@/components/brand/Logo";
import { CompetitionStatusChip } from "@/components/status/CompetitionStatusChip";
import { dayNumberToday, formatShortDate } from "@/lib/competitionDates";
import type { CompetitionStatus } from "@/lib/competitionDetail";

/**
 * The competition hero — the banner band, the status/date line, the name,
 * and the circular tile that overlaps the band's bottom edge.
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
}

function dateLineFor(competition: {
  status: CompetitionStatus | null;
  startDate: string | null;
  endDate: string | null;
  durationDays: number | null;
}): string {
  const { status, startDate, endDate, durationDays } = competition;
  const startShort = formatShortDate(startDate);
  const endShort = formatShortDate(endDate);

  if (status === "active") {
    const day = dayNumberToday(startDate, durationDays);
    return day && durationDays ? `Day ${day} of ${durationDays}` : "Live now";
  }
  if (status === "finalising") {
    return "Results locking in";
  }
  if (status === "finished") {
    return endShort ? `Finished ${endShort}` : "Finished";
  }
  // scheduled (or status still resolving)
  if (startShort && endShort && durationDays) {
    return `${startShort} – ${endShort} · ${durationDays} ${durationDays === 1 ? "day" : "days"}`;
  }
  return "Dates being finalised";
}

export function CompetitionHero({
  competition,
  size = "responsive",
}: {
  competition: CompetitionHeroCompetition;
  size?: CompetitionHeroSize;
}) {
  return (
    <div className="relative">
      <div className={`relative overflow-hidden bg-brand-navy ${HERO_BAND_CLASS[size]}`}>
        {competition.backgroundImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- remote,
                admin-supplied URL; not a build-time-known asset. */}
            <img
              src={competition.backgroundImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/95 via-brand-navy/60 to-brand-navy/20" />
          </>
        ) : (
          <>
            <div
              className="absolute -right-10 -top-10 size-56 rounded-full bg-brand-pink/20 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="absolute -bottom-16 left-10 size-64 rounded-full bg-brand-gold/15 blur-3xl"
              aria-hidden="true"
            />
          </>
        )}
        {/* No-prize-field note: the design doc specifies a speculative prize
            pill here (§4), gated on a `prizeDescription`-shaped field that
            does not exist anywhere in the engine schema (grep of
            `functions/src` and `firestore.rules` for "prize" is zero
            matches). Deliberately not rendered — an empty slot beats a
            fabricated placeholder string. */}
        <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col justify-end px-5 pb-8 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <CompetitionStatusChip
              status={competition.status}
              startDate={competition.startDate}
              timeZone={competition.timeZone}
            />
            <span className="text-sm text-on-navy-muted">{dateLineFor(competition)}</span>
          </div>
          <h1 className="mt-2 text-2xl font-extrabold text-on-navy-foreground sm:text-3xl">
            {competition.name ?? "Untitled competition"}
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5 sm:px-6">
        <span className="relative -mt-7 flex size-14 items-center justify-center overflow-hidden rounded-full bg-card shadow-lg ring-4 ring-white">
          {competition.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={competition.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <LogoMark className="h-8 w-8" />
          )}
        </span>
      </div>
    </div>
  );
}
