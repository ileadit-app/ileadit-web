import { describe, expect, it } from "vitest";
import { resolveWarmupStatus } from "./todayCard";

/**
 * Pins `resolveWarmupStatus` — the pure warm-up calculation behind the
 * Today Card (ticket W7-TODAY). Every test below has been mutation-proven:
 * the source was edited to break exactly the rule the test claims to pin,
 * the test was confirmed RED, the source was restored, and the test was
 * confirmed GREEN again — see the ticket's findings report for the specific
 * mutation used for each MUT-* id.
 *
 * See `todayCard.ts`'s file header for why this is the SUBSTITUTE for the
 * literal `steps: null` vs `steps: 0` warm-up display the design spec
 * describes — `warmup` genuinely lives on `users/{uid}/private/game`-derived
 * fields (`firstDay`, `warmupEndsOn`), not on the banned `days/{date}`
 * collection, so this state IS legitimately buildable and is pinned in full
 * here.
 */

describe("resolveWarmupStatus", () => {
  it("MUT-WARMUP-ACTIVE: within the warm-up window, returns the correct 1-based day number", () => {
    const result = resolveWarmupStatus(
      { timeZone: "Europe/London", firstDay: "2026-09-14", warmupEndsOn: "2026-09-20" },
      7,
      new Date("2026-09-16T10:00:00Z"),
    );

    expect(result).toEqual({ dayOfWarmup: 3, totalDays: 7 });
  });

  it("MUT-WARMUP-ENDED: once today (in the account's zone) is past warmupEndsOn, returns null", () => {
    const result = resolveWarmupStatus(
      { timeZone: "Europe/London", firstDay: "2026-09-14", warmupEndsOn: "2026-09-20" },
      7,
      new Date("2026-09-21T10:00:00Z"),
    );

    expect(result).toBeNull();
  });

  it("MUT-WARMUP-LAST-DAY-INCLUSIVE: the last warm-up day itself still counts as active (inclusive end)", () => {
    const result = resolveWarmupStatus(
      { timeZone: "Europe/London", firstDay: "2026-09-14", warmupEndsOn: "2026-09-20" },
      7,
      new Date("2026-09-20T10:00:00Z"),
    );

    expect(result).toEqual({ dayOfWarmup: 7, totalDays: 7 });
  });

  it("MUT-WARMUP-UNSEEDED: a brand new account with no firstDay/warmupEndsOn yet returns null, not day 1", () => {
    const result = resolveWarmupStatus(
      { timeZone: "Europe/London", firstDay: null, warmupEndsOn: null },
      7,
      new Date("2026-09-16T10:00:00Z"),
    );

    expect(result).toBeNull();
  });

  it("MUT-WARMUP-NO-TIMEZONE: a missing timeZone returns null rather than guessing the viewer's own zone", () => {
    const result = resolveWarmupStatus(
      { timeZone: null, firstDay: "2026-09-14", warmupEndsOn: "2026-09-20" },
      7,
      new Date("2026-09-16T10:00:00Z"),
    );

    expect(result).toBeNull();
  });

  it("MUT-WARMUP-CLAMP: the displayed day number never exceeds the live config's warmupDays label", () => {
    // A constructed mismatch: the account's own warmupEndsOn spans 10 days,
    // but the CURRENTLY live config says 7 — see the "known limitation"
    // note in todayCard.ts. The label must clamp rather than show "Day 10
    // of 7", which would read as a broken counter.
    const result = resolveWarmupStatus(
      { timeZone: "Europe/London", firstDay: "2026-09-01", warmupEndsOn: "2026-09-10" },
      7,
      new Date("2026-09-10T10:00:00Z"),
    );

    expect(result).toEqual({ dayOfWarmup: 7, totalDays: 7 });
  });

  it("MUT-WARMUP-TIMEZONE-AWARE: uses the ACCOUNT's own zone, not UTC/host zone, to decide today's date", () => {
    // At this instant it's already 2026-09-21 in UTC, but still 2026-09-20
    // (the last warm-up day) in Pacific/Honolulu (UTC-10). A UTC-only
    // implementation would wrongly call warm-up already over.
    const result = resolveWarmupStatus(
      { timeZone: "Pacific/Honolulu", firstDay: "2026-09-14", warmupEndsOn: "2026-09-20" },
      7,
      new Date("2026-09-21T05:00:00Z"),
    );

    expect(result).toEqual({ dayOfWarmup: 7, totalDays: 7 });
  });
});
