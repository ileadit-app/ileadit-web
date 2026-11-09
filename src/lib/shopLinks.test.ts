import { describe, expect, it } from "vitest";
import {
  SHOP_CODE_MAX_LENGTH,
  SHOP_CODE_MIN_LENGTH,
  SHOP_LINKS,
  resolveShopRound,
  type ShopLink,
} from "./shopLinks";

/** Fixture shop, because the real list is empty. Rounds mirror the January
 * 2027 plan: Mon-Sun weeks 4-10, 11-17, 18-24 Jan (London = UTC in January). */
const SHOP: ShopLink = {
  code: "BEAN26",
  shopName: "Bean There",
  timeZone: "Europe/London",
  rounds: [
    { startDate: "2027-01-04", endDate: "2027-01-10", inviteCode: "AAAA2222" },
    { startDate: "2027-01-11", endDate: "2027-01-17", inviteCode: "BBBB3333" },
    { startDate: "2027-01-18", endDate: "2027-01-24", inviteCode: "CCCC4444" },
  ],
};
const SHOPS = [SHOP];

function round(code: string, iso: string, shops: ShopLink[] = SHOPS) {
  return resolveShopRound(code, new Date(iso), shops);
}

describe("resolveShopRound", () => {
  it("before the first round -> the first round", () => {
    expect(round("BEAN26", "2026-12-20T12:00:00Z")).toEqual({
      kind: "round",
      shopName: "Bean There",
      inviteCode: "AAAA2222",
      roundNumber: 1,
      totalRounds: 3,
      startDate: "2027-01-04",
      endDate: "2027-01-10",
    });
  });

  it("round 1's Monday -> round 1", () => {
    expect(round("BEAN26", "2027-01-04T00:00:00Z")).toMatchObject({
      kind: "round",
      roundNumber: 1,
      inviteCode: "AAAA2222",
    });
  });

  it("mid-week -> that week's round", () => {
    expect(round("BEAN26", "2027-01-13T15:00:00Z")).toMatchObject({
      kind: "round",
      roundNumber: 2,
      inviteCode: "BBBB3333",
    });
  });

  it("Sunday 23:30 London -> still the ending round", () => {
    expect(round("BEAN26", "2027-01-10T23:30:00Z")).toMatchObject({
      roundNumber: 1,
      inviteCode: "AAAA2222",
    });
  });

  it("Monday 00:30 London -> the next round", () => {
    expect(round("BEAN26", "2027-01-11T00:30:00Z")).toMatchObject({
      roundNumber: 2,
      inviteCode: "BBBB3333",
    });
  });

  it("after the last round's end -> finished", () => {
    expect(round("BEAN26", "2027-01-25T00:30:00Z")).toEqual({
      kind: "finished",
      shopName: "Bean There",
    });
  });

  it("last round's final Sunday 23:30 -> still round 3", () => {
    expect(round("BEAN26", "2027-01-24T23:30:00Z")).toMatchObject({ roundNumber: 3 });
  });

  it("unknown code -> not-a-shop", () => {
    expect(round("ZZZZ99", "2027-01-13T12:00:00Z")).toEqual({ kind: "not-a-shop" });
  });

  it("8-character and 20-character codes are never shops", () => {
    const eight: ShopLink = { ...SHOP, code: "ABCDEFGH" };
    expect(round("ABCDEFGH", "2027-01-13T12:00:00Z", [eight])).toEqual({ kind: "not-a-shop" });
    expect(round("aBcDeFgHiJkLmNoPqRsT", "2027-01-13T12:00:00Z")).toEqual({ kind: "not-a-shop" });
  });

  it("is case-insensitive", () => {
    const upper = round("BEAN26", "2027-01-13T12:00:00Z");
    expect(upper.kind).toBe("round");
    expect(round("bean26", "2027-01-13T12:00:00Z")).toEqual(upper);
    expect(round("BeAn26", "2027-01-13T12:00:00Z")).toEqual(upper);
  });

  it("UTC date and London date differ (BST): 23:30 UTC Sunday is already Monday in London", () => {
    const summer: ShopLink = {
      ...SHOP,
      rounds: [
        { startDate: "2027-06-07", endDate: "2027-06-13", inviteCode: "AAAA2222" },
        { startDate: "2027-06-14", endDate: "2027-06-20", inviteCode: "BBBB3333" },
      ],
    };
    // 2027-06-13T23:30Z = 00:30 BST on Mon 14 June: UTC date is the 13th, London date the 14th.
    expect(round("BEAN26", "2027-06-13T23:30:00Z", [summer])).toMatchObject({
      roundNumber: 2,
      inviteCode: "BBBB3333",
    });
    // Reverse edge: 22:59 UTC Sunday is 23:59 BST, still round 1.
    expect(round("BEAN26", "2027-06-13T22:59:00Z", [summer])).toMatchObject({ roundNumber: 1 });
    // 2027-06-20T23:30Z is 00:30 BST on the 21st -> finished, though the UTC date (20th) is inside the round.
    expect(round("BEAN26", "2027-06-20T23:30:00Z", [summer])).toEqual({
      kind: "finished",
      shopName: "Bean There",
    });
  });

  it("between rounds (a gap) -> the next round", () => {
    const gap: ShopLink = {
      ...SHOP,
      rounds: [
        { startDate: "2027-01-04", endDate: "2027-01-10", inviteCode: "AAAA2222" },
        { startDate: "2027-01-18", endDate: "2027-01-24", inviteCode: "CCCC4444" },
      ],
    };
    expect(round("BEAN26", "2027-01-14T12:00:00Z", [gap])).toMatchObject({
      roundNumber: 2,
      inviteCode: "CCCC4444",
    });
  });

  it("a shop with no rounds is finished rather than throwing", () => {
    expect(round("BEAN26", "2027-01-13T12:00:00Z", [{ ...SHOP, rounds: [] }])).toEqual({
      kind: "finished",
      shopName: "Bean There",
    });
  });
});

describe("SHOP_LINKS config guard", () => {
  it("every shop code is 4-7 letters/digits and unique (case-insensitive)", () => {
    const seen = new Set<string>();
    for (const shop of SHOP_LINKS) {
      expect(shop.code, shop.code).toMatch(/^[A-Za-z0-9]+$/);
      expect(shop.code.length, shop.code).toBeGreaterThanOrEqual(SHOP_CODE_MIN_LENGTH);
      expect(shop.code.length, shop.code).toBeLessThanOrEqual(SHOP_CODE_MAX_LENGTH);
      const key = shop.code.toUpperCase();
      expect(seen.has(key), `duplicate ${shop.code}`).toBe(false);
      seen.add(key);
    }
  });

  it("every round has valid ordered, non-overlapping dates and an 8-character invite code", () => {
    for (const shop of SHOP_LINKS) {
      expect(shop.rounds.length, shop.code).toBeGreaterThan(0);
      const sorted = [...shop.rounds].sort((a, b) => a.startDate.localeCompare(b.startDate));
      sorted.forEach((r, i) => {
        expect(r.startDate, shop.code).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(r.endDate, shop.code).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(r.startDate <= r.endDate, `${shop.code} round ${i + 1} ends before it starts`).toBe(true);
        expect(r.inviteCode.replace(/[^A-Za-z0-9]/g, "").length, shop.code).toBe(8);
        if (i > 0) {
          expect(sorted[i - 1].endDate < r.startDate, `${shop.code} rounds overlap`).toBe(true);
        }
      });
    }
  });
});
