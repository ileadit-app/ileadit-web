import { zonedDateString } from "./competitionDates";
import { normalizeInviteCodeInput } from "./invites";

/**
 * Shop links (WEB-SHOP-LINK): one stable, printable link per sponsoring shop
 * (`/invite/BEAN26`) that always opens THAT SHOP'S CURRENT weekly round.
 *
 * Static config, no Firestore. Each round is an ordinary competition with
 * its own 8-character `invites/{CODE}` created in the portal as usual; this
 * file only maps a shop code -> which of those invite codes is "this week's".
 * Adding or changing a shop is a normal commit + deploy.
 *
 * Shop codes are 4 to 7 letters/digits, case-insensitive. That can never
 * collide with the two other code spaces served by `/invite/[code]`:
 * invite codes are exactly 8 characters and legacy competition IDs are 20.
 */

export interface ShopRound {
  /** `yyyy-MM-dd`, inclusive, a calendar date in the shop's time zone. */
  startDate: string;
  /** `yyyy-MM-dd`, inclusive. */
  endDate: string;
  /** The 8-character `invites/{CODE}` for this round's competition. */
  inviteCode: string;
}

export interface ShopLink {
  code: string;
  shopName: string;
  timeZone: "Europe/London";
  rounds: ShopRound[];
}

/** EMPTY until Paul fills in real shops (once rounds + invites exist). */
export const SHOP_LINKS: ShopLink[] = [];

export const SHOP_CODE_MIN_LENGTH = 4;
export const SHOP_CODE_MAX_LENGTH = 7;

export type ShopRoundResolution =
  | { kind: "not-a-shop" }
  | {
      kind: "round";
      shopName: string;
      inviteCode: string;
      /** 1-based position in the shop's rounds, ordered by start date. */
      roundNumber: number;
      /** Added beyond the ticket's listed shape: the page line reads
       * "Round {n} of {total}", and the total belongs to the same lookup. */
      totalRounds: number;
      startDate: string;
      endDate: string;
    }
  | { kind: "finished"; shopName: string };

/**
 * Which round does this shop link open right now?
 *
 * Uses the SHOP's local calendar date (its `timeZone`), never the visitor's
 * or UTC: a round ends on its Sunday in London even when UTC has already
 * rolled over (BST) or not yet (GMT midnight).
 *
 * - today inside a round            -> that round
 * - today before the first round    -> the first round (joining early is fine)
 * - today between two rounds        -> the next round (rule kept total even
 *                                      though back-to-back weeks never gap)
 * - today after the last round ends -> `finished`
 *
 * `shops` defaults to the real list; tests pass fixtures.
 */
export function resolveShopRound(
  code: string,
  now: Date,
  shops: readonly ShopLink[] = SHOP_LINKS,
): ShopRoundResolution {
  const normalized = normalizeInviteCodeInput(code);
  if (
    normalized.length < SHOP_CODE_MIN_LENGTH ||
    normalized.length > SHOP_CODE_MAX_LENGTH
  ) {
    return { kind: "not-a-shop" };
  }

  const shop = shops.find((s) => normalizeInviteCodeInput(s.code) === normalized);
  if (!shop) return { kind: "not-a-shop" };

  const rounds = [...shop.rounds].sort((a, b) =>
    a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0,
  );
  const today = zonedDateString(now, shop.timeZone);

  // `yyyy-MM-dd` strings compare correctly as plain strings.
  const index = rounds.findIndex((r) => today <= r.endDate);
  if (index === -1) return { kind: "finished", shopName: shop.shopName };

  // `today <= endDate` on the first such round: either today is inside it
  // (start <= today) or it hasn't started yet (before/between) -> the same
  // round is the answer in both cases.
  const round = rounds[index];
  return {
    kind: "round",
    shopName: shop.shopName,
    inviteCode: round.inviteCode,
    roundNumber: index + 1,
    totalRounds: rounds.length,
    startDate: round.startDate,
    endDate: round.endDate,
  };
}
