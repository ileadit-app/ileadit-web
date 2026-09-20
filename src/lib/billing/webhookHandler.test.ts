// @vitest-environment node
import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import { FakeEngineBilling, paidSession } from "./__fixtures__/fakeEngineBilling";
import { EngineBillingError } from "./engineBilling";
import { handleStripeWebhook, type WebhookHandlerDeps } from "./webhookHandler";

/**
 * Webhook signature verification and idempotency, exercised with REAL
 * Stripe signatures.
 *
 * `stripe.webhooks.generateTestHeaderString` computes the same HMAC the
 * real Stripe servers do, and `constructEvent` verifies it — both are pure
 * local crypto, no network, no API key that needs to be valid. So these
 * tests check the actual verification path rather than a stub of it, which
 * is the only way a "signature rejection" test is worth anything.
 *
 * The secret below is a made-up string used purely to sign and verify these
 * fixtures. It is NOT a credential and grants nothing.
 */
const TEST_WEBHOOK_SECRET = "whsec_fixture_not_a_real_secret";
const stripe = new Stripe("sk_test_fixture_not_a_real_key");

/**
 * Stripe's `.d.ts` types every option as required, but the implementation
 * fills `timestamp`, `scheme`, `signature` and `cryptoProvider` in itself
 * when they are omitted — which is the documented way to use this helper.
 * The cast is that gap, and nothing more; the signature produced is a real
 * one, verified by the real `constructEvent` below.
 */
type TestHeaderOptions = Parameters<typeof stripe.webhooks.generateTestHeaderString>[0];

function signedRequest(body: unknown, secret = TEST_WEBHOOK_SECRET): Request {
  const payload = JSON.stringify(body);
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret } as TestHeaderOptions);
  return new Request("https://ileadit.app/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": signature, "content-type": "application/json" },
    body: payload,
  });
}

function event(type: string, session = paidSession(), id = "evt_test_1") {
  return { id, object: "event", type, data: { object: session } };
}

function deps(engine: FakeEngineBilling, overrides: Partial<WebhookHandlerDeps> = {}): WebhookHandlerDeps {
  return {
    stripe,
    webhookSecret: () => TEST_WEBHOOK_SECRET,
    engine,
    ...overrides,
  };
}

describe("webhook — signature verification", () => {
  it("accepts a correctly signed event", async () => {
    const engine = new FakeEngineBilling();
    const response = await handleStripeWebhook(signedRequest(event("checkout.session.completed")), deps(engine));

    expect(response.status).toBe(200);
    expect(engine.created.size).toBe(1);
  });

  it("rejects a forged event signed with the WRONG secret, and records nothing", async () => {
    const engine = new FakeEngineBilling();
    const forged = signedRequest(event("checkout.session.completed"), "whsec_attacker_guess");

    const response = await handleStripeWebhook(forged, deps(engine));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid signature" });
    // The thing that actually matters: no free competition was created.
    expect(engine.calls).toHaveLength(0);
    expect(engine.created.size).toBe(0);
  });

  it("rejects an event with NO signature header at all", async () => {
    const engine = new FakeEngineBilling();
    const unsigned = new Request("https://ileadit.app/api/stripe/webhook", {
      method: "POST",
      body: JSON.stringify(event("checkout.session.completed")),
    });

    const response = await handleStripeWebhook(unsigned, deps(engine));

    expect(response.status).toBe(400);
    expect(engine.calls).toHaveLength(0);
  });

  it("rejects a body that was tampered with after signing", async () => {
    const engine = new FakeEngineBilling();
    const original = event("checkout.session.completed");
    const payload = JSON.stringify(original);
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: TEST_WEBHOOK_SECRET,
    } as TestHeaderOptions);

    // Same signature, different body — an attacker replaying a captured
    // header over their own payload.
    const tampered = JSON.stringify(event("checkout.session.completed", paidSession({ id: "cs_attacker" })));
    const request = new Request("https://ileadit.app/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: tampered,
    });

    const response = await handleStripeWebhook(request, deps(engine));

    expect(response.status).toBe(400);
    expect(engine.calls).toHaveLength(0);
  });

  it("returns 503 and records nothing when no webhook secret is configured", async () => {
    const engine = new FakeEngineBilling();
    const response = await handleStripeWebhook(
      signedRequest(event("checkout.session.completed")),
      deps(engine, {
        webhookSecret: () => {
          throw new Error("STRIPE_WEBHOOK_SECRET is not set");
        },
      }),
    );

    expect(response.status).toBe(503);
    // The failure this pins: falling through to "assume it's Stripe" when
    // the secret is missing would make the endpoint forgeable.
    expect(engine.calls).toHaveLength(0);
  });
});

describe("webhook — idempotency", () => {
  it("creates one competition when Stripe retries the SAME event five times", async () => {
    const engine = new FakeEngineBilling();
    const payload = event("checkout.session.completed");

    for (let i = 0; i < 5; i++) {
      const response = await handleStripeWebhook(signedRequest(payload), deps(engine));
      expect(response.status).toBe(200);
    }

    expect(engine.created.size).toBe(1);
  });

  it("creates one competition across completed AND async_payment_succeeded for one session", async () => {
    const engine = new FakeEngineBilling();
    const session = paidSession({ id: "cs_test_delayed" });

    await handleStripeWebhook(signedRequest(event("checkout.session.completed", session, "evt_a")), deps(engine));
    await handleStripeWebhook(
      signedRequest(event("checkout.session.async_payment_succeeded", session, "evt_b")),
      deps(engine),
    );

    // Two distinct events, two distinct event ids, one session → one
    // competition. Event-id-keyed dedupe would produce two here.
    expect(engine.created.size).toBe(1);
  });

  it("reports the second delivery as already-fulfilled, not as a fresh success", async () => {
    const engine = new FakeEngineBilling();
    const payload = event("checkout.session.completed");

    const first = await handleStripeWebhook(signedRequest(payload), deps(engine));
    const second = await handleStripeWebhook(signedRequest(payload), deps(engine));

    await expect(first.json()).resolves.toMatchObject({ action: "fulfilled" });
    await expect(second.json()).resolves.toMatchObject({ action: "already-fulfilled" });
  });
});

describe("webhook — events it does and does not act on", () => {
  it("does nothing for an expired checkout, because pay-first left nothing behind", async () => {
    const engine = new FakeEngineBilling();
    const response = await handleStripeWebhook(
      signedRequest(event("checkout.session.expired", paidSession({ payment_status: "unpaid" }))),
      deps(engine),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ action: "none" });
    expect(engine.calls).toHaveLength(0);
  });

  it("does nothing for a failed async payment", async () => {
    const engine = new FakeEngineBilling();
    await handleStripeWebhook(signedRequest(event("checkout.session.async_payment_failed")), deps(engine));
    expect(engine.calls).toHaveLength(0);
  });

  it("acknowledges unrelated event types with 200 so Stripe stops retrying them", async () => {
    const engine = new FakeEngineBilling();
    const response = await handleStripeWebhook(signedRequest(event("invoice.paid")), deps(engine));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ action: "ignored" });
    expect(engine.calls).toHaveLength(0);
  });

  it("records nothing for a completed-but-unpaid session", async () => {
    const engine = new FakeEngineBilling();
    const response = await handleStripeWebhook(
      signedRequest(event("checkout.session.completed", paidSession({ payment_status: "unpaid" }))),
      deps(engine),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ action: "not-paid" });
    expect(engine.created.size).toBe(0);
  });
});

describe("webhook — failure handling", () => {
  it("asks Stripe to retry (5xx) when the engine is transiently down", async () => {
    const engine = new FakeEngineBilling();
    engine.failWith = new EngineBillingError("transient", "engine down");

    const response = await handleStripeWebhook(signedRequest(event("checkout.session.completed")), deps(engine));

    expect(response.status).toBe(503);
    expect(engine.created.size).toBe(0);
  });

  it("asks Stripe to retry when the engine endpoints are not configured", async () => {
    const engine = new FakeEngineBilling();
    engine.failWith = new EngineBillingError("not-configured", "no url");

    const response = await handleStripeWebhook(signedRequest(event("checkout.session.completed")), deps(engine));

    // Not a 200. A 200 here would tell Stripe the payment was handled when
    // nothing was recorded at all.
    expect(response.status).toBe(503);
  });

  it("still 5xxs on a non-retryable engine error rather than silently swallowing a paid session", async () => {
    const engine = new FakeEngineBilling();
    engine.failWith = new EngineBillingError("unauthorised", "service token rejected");

    const response = await handleStripeWebhook(signedRequest(event("checkout.session.completed")), deps(engine));
    expect(response.status).toBe(500);
  });

  it("recovers on Stripe's retry once the engine is back, creating exactly one competition", async () => {
    const engine = new FakeEngineBilling();
    const payload = event("checkout.session.completed");

    engine.failWith = new EngineBillingError("transient", "engine down");
    expect((await handleStripeWebhook(signedRequest(payload), deps(engine))).status).toBe(503);

    engine.failWith = null;
    expect((await handleStripeWebhook(signedRequest(payload), deps(engine))).status).toBe(200);
    expect((await handleStripeWebhook(signedRequest(payload), deps(engine))).status).toBe(200);

    expect(engine.created.size).toBe(1);
  });

  it("returns 200 for unusable metadata — retrying cannot make bad metadata good", async () => {
    const engine = new FakeEngineBilling();
    const response = await handleStripeWebhook(
      signedRequest(event("checkout.session.completed", paidSession({ metadata: {} }))),
      deps(engine),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ action: "unfulfillable" });
  });
});
