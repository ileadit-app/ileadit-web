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
