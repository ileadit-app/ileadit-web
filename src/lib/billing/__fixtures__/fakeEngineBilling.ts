import type Stripe from "stripe";
import { EngineBillingError, type BillingOrg, type EngineBillingClient, type PaidCompetitionRecord } from "../engineBilling";
import type { PriceBandId } from "../priceBands";

/**
 * Test doubles for the engine billing port. NOT imported by any application
 * code — Vitest's `include` (`src/**‍/*.{test,spec}.{ts,tsx}`) does not pick
 * this file up as a suite, and nothing outside `*.test.ts` imports it.
 *
 * `FakeEngineBilling` implements REAL idempotency rather than asserting on
 * a spy: it keys created competitions on `billingEventId` exactly as the
 * engine is contractually required to (`engineBilling.ts`, point B). That
 * matters — a mock that just counts calls proves the caller made one call,
 * not that a replay produces one competition. These tests need the latter.
 */
export class FakeEngineBilling implements EngineBillingClient {
  /** billingEventId → competitionId. The store the real engine must keep. */
  readonly created = new Map<string, string>();
  /** Every record it was ASKED to write, replays included. */
  readonly calls: PaidCompetitionRecord[] = [];
  readonly orgFetches: Array<{ orgId: string; callerIdToken: string }> = [];

  /** Set to make the next `recordPaidCompetition` throw. */
  failWith: EngineBillingError | null = null;

  private nextId = 1;

  constructor(private readonly orgs: Record<string, BillingOrg> = {}) {}

  async fetchBillingOrg(orgId: string, callerIdToken: string): Promise<BillingOrg> {
    this.orgFetches.push({ orgId, callerIdToken });
    if (this.failWith) throw this.failWith;
    const org = this.orgs[orgId];
    if (!org) throw new EngineBillingError("not-found", `no such org ${orgId}`);
    return org;
  }

  async recordPaidCompetition(record: PaidCompetitionRecord) {
    this.calls.push(record);
    if (this.failWith) throw this.failWith;

    const existing = this.created.get(record.billingEventId);
    if (existing) return { status: "duplicate" as const, competitionId: existing };

    const competitionId = `comp_${this.nextId++}`;
    this.created.set(record.billingEventId, competitionId);
    return { status: "recorded" as const, competitionId };
  }
}

export function fakeOrg(overrides: Partial<BillingOrg> = {}): BillingOrg {
  return {
    id: "org_acme",
    name: "Acme Ltd",
    priceBand: "team" as PriceBandId,
    stripeCustomerId: "cus_test_acme",
    ...overrides,
  };
}

/**
 * A minimal paid Checkout Session. Cast rather than fully constructed —
 * `Stripe.Checkout.Session` has ~40 fields, none of which this code reads,
 * and spelling them all out would obscure the handful that matter.
 */
export function paidSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: "cs_test_session_1",
    object: "checkout.session",
    payment_status: "paid",
    amount_total: 4900,
    currency: "gbp",
    payment_intent: "pi_test_1",
    customer: "cus_test_acme",
    metadata: {
      comp_draftId: "draft_abc",
      comp_orgId: "org_acme",
      comp_createdByUid: "uid_paul",
      comp_priceBand: "team",
      comp_name: "Marketing team step-off",
      comp_startTimeIso: "2026-10-01T08:00:00.000Z",
      comp_durationDays: "7",
      comp_timeZone: "Europe/London",
    },
    ...overrides,
  } as Stripe.Checkout.Session;
}
