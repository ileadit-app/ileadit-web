// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FakeEngineBilling, paidSession } from "./__fixtures__/fakeEngineBilling";
import { EngineBillingError } from "./engineBilling";
import { fulfilCheckoutSession } from "./fulfilCheckout";

/**
 * The pay-first order and its idempotency. These tests are about the
 * PROPERTY — "one paid session becomes exactly one competition, however
 * many times fulfilment runs" — not about which functions got called.
 * `FakeEngineBilling` keeps a real store keyed on `billingEventId`, so
 * "one competition" is counted, not asserted on a spy.
 */

describe("fulfilCheckoutSession — idempotency", () => {
  it("creates exactly one competition when the same session is fulfilled ten times", async () => {
    const engine = new FakeEngineBilling();
    const session = paidSession();

    const outcomes = [];
    for (let i = 0; i < 10; i++) {
      outcomes.push(await fulfilCheckoutSession(session, { engine }));
    }

    expect(engine.created.size).toBe(1);
    expect(engine.calls).toHaveLength(10); // it really did retry
    expect(outcomes[0].status).toBe("fulfilled");
    expect(outcomes.slice(1).map((o) => o.status)).toEqual(Array(9).fill("already-fulfilled"));
  });

  it("returns the SAME competitionId on a replay, not a second one", async () => {
    const engine = new FakeEngineBilling();
    const session = paidSession();

    const first = await fulfilCheckoutSession(session, { engine });
    const second = await fulfilCheckoutSession(session, { engine });

    if (first.status !== "fulfilled" || second.status !== "already-fulfilled") {
      throw new Error(`unexpected statuses: ${first.status}, ${second.status}`);
    }
    expect(second.competitionId).toBe(first.competitionId);
  });

  it("keys on the SESSION, so two different events for one payment still create one competition", async () => {
    // This is the case `event.id`-based dedupe gets wrong: a delayed
    // payment method produces `checkout.session.completed` AND
    // `checkout.session.async_payment_succeeded` — two events, two event
    // ids, ONE session, ONE payment. Keyed on the event id these would be
    // two competitions and two charges recorded.
    const engine = new FakeEngineBilling();
    const session = paidSession({ id: "cs_test_async" });

    await fulfilCheckoutSession(session, { engine }); // from completed
    await fulfilCheckoutSession({ ...session }, { engine }); // from async_payment_succeeded

    expect(engine.created.size).toBe(1);
  });

  it("treats two genuinely different sessions as two competitions", async () => {
    // The counterpart of the above: the dedupe must not be so broad that a
    // customer who legitimately buys two competitions only gets one.
    const engine = new FakeEngineBilling();

    await fulfilCheckoutSession(paidSession({ id: "cs_test_a" }), { engine });
    await fulfilCheckoutSession(paidSession({ id: "cs_test_b" }), { engine });

    expect(engine.created.size).toBe(2);
  });

  it("passes the session id through as the billingEventId the engine must dedupe on", async () => {
    const engine = new FakeEngineBilling();
    await fulfilCheckoutSession(paidSession({ id: "cs_test_xyz" }), { engine });
    expect(engine.calls[0].billingEventId).toBe("cs_test_xyz");
    expect(engine.calls[0].stripeCheckoutSessionId).toBe("cs_test_xyz");
  });
});

describe("fulfilCheckoutSession — what it refuses to do", () => {
  it("records NOTHING for an unpaid session", async () => {
    const engine = new FakeEngineBilling();
    const outcome = await fulfilCheckoutSession(paidSession({ payment_status: "unpaid" }), { engine });

    expect(outcome.status).toBe("not-paid");
    expect(engine.calls).toHaveLength(0);
    expect(engine.created.size).toBe(0);
  });

  it("records NOTHING for a session still awaiting a delayed payment", async () => {
    const engine = new FakeEngineBilling();
    const outcome = await fulfilCheckoutSession(paidSession({ payment_status: "no_payment_required" }), { engine });
    // `no_payment_required` is a £0 Stripe session. This codebase never
    // creates one — the free band skips Stripe entirely — so treating it
    // as unpaid is correct and deliberately conservative.
    expect(outcome.status).toBe("not-paid");
    expect(engine.calls).toHaveLength(0);
  });

  it("refuses a paid session whose metadata does not describe a competition", async () => {
    const engine = new FakeEngineBilling();
    const outcome = await fulfilCheckoutSession(paidSession({ metadata: {} }), { engine });

    expect(outcome.status).toBe("unfulfillable");
    if (outcome.status !== "unfulfillable") throw new Error("unreachable");
    expect(outcome.reason).toMatch(/missing/);
    // Nothing half-written: money moved, but no partial record was made.
    expect(engine.calls).toHaveLength(0);
  });

  it("refuses a paid session with no amount_total rather than recording zero", async () => {
    const engine = new FakeEngineBilling();
    const outcome = await fulfilCheckoutSession(paidSession({ amount_total: null }), { engine });

    expect(outcome.status).toBe("unfulfillable");
    expect(engine.calls).toHaveLength(0);
  });
});

describe("fulfilCheckoutSession — the accepted failure: paid, creation failed", () => {
  it("propagates a retryable engine failure so the caller can ask Stripe to retry", async () => {
    const engine = new FakeEngineBilling();
    engine.failWith = new EngineBillingError("transient", "engine is down");

    await expect(fulfilCheckoutSession(paidSession(), { engine })).rejects.toBeInstanceOf(EngineBillingError);
    expect(engine.created.size).toBe(0);
  });

  it("marks a 'not configured' failure retryable — the payment is recoverable once the env is set", async () => {
    const engine = new FakeEngineBilling();
    engine.failWith = new EngineBillingError("not-configured", "no engine url");

    const error = await fulfilCheckoutSession(paidSession(), { engine }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EngineBillingError);
    expect((error as EngineBillingError).retryable).toBe(true);
  });

  it("does not mark an authorisation failure retryable — retrying cannot fix it", async () => {
    const error = new EngineBillingError("unauthorised", "nope");
    expect(error.retryable).toBe(false);
  });

  it("SUCCEEDS on a later retry after a transient failure, creating exactly one competition", async () => {
    // The whole point of the accepted failure mode: it is recoverable, and
    // recovery cannot double-charge or double-create.
    const engine = new FakeEngineBilling();
    const session = paidSession();

    engine.failWith = new EngineBillingError("transient", "engine is down");
    await expect(fulfilCheckoutSession(session, { engine })).rejects.toBeInstanceOf(EngineBillingError);

    engine.failWith = null;
    const recovered = await fulfilCheckoutSession(session, { engine });
    const thirdTime = await fulfilCheckoutSession(session, { engine });

    expect(recovered.status).toBe("fulfilled");
    expect(thirdTime.status).toBe("already-fulfilled");
    expect(engine.created.size).toBe(1);
  });
});

describe("fulfilCheckoutSession — what it records", () => {
  it("records the amount ACTUALLY PAID, not a recomputed price", async () => {
    const engine = new FakeEngineBilling();
    // A session paid at the old price while the price table has moved on.
    await fulfilCheckoutSession(paidSession({ amount_total: 3900 }), { engine });
    expect(engine.calls[0].amountPaidPence).toBe(3900);
  });

  it("carries the org, creator and the whole draft through to the engine", async () => {
    const engine = new FakeEngineBilling();
    await fulfilCheckoutSession(paidSession(), { engine });

    const record = engine.calls[0];
    expect(record.orgId).toBe("org_acme");
    expect(record.priceBand).toBe("team");
    expect(record.stripePaymentIntentId).toBe("pi_test_1");
    expect(record.draft).toMatchObject({
      name: "Marketing team step-off",
      createdByUid: "uid_paul",
      durationDays: 7,
      timeZone: "Europe/London",
    });
  });

  it("copes with expanded Stripe objects as well as bare ids", async () => {
    const engine = new FakeEngineBilling();
    await fulfilCheckoutSession(
      paidSession({
        payment_intent: { id: "pi_expanded" } as never,
        customer: { id: "cus_expanded" } as never,
      }),
      { engine },
    );
    expect(engine.calls[0].stripePaymentIntentId).toBe("pi_expanded");
    expect(engine.calls[0].stripeCustomerId).toBe("cus_expanded");
  });
});
