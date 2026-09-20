// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  PRICE_BANDS,
  PRICE_BAND_IDS,
  bandForEmployeeCount,
  formatPence,
  isPriceBandId,
  resolvePrice,
  type PriceBandId,
} from "./priceBands";

/**
 * Price resolution from a band. The point of these tests is NOT that £49 is
 * £49 — a test that restates the table it is testing pins nothing. It is
 * that the THREE OUTCOMES stay distinct, that the table cannot silently
 * grow a band nothing prices, and that "free" never becomes reachable for a
 * band that should be quoted.
 */

describe("resolvePrice", () => {
  it("prices every band in the table — a new band cannot be added without a resolution", () => {
    // This is the guard that matters: add a band to PRICE_BANDS and forget
    // to think about its price, and this fails.
    for (const id of PRICE_BAND_IDS) {
      const resolution = resolvePrice(id);
      expect(["free", "chargeable", "quote-required"]).toContain(resolution.kind);
      expect(resolution.band.id).toBe(id);
    }
    expect(PRICE_BAND_IDS.length).toBeGreaterThan(0);
  });

  it("resolves a zero-price band to `free`, not to a £0 charge", () => {
    const resolution = resolvePrice("free");
    expect(resolution.kind).toBe("free");
    // The distinction that matters: `free` carries no amount to charge, so
    // no caller can accidentally build a £0 Checkout Session from it.
    expect("amountPence" in resolution).toBe(false);
  });

  it("resolves a priced self-serve band to `chargeable` with the table's amount", () => {
    const resolution = resolvePrice("team");
    expect(resolution.kind).toBe("chargeable");
    if (resolution.kind !== "chargeable") throw new Error("unreachable");
    expect(resolution.amountPence).toBe(PRICE_BANDS.team.amountPence);
    expect(resolution.amountPence).toBeGreaterThan(0);
    expect(resolution.currency).toBe("gbp");
  });

  it("resolves a non-self-serve band to `quote-required`, NEVER to free", () => {
    const resolution = resolvePrice("enterprise");
    expect(resolution.kind).toBe("quote-required");
    // The specific bug this pins: collapsing "no published price" into
    // "free" would let the largest customers run competitions for nothing.
    expect(resolution.kind).not.toBe("free");
  });

  it("gives company a strictly higher price than team — the bands are ordered", () => {
    const team = resolvePrice("team");
    const company = resolvePrice("company");
    if (team.kind !== "chargeable" || company.kind !== "chargeable") throw new Error("unreachable");
    expect(company.amountPence).toBeGreaterThan(team.amountPence);
  });

  it("charges the same for a band regardless of how many times it is asked", () => {
    const first = resolvePrice("company");
    const second = resolvePrice("company");
    expect(second).toEqual(first);
  });
});

describe("bandForEmployeeCount", () => {
  it.each<[number, PriceBandId]>([
    [0, "free"],
    [1, "free"],
    [10, "free"],
    [11, "team"],
    [50, "team"],
    [51, "company"],
    [250, "company"],
    [251, "enterprise"],
    [100_000, "enterprise"],
  ])("maps %i employees to the %s band", (employees, expected) => {
    expect(bandForEmployeeCount(employees)).toBe(expected);
  });

  it("puts every boundary in the LOWER band — maxEmployees is inclusive", () => {
    for (const id of PRICE_BAND_IDS) {
      const band = PRICE_BANDS[id];
      if (band.maxEmployees === null) continue;
      expect(bandForEmployeeCount(band.maxEmployees)).toBe(id);
      // …and one more employee must move them off it.
      expect(bandForEmployeeCount(band.maxEmployees + 1)).not.toBe(id);
    }
  });

  it("refuses a negative or non-finite headcount rather than guessing a band", () => {
    expect(() => bandForEmployeeCount(-1)).toThrow(/non-negative/);
    expect(() => bandForEmployeeCount(Number.NaN)).toThrow(/non-negative/);
    expect(() => bandForEmployeeCount(Number.POSITIVE_INFINITY)).toThrow(/non-negative/);
  });
});

describe("isPriceBandId", () => {
  it("accepts exactly the ids in the table and nothing else", () => {
    for (const id of PRICE_BAND_IDS) expect(isPriceBandId(id)).toBe(true);
    for (const notABand of ["", "FREE", "pro", "basic", null, undefined, 4900, {}]) {
      expect(isPriceBandId(notABand)).toBe(false);
    }
  });

  it("is not fooled by inherited Object properties", () => {
    // `"constructor" in PRICE_BANDS` is true; hasOwnProperty is why this
    // check is written the way it is.
    expect(isPriceBandId("constructor")).toBe(false);
    expect(isPriceBandId("toString")).toBe(false);
  });
});

describe("formatPence", () => {
  it("renders pence as pounds with two decimals", () => {
    expect(formatPence(0)).toBe("£0.00");
    expect(formatPence(4900)).toBe("£49.00");
    expect(formatPence(14900)).toBe("£149.00");
    expect(formatPence(1)).toBe("£0.01");
  });
});
