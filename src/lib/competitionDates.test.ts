import { afterEach, describe, expect, it } from "vitest";
import {
  competitionActiveTimeLabel,
  competitionScheduledTimeLabel,
  isCompetitionStartingToday,
  isDayOneOfActiveCompetition,
} from "./competitionDates";

/**
 * WEB-3 item 3. Pins the two zone-aware predicates added for the "Starting
 * today" chip-copy override and the JOIN-1 day-one-of-active join gate.
 * Every test here is mutation-proven the same way as the rest of this
 * codebase's `.test.ts` files: the source was edited to break exactly the
 * rule under test, confirmed RED, reverted, confirmed GREEN.
 */

describe("isCompetitionStartingToday", () => {
  it("MUT-STARTING-TODAY-EXACT: true when startDate is today in the competition's own zone", () => {
    const result = isCompetitionStartingToday(
      "2026-09-21",
      "Europe/London",
      new Date("2026-09-21T10:00:00Z"),
    );
    expect(result).toBe(true);
  });

  it("MUT-STARTING-TODAY-PAST: true when startDate is in the past (today OR EARLIER, not an exact match)", () => {
    const result = isCompetitionStartingToday(
      "2026-09-14",
      "Europe/London",
      new Date("2026-09-21T10:00:00Z"),
    );
    expect(result).toBe(true);
  });

  it("MUT-STARTING-TODAY-FUTURE: false when startDate is still in the future", () => {
    const result = isCompetitionStartingToday(
      "2026-09-22",
      "Europe/London",
      new Date("2026-09-21T10:00:00Z"),
    );
    expect(result).toBe(false);
  });

  it("MUT-STARTING-TODAY-NO-STARTDATE: a null startDate is never 'starting today'", () => {
    const result = isCompetitionStartingToday(null, "Europe/London", new Date("2026-09-21T10:00:00Z"));
    expect(result).toBe(false);
  });

  it("MUT-STARTING-TODAY-DEFAULT-ZONE: a missing timeZone falls back to Europe/London (the engine's own default), not UTC or the host zone", () => {
    // At this instant it's still 2026-09-20 in UTC, but already 2026-09-21
    // in Europe/London (BST, UTC+1). A UTC-fallback implementation would
    // wrongly say "not yet".
    const result = isCompetitionStartingToday(
      "2026-09-21",
      null,
      new Date("2026-09-20T23:30:00Z"),
    );
    expect(result).toBe(true);
  });

  it("MUT-STARTING-TODAY-TIMEZONE-AWARE: uses the COMPETITION's own zone, not UTC, to decide today's date", () => {
    // At this instant it's already 2026-09-21 in UTC, but still 2026-09-20
    // in Pacific/Honolulu (UTC-10). The competition's own zone must win.
    const result = isCompetitionStartingToday(
      "2026-09-21",
      "Pacific/Honolulu",
      new Date("2026-09-21T05:00:00Z"),
    );
    expect(result).toBe(false);
  });
});

describe("isDayOneOfActiveCompetition", () => {
  it("MUT-DAYONE-EXACT: true when today (in the competition's zone) equals startDate exactly", () => {
    const result = isDayOneOfActiveCompetition(
      "2026-09-21",
      "Europe/London",
      new Date("2026-09-21T10:00:00Z"),
    );
    expect(result).toBe(true);
  });

  it("MUT-DAYONE-LATER: false once a later active day has passed — unlike isCompetitionStartingToday, this is an EXACT match, not 'today or earlier'", () => {
    const result = isDayOneOfActiveCompetition(
      "2026-09-14",
      "Europe/London",
      new Date("2026-09-21T10:00:00Z"),
    );
    expect(result).toBe(false);
  });

  it("MUT-DAYONE-FUTURE: false when startDate is still in the future", () => {
    const result = isDayOneOfActiveCompetition(
      "2026-09-22",
      "Europe/London",
      new Date("2026-09-21T10:00:00Z"),
    );
    expect(result).toBe(false);
  });

  it("MUT-DAYONE-NO-STARTDATE: a null startDate is never day one", () => {
    const result = isDayOneOfActiveCompetition(null, "Europe/London", new Date("2026-09-21T10:00:00Z"));
    expect(result).toBe(false);
  });

  it("MUT-DAYONE-TIMEZONE-AWARE: uses the COMPETITION's own zone, not UTC/host zone, to decide today's date", () => {
    // At this instant it's already 2026-09-22 in UTC, but still 2026-09-21
    // in Pacific/Honolulu (UTC-10) — still day one there.
    const result = isDayOneOfActiveCompetition(
      "2026-09-21",
      "Pacific/Honolulu",
      new Date("2026-09-22T05:00:00Z"),
    );
    expect(result).toBe(true);
  });
});

/**
 * WEB-4 item 2. Pins Paul's "hybrid" time-remaining decision for
 * `CompetitionHero`'s date line: "Day N of X" on every active day except
 * the last, a countdown to the end of the VIEWER's own local day on the
 * last day, and "Starts tomorrow"/"Starts Mon 22 Sep" before the start.
 *
 * Unlike `isCompetitionStartingToday`/`isDayOneOfActiveCompetition` above,
 * these two functions take NO `timeZone` parameter — they are deliberately
 * anchored to the runtime's own local date (the viewer's browser zone in
 * production), which the TIMEZONE-AWARE tests below prove by toggling
 * `process.env.TZ` (confirmed to take effect immediately for `Date`'s
 * local-time methods in this Node version) while holding the same instant
 * fixed. Every test here has been mutation-proven the same way as the rest
 * of this file: the source was edited to break exactly the rule under
 * test, confirmed RED, reverted, confirmed GREEN.
 */
describe("competitionActiveTimeLabel", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("MUT-ACTIVE-DAY-ONE: 'Day 1 of 7' on the competition's first day", () => {
    process.env.TZ = "Europe/London";
    const result = competitionActiveTimeLabel(
      "2026-09-21",
      "2026-09-27",
      7,
      new Date("2026-09-21T10:00:00Z"),
    );
    expect(result).toBe("Day 1 of 7");
  });

  it("MUT-ACTIVE-DAY-MIDDLE: 'Day 4 of 7' on a middle day", () => {
    process.env.TZ = "Europe/London";
    const result = competitionActiveTimeLabel(
      "2026-09-21",
      "2026-09-27",
      7,
      new Date("2026-09-24T10:00:00Z"),
    );
    expect(result).toBe("Day 4 of 7");
  });

  it("MUT-ACTIVE-LAST-DAY-COUNTDOWN: on the last day (endDate === viewer's local date), shows a countdown to the end of the viewer's day instead of 'Day N of X'", () => {
    process.env.TZ = "Europe/London";
    // 2026-09-27T18:48 in Europe/London (BST, UTC+1) — 5h 12m until the
    // next local midnight.
    const result = competitionActiveTimeLabel(
      "2026-09-21",
      "2026-09-27",
      7,
      new Date("2026-09-27T17:48:00Z"),
    );
    expect(result).toBe("Last day — ends in 5h 12m");
  });

  it("MUT-ACTIVE-LAST-DAY-NO-ENDDATE-FALLBACK: falls back to day === durationDays when endDate is null", () => {
    process.env.TZ = "Europe/London";
    const result = competitionActiveTimeLabel(
      "2026-09-21",
      null,
      7,
      new Date("2026-09-27T17:48:00Z"),
    );
    expect(result).toBe("Last day — ends in 5h 12m");
  });

  it("MUT-ACTIVE-TIMEZONE-VIEWER-LOCAL: day number is computed against the VIEWER's local date (via the host/browser zone), not UTC or the competition's own zone", () => {
    // Fixed instant: 2026-09-21T09:00:00Z.
    // In Pacific/Honolulu (UTC-10) it's still 2026-09-20 there — day 1.
    // In Pacific/Kiritimati (UTC+14) it's already 2026-09-21 — day 2.
    // The competition's own zone is irrelevant to this function by design
    // (it has no timeZone parameter at all) — only the viewer's own local
    // date, standing in here for "the browser's zone", decides the count.
    const instant = new Date("2026-09-21T09:00:00Z");

    process.env.TZ = "Pacific/Honolulu";
    const behind = competitionActiveTimeLabel("2026-09-20", "2026-09-26", 7, instant);
    expect(behind).toBe("Day 1 of 7");

    process.env.TZ = "Pacific/Kiritimati";
    const ahead = competitionActiveTimeLabel("2026-09-20", "2026-09-26", 7, instant);
    expect(ahead).toBe("Day 2 of 7");
  });
});

describe("competitionScheduledTimeLabel", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("MUT-SCHEDULED-TOMORROW: 'Starts tomorrow' when startDate is the viewer's local tomorrow", () => {
    process.env.TZ = "Europe/London";
    const result = competitionScheduledTimeLabel("2026-09-22", new Date("2026-09-21T10:00:00Z"));
    expect(result).toBe("Starts tomorrow");
  });

  it("MUT-SCHEDULED-DATED: 'Starts <weekday> <day> <month>' (en-GB) when startDate is further out than tomorrow", () => {
    process.env.TZ = "Europe/London";
    // At least two days out so the "tomorrow" branch can't also match.
    // Expected string built via the same Intl options `competitionDates.ts`
    // itself uses, rather than a hardcoded "Sep"/"Sept" literal — the exact
    // month abbreviation is an ICU data detail this test shouldn't pin.
    const expectedDatePart = new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(2026, 8, 28));
    const result = competitionScheduledTimeLabel("2026-09-28", new Date("2026-09-21T10:00:00Z"));
    expect(result).toBe(`Starts ${expectedDatePart}`);
  });

  it("MUT-SCHEDULED-NO-STARTDATE: falls back to 'Dates being finalised' when startDate is null", () => {
    const result = competitionScheduledTimeLabel(null, new Date("2026-09-21T10:00:00Z"));
    expect(result).toBe("Dates being finalised");
  });

  it("MUT-SCHEDULED-TIMEZONE-VIEWER-LOCAL: 'tomorrow' is decided against the VIEWER's local date, not UTC", () => {
    // Fixed instant: 2026-09-21T23:30:00Z.
    // In Pacific/Honolulu (UTC-10) it's still 2026-09-21 there, so
    // startDate "2026-09-22" is tomorrow.
    // In Pacific/Kiritimati (UTC+14) it's already 2026-09-22 there, so the
    // same startDate is TODAY, not tomorrow — proving the branch depends on
    // the viewer's own zone, not a fixed UTC/competition zone.
    const instant = new Date("2026-09-21T23:30:00Z");

    process.env.TZ = "Pacific/Honolulu";
    expect(competitionScheduledTimeLabel("2026-09-22", instant)).toBe("Starts tomorrow");

    process.env.TZ = "Pacific/Kiritimati";
    expect(competitionScheduledTimeLabel("2026-09-22", instant)).toBe("Starts today");
  });
});
