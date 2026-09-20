/**
 * Timezone helpers for the competition creation form (P1.4). Exists because
 * of a genuine bug named in the ticket: "every competition currently
 * defaults to Europe/London... the moment a non-UK company runs one" — the
 * engine derives `startDate`/`endDate` from `startTime` + `timeZone`
 * (`localDate(startTime, zone)`, automation-hub gap audit §"Competition
 * lifecycle"), so a wrong or missing zone silently shifts every day
 * boundary for that competition.
 */

/** A reasonable, curated fallback list — used only when the browser has no
 * `Intl.supportedValuesOf` (older Safari/webviews). Deliberately NOT the
 * source of truth; `getTimeZoneOptions()` below prefers the real IANA list
 * whenever the runtime can provide it. */
const FALLBACK_TIME_ZONES = [
  "UTC",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Lisbon",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

/** Every option the timezone `<select>` should offer. Prefers
 * `Intl.supportedValuesOf("timeZone")` (the real, canonical IANA list, and
 * also therefore a free validity check — every value it returns is valid by
 * construction) and falls back to the curated list above only when that API
 * is unavailable. */
export function getTimeZoneOptions(): string[] {
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      const zones = Intl.supportedValuesOf("timeZone");
      if (zones.length > 0) return zones;
    } catch {
      // fall through to the curated list
    }
  }
  return [...FALLBACK_TIME_ZONES];
}

/** The visitor's own timezone, used as the form's default — replacing the
 * old hardcoded Europe/London default this ticket exists to fix. Falls back
 * to Europe/London only if the runtime genuinely can't say (never as the
 * first choice). */
export function detectBrowserTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone || "Europe/London";
  } catch {
    return "Europe/London";
  }
}

/** True if `zone` is a timezone name `Intl` recognises. Used as a last-line
 * client-side check before submit — the callable is expected to validate
 * this for real server-side (per the P1.4 ticket contract), this is only
 * UI-level defence against a corrupted/handwritten value. */
export function isValidTimeZone(zone: string): boolean {
  try {
    // Constructed only to trigger the RangeError Intl throws for an
    // unrecognised zone name — nothing about the instance is kept.
    new Intl.DateTimeFormat(undefined, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Parses an HTML `<input type="datetime-local">` value (`YYYY-MM-
 * DDTHH:mm`, no timezone/offset — that's the whole reason this file exists)
 * into its plain wall-clock components. Returns `null` for anything that
 * doesn't match, including an empty/unset field. */
export function parseDateTimeLocalValue(
  value: string,
): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
}

/**
 * Converts "this wall-clock time, in this IANA zone" into the real UTC
 * instant (a `Date`) it represents — the piece a `<input type="datetime-
 * local">` value is deliberately missing (the HTML spec gives it no
 * timezone at all; browsers do NOT let you attach one). Naively doing
 * `new Date(datetimeLocalValue)` would silently use the BROWSER's own
 * local zone, not the competition's chosen zone — exactly the kind of bug
 * this ticket exists to close.
 *
 * Standard timezone-conversion trick using only `Intl` (no date library):
 * take the wall-clock values as an initial UTC guess, ask `Intl` what that
 * instant's wall-clock time would read as *inside* `timeZone`, and use the
 * difference to correct the guess. Accurate to the minute in all normal
 * cases; the one known edge case is a wall-clock time that falls inside a
 * DST "spring forward" gap (a time that never occurs in that zone) or
 * "fall back" overlap (a time that occurs twice) — this resolves those to
 * whichever instant `Intl`'s own DST rules pick, which is an acceptable,
 * rare edge case for a competition start time rather than something this
 * form tries to disambiguate for the user.
 */
export function zonedWallTimeToDate(
  parts: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
): Date {
  const utcGuessMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const fields = Object.fromEntries(
    formatter.formatToParts(new Date(utcGuessMs)).map((part) => [part.type, part.value]),
  );
  const zonedReadingAsUtcMs = Date.UTC(
    Number(fields.year),
    Number(fields.month) - 1,
    Number(fields.day),
    Number(fields.hour),
    Number(fields.minute),
    Number(fields.second),
  );
  const offsetMs = zonedReadingAsUtcMs - utcGuessMs;
  return new Date(utcGuessMs - offsetMs);
}
