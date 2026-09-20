/**
 * Date display helpers for competition surfaces.
 *
 * Lifted out of `CompetitionDetail.tsx` (unchanged in behaviour) when the
 * hero was extracted into its own component for reuse by the creation
 * form's live preview — `formatShortDate` is needed by both the hero and
 * the detail page's Dates card, and a second copy of a date formatter is
 * exactly the kind of drift the W10-STATECHIP extraction was about.
 */

/** Parses a `YYYY-MM-DD` calendar date as LOCAL midnight. `new Date("…")`
 * on that string parses as UTC, which shifts the displayed day by one in
 * any negative-offset zone — hence the explicit component parse. */
export function parseLocalDate(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function formatShortDate(value: string | null): string | null {
  const date = value ? parseLocalDate(value) : null;
  if (!date) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

/** Approximate "day N of the competition" from the competition's own
 * `startDate` calendar and the VIEWER's local today — the engine's
 * `closeDays` job is the real authority on which day is scored; this is
 * display-only framing, not used for anything that gates an action. */
export function dayNumberToday(startDate: string | null, durationDays: number | null): number | null {
  const start = startDate ? parseLocalDate(startDate) : null;
  if (!start) return null;
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((todayMid.getTime() - start.getTime()) / 86_400_000) + 1;
  const clampedLow = Math.max(diff, 1);
  return durationDays ? Math.min(clampedLow, durationDays) : clampedLow;
}
