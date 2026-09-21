import { describe, expect, it } from "vitest";
import { isCompetitionStartingToday, isDayOneOfActiveCompetition } from "./competitionDates";

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
