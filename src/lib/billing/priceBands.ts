/**
 * Price bands — the DATA behind per-competition pricing.
 *
 * Paul's 2026-09-20 billing decision (automation-hub
 * `docs/ileadit-org-model-design-20260920.md`, DECISIONS block, Q5):
 *
 *   "Pay per competition, with the org's tier setting the price.
 *    Transactional, not subscription... The org carries a price band
 *    (derived from employee count), not a subscription. It is an input to
 *    the price of a billable event, not a recurring entitlement."
 *
 * So: an org that runs nothing pays nothing, and the band is a PROPERTY OF
 * THE ORG that this module turns into a price for ONE competition.
 *
 * WHY THIS IS A TABLE AND NOT A FUNCTION FULL OF `if`s: changing a price,
 * renaming a band, or adding one must be an edit to `PRICE_BANDS` below and
 * nothing else. There is deliberately no `if (band === "team") return 4900`
 * anywhere in this repo — `resolvePrice()` reads the table. A future admin
 * UI or a remote config fetch can replace the literal below without any
 * caller changing, because every consumer goes through `resolvePrice()`.
 *
 * NO STRIPE IMPORT, DELIBERATELY. This module is pure data + pure functions
 * so it can be imported from a React component (to show a price before
 * checkout), from the server route (to set the real charge), and from a
 * test, without dragging the Stripe SDK or a secret key into a client
 * bundle. The server is still the only place the charged amount is decided
 * — see `src/lib/billing/checkoutHandler.ts`, which reads the band off the
 * ORG (fetched server-side), never off the request body.
 *
 * Amounts are SOURCED from `ileadit/RULES.md` §8.2 "Corporate Wellness
 * Pricing (MVP)" — the £49/£149 per-competition figures are that table's,
 * not this agent's invention. Note `CLAUDE.md`'s own "Pricing Tiers"
 * section in this repo still describes the OLD subscription model
 * (Free/Pro £9.99-a-month/Enterprise); it predates Paul's Q5 decision and
 * is stale. It has deliberately not been rewritten here — that is a
 * docs change for whoever lands the org model, not a side effect of a
 * payments ticket.
 */

export type PriceBandId = "free" | "team" | "company" | "enterprise";

export interface PriceBand {
  id: PriceBandId;
  /** Customer-facing name, e.g. shown on the checkout line item. */
  label: string;
  /**
   * Upper bound of the employee count this band covers, inclusive. `null`
   * means "no upper bound" (the top band). Used only by
   * `bandForEmployeeCount()` — the org's stored band is authoritative at
   * charge time, not a recomputation from a headcount that may have moved.
   */
  maxEmployees: number | null;
  /**
   * Price of ONE competition, in pence. `0` is a real, free price.
   * `null` means "not self-serve" — there is no published number, so no
   * Checkout Session can be built. Do not read this directly; call
   * `resolvePrice()`, which turns the two different meanings of
   * "no amount to charge" into two different outcomes.
   */
  amountPence: number | null;
  /** ISO 4217, lowercase, as Stripe expects it. */
  currency: "gbp";
  /**
   * False when a human has to quote the price (Enterprise). A false here
   * must produce a "talk to us" refusal, never a £0 charge — see
   * `resolvePrice()`.
   */
  selfServe: boolean;
  /** One line for the UI, so copy lives with the price it describes. */
  summary: string;
}

/**
 * THE price table. Editing a number here changes what customers are
 * charged; there is no second copy of these figures anywhere in this repo.
 */
export const PRICE_BANDS: Record<PriceBandId, PriceBand> = {
  free: {
    id: "free",
    label: "Free",
    maxEmployees: 10,
    amountPence: 0,
    currency: "gbp",
    selfServe: true,
    summary: "Up to 10 employees — no charge per competition.",
  },
  team: {
    id: "team",
    label: "Team",
    maxEmployees: 50,
    amountPence: 4900,
    currency: "gbp",
    selfServe: true,
    summary: "Up to 50 employees — £49 per competition.",
  },
  company: {
    id: "company",
    label: "Company",
    maxEmployees: 250,
    amountPence: 14900,
    currency: "gbp",
    selfServe: true,
    summary: "Up to 250 employees — £149 per competition.",
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise",
    maxEmployees: null,
    amountPence: null,
    currency: "gbp",
    selfServe: false,
    summary: "Over 250 employees — custom pricing, agreed with us directly.",
  },
};

/**
 * Bands cheapest-first. Derived from the table rather than written out
 * again, so adding a band to `PRICE_BANDS` cannot leave this list stale.
 */
export const PRICE_BAND_IDS = Object.keys(PRICE_BANDS) as PriceBandId[];

export function isPriceBandId(value: unknown): value is PriceBandId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(PRICE_BANDS, value);
}

/**
 * The three genuinely different answers to "what do we charge this org for
 * one competition". A discriminated union, not a nullable number, because
 * "free" and "we can't price this without talking to you" are NOT the same
 * outcome and must never collapse into one — collapsing them is exactly how
 * an Enterprise customer ends up running competitions for nothing.
 */
export type PriceResolution =
  | { kind: "free"; band: PriceBand }
  | { kind: "chargeable"; band: PriceBand; amountPence: number; currency: "gbp" }
  | { kind: "quote-required"; band: PriceBand };

export function resolvePrice(bandId: PriceBandId): PriceResolution {
  const band = PRICE_BANDS[bandId];

  if (!band.selfServe || band.amountPence === null) {
    return { kind: "quote-required", band };
  }
  if (band.amountPence === 0) {
    return { kind: "free", band };
  }
  return { kind: "chargeable", band, amountPence: band.amountPence, currency: band.currency };
}

/**
 * Employee count → band. Provided because the org model's own rule is
 * "price band DERIVED from employee count", and this is that derivation in
 * one testable place.
 *
 * DEPENDENCY NOTE: if the `feat/org-model` branch computes and stores the
 * band itself (likely — the org document carries it), this function is a
 * convenience for UI ("you'd be on the Team band") and MUST NOT be used at
 * charge time. Charge time reads `BillingOrg.priceBand`, the stored value,
 * because a headcount that has drifted since the org was set up must not
 * silently re-price a competition mid-flow.
 */
export function bandForEmployeeCount(employees: number): PriceBandId {
  if (!Number.isFinite(employees) || employees < 0) {
    throw new Error(`bandForEmployeeCount: expected a non-negative number, got ${employees}`);
  }

  // Ordered ascending by bound; the single unbounded band is the fallback.
  const bounded = PRICE_BAND_IDS.map((id) => PRICE_BANDS[id])
    .filter((band): band is PriceBand & { maxEmployees: number } => band.maxEmployees !== null)
    .sort((a, b) => a.maxEmployees - b.maxEmployees);

  for (const band of bounded) {
    if (employees <= band.maxEmployees) return band.id;
  }

  const unbounded = PRICE_BAND_IDS.map((id) => PRICE_BANDS[id]).find((band) => band.maxEmployees === null);
  if (!unbounded) {
    throw new Error("PRICE_BANDS has no unbounded top band — every employee count must resolve to a band.");
  }
  return unbounded.id;
}

/** £49.00 from 4900. Presentation only; never parse this back into a price. */
export function formatPence(amountPence: number): string {
  return `£${(amountPence / 100).toFixed(2)}`;
}
