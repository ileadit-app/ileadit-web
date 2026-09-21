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
export function dayNumberToday(
  startDate: string | null,
  durationDays: number | null,
  now: Date = new Date(),
): number | null {
  const start = startDate ? parseLocalDate(startDate) : null;
  if (!start) return null;
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((todayMid.getTime() - start.getTime()) / 86_400_000) + 1;
  const clampedLow = Math.max(diff, 1);
  return durationDays ? Math.min(clampedLow, durationDays) : clampedLow;
}

/**
 * WEB-3 item 3. Matches the engine's own fallback
 * (`functions/src/config/constants.ts`'s `DEFAULT_COMPETITION_ZONE`, ileadit
 * engine repo) — used whenever a competition document has no `timeZone` of
 * its own (older documents, or a transient read before the engine's
 * `onCompetitionWritten` trigger has populated it).
 */
export const DEFAULT_COMPETITION_ZONE = "Europe/London";

/** `YYYY-MM-DD` for `date`, as read inside `timeZone`. `en-CA` formats in
 * that exact digit order, matching the engine's own date-string format
 * (`localDate`, `functions/src/domain/dates.ts`) so the two compare/sort
 * correctly as plain strings. Same technique as `todayCard.ts`'s private
 * `formatDateInZone` — duplicated rather than imported since that one is
 * file-private and this module has no existing dependency on `todayCard.ts`. */
function zonedDateString(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function resolveZone(timeZone: string | null): string {
  return timeZone && timeZone !== "" ? timeZone : DEFAULT_COMPETITION_ZONE;
}

/**
 * WEB-3 item 3 — "starting today" copy override. The engine's
 * `competitionLifecycle` job derives `status: "scheduled" -> "active"`
 * asynchronously and can lag up to ~15 minutes behind a competition's real
 * start moment, so a competition can genuinely be under way while a client
 * still reads `status: "scheduled"`. This is a COPY-ONLY signal for that
 * window: true once the competition's own `startDate` (compared inside its
 * own `timeZone`, defaulting to `DEFAULT_COMPETITION_ZONE`, never the
 * viewer's browser zone — a UK company's competition should read "Starting
 * today" the same way for an admin checking in from any timezone) is today
 * or earlier. It must NEVER feed back into `competition-status.ts`'s
 * canonical status derivation — only into what a `"scheduled"` chip's LABEL
 * says. `CompetitionStatusChip` is the only caller.
 */
export function isCompetitionStartingToday(
  startDate: string | null,
  timeZone: string | null,
  now: Date = new Date(),
): boolean {
  if (!startDate) return false;
  return zonedDateString(now, resolveZone(timeZone)) >= startDate;
}

/**
 * WEB-3 item 3 — the real join-gate check, mirroring the engine's JOIN-1
 * change (`joinCompetitionService`, ileadit engine repo commit `7629e40`):
 * `isDayOneOfActive = status === "active" && localDate(now, compZone) ===
 * startDate`. Unlike `isCompetitionStartingToday` above (a "today or
 * earlier" copy nicety), this is an EXACT match on the competition's own
 * calendar day — the engine only accepts a join on the specific day a
 * competition became active, never on any later active day. Callers must
 * also check `status === "active"` themselves; this function only answers
 * the date half of that condition (kept separate from `status` since some
 * callers already have `status` narrowed by an outer branch and don't want
 * to pass it twice).
 */
export function isDayOneOfActiveCompetition(
  startDate: string | null,
  timeZone: string | null,
  now: Date = new Date(),
): boolean {
  if (!startDate) return false;
  return zonedDateString(now, resolveZone(timeZone)) === startDate;
}

/** `YYYY-MM-DD` for `date` in whatever zone the JS runtime itself considers
 * "local" (the browser's own zone on the client; the host machine's zone in
 * Node/tests) — deliberately NOT zone-parameterised, unlike
 * `zonedDateString` above. WEB-4 item 2's hybrid time-remaining copy is
 * explicitly defined against the VIEWER's own local date, never the
 * competition's `timeZone` field, so this helper must not take one. */
function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Local midnight at the START of the calendar day immediately after
 * `date`, in the runtime's own local zone. The "end of the viewer's day"
 * countdown target for WEB-4 item 2's last-day copy. */
function startOfNextLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

/** `"5h 12m"` — floors to whole minutes (the countdown re-renders at least
 * once a minute per the ticket, so a floor never visibly "loses" a
 * minute the way a ceil would visibly gain one). Clamped at zero so a
 * stale/overdue `now` never renders a negative duration. */
function formatDurationHM(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

/** `"Mon 22 Sep"` (en-GB, matches `formatShortDate`'s existing locale
 * choice) — `formatShortDate` deliberately omits the weekday for the
 * Dates card's compact range display; WEB-4 item 2's "Starts …" copy
 * needs the weekday, so this is a sibling formatter, not a `formatShortDate`
 * option flag (keeps each caller's exact previous output pinned). */
function formatWeekdayShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

/**
 * WEB-4 item 2 — Paul's "hybrid" decision for an ACTIVE competition's date
 * line (the Android app implements the identical rule): "Day N of X" on
 * every day except the last, and on the last day a countdown to the end of
 * the VIEWER's own local day ("Last day — ends in 5h 12m"), not the
 * competition's own `timeZone`. This deliberately diverges from
 * `isDayOneOfActiveCompetition`/`isCompetitionStartingToday` above, which
 * anchor to the competition's own zone because they either mirror a real
 * engine gate or need to read the same for every viewer regardless of
 * where they are — this is copy about a moment (the viewer's midnight)
 * that only makes sense in the viewer's own zone, so it has no `timeZone`
 * parameter at all.
 *
 * "Last day" is decided against `endDate` directly (the competition's own
 * authoritative last calendar day) rather than re-deriving it from
 * `startDate + durationDays`, so a future engine change to how those two
 * relate can't silently desync the countdown trigger from the displayed
 * day count.
 */
export function competitionActiveTimeLabel(
  startDate: string | null,
  endDate: string | null,
  durationDays: number | null,
  now: Date = new Date(),
): string {
  const day = dayNumberToday(startDate, durationDays, now);
  const isLastDay = endDate
    ? localDateString(now) === endDate
    : day !== null && durationDays !== null && day === durationDays;

  if (isLastDay) {
    const msRemaining = startOfNextLocalDay(now).getTime() - now.getTime();
    return `Last day — ends in ${formatDurationHM(msRemaining)}`;
  }
  if (day && durationDays) {
    return `Day ${day} of ${durationDays}`;
  }
  return "Live now";
}

/**
 * WEB-4 item 2 — the "before the start" half of the same decision:
 * "Starts tomorrow" / "Starts Mon 22 Sep", replacing the old scheduled-line
 * date range. Compared against the VIEWER's own local date for the same
 * reason as `competitionActiveTimeLabel` above — "tomorrow" is a claim
 * about the viewer's own day, not the competition's.
 */
export function competitionScheduledTimeLabel(startDate: string | null, now: Date = new Date()): string {
  const start = startDate ? parseLocalDate(startDate) : null;
  if (!start || !startDate) return "Dates being finalised";

  const todayStr = localDateString(now);
  if (startDate === todayStr) return "Starts today";

  const tomorrowStr = localDateString(startOfNextLocalDay(now));
  if (startDate === tomorrowStr) return "Starts tomorrow";

  return `Starts ${formatWeekdayShortDate(start)}`;
}
