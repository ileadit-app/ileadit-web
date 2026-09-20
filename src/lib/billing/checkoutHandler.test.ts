// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { FakeEngineBilling, fakeOrg } from "./__fixtures__/fakeEngineBilling";
import { handleCheckoutRequest, type CheckoutHandlerDeps } from "./checkoutHandler";
import { EngineBillingError } from "./engineBilling";
import { PRICE_BANDS } from "./priceBands";

/**
 * Price resolution at the point of charging, and the refusals around it.
 *
 * The property under test throughout: THE AMOUNT COMES FROM THE ORG'S BAND,
 * fetched server-side — never from the request. Several cases below send a
 * deliberately hostile body to prove the client cannot influence it.
 */

/** Derived from the method itself rather than a namespace path — Stripe v22
 * declares `SessionCreateParams` in a different `Checkout` namespace from
 * the one `Stripe.Checkout` resolves to. */
type SessionCreateParams = NonNullable<Parameters<Stripe["checkout"]["sessions"]["create"]>[0]>;

function stripeDouble() {
  const create = vi.fn(async (params: SessionCreateParams, options?: { idempotencyKey?: string }) => ({
    id: "cs_test_created",
    url: "https://checkout.stripe.test/c/pay/cs_test_created",
    _params: params,
    _options: options,
  }));
  return { create, client: { checkout: { sessions: { create } } } as unknown as Pick<Stripe, "checkout"> };
}

function deps(engine: FakeEngineBilling, stripe: Pick<Stripe, "checkout">): CheckoutHandlerDeps {
  return { engine, stripe, siteBaseUrl: "https://ileadit.app" };
}

function request(body: unknown, token: string | null = "id-token-abc"): Request {
  return new Request("https://ileadit.app/api/billing/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    orgId: "org_acme",
    createdByUid: "uid_paul",
    draft: {
      draftId: "draft_abc",
      name: "Marketing team step-off",
      startTimeIso: "2026-10-01T08:00:00.000Z",
      durationDays: 7,
      timeZone: "Europe/London",
    },
    ...overrides,
  };
}

describe("checkout — price comes from the org's band", () => {
  it("charges the Team band's amount for a Team org", async () => {
    const engine = new FakeEngineBilling({ org_acme: fakeOrg({ priceBand: "team" }) });
    const stripe = stripeDouble();

    const response = await handleCheckoutRequest(request(validBody()), deps(engine, stripe.client));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "checkout", amountPence: PRICE_BANDS.team.amountPence, priceBand: "team" });

    const params = stripe.create.mock.calls[0][0];
    expect(params.line_items?.[0]?.price_data?.unit_amount).toBe(PRICE_BANDS.team.amountPence);
    expect(params.line_items?.[0]?.price_data?.currency).toBe("gbp");
  });

  it("charges the Company band's (higher) amount for a Company org — same request body", async () => {
    const engine = new FakeEngineBilling({ org_acme: fakeOrg({ priceBand: "company" }) });
    const stripe = stripeDouble();

    const response = await handleCheckoutRequest(request(validBody()), deps(engine, stripe.client));
    const body = await response.json();

    expect(body.amountPence).toBe(PRICE_BANDS.company.amountPence);
    expect(body.amountPence).toBeGreaterThan(PRICE_BANDS.team.amountPence!);
  });

  it("IGNORES an amount, band or currency smuggled into the request body", async () => {
    const engine = new FakeEngineBilling({ org_acme: fakeOrg({ priceBand: "company" }) });
    const stripe = stripeDouble();

    const hostile = validBody({
      amountPence: 1,
      priceBand: "free",
      currency: "xyz",
      draft: { ...validBody().draft, amountPence: 1, priceBand: "free" },
    });

    const response = await handleCheckoutRequest(request(hostile), deps(engine, stripe.client));
    const body = await response.json();

    // The org is on Company; nothing the client sent moved the price.
    expect(body.amountPence).toBe(PRICE_BANDS.company.amountPence);
    expect(stripe.create.mock.calls[0][0].line_items?.[0]?.price_data?.unit_amount).toBe(
      PRICE_BANDS.company.amountPence,
    );
  });

  it("takes NO payment for a Free-band org and creates no Stripe session", async () => {
    const engine = new FakeEngineBilling({ org_acme: fakeOrg({ priceBand: "free" }) });
    const stripe = stripeDouble();

    const response = await handleCheckoutRequest(request(validBody()), deps(engine, stripe.client));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "no-payment-required", priceBand: "free" });
    // Not a £0 charge — no Stripe object at all.
    expect(stripe.create).not.toHaveBeenCalled();
  });

  it("refuses an Enterprise org with quote-required, NEVER a free pass", async () => {
    const engine = new FakeEngineBilling({ org_acme: fakeOrg({ priceBand: "enterprise" }) });
    const stripe = stripeDouble();

    const response = await handleCheckoutRequest(request(validBody()), deps(engine, stripe.client));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.status).toBe("quote-required");
    expect(body.status).not.toBe("no-payment-required");
    expect(stripe.create).not.toHaveBeenCalled();
  });
});

describe("checkout — the Stripe session it builds", () => {
  it("attaches the whole draft as session metadata, so the webhook can rebuild it", async () => {
    const engine = new FakeEngineBilling({ org_acme: fakeOrg() });
    const stripe = stripeDouble();

    await handleCheckoutRequest(request(validBody()), deps(engine, stripe.client));
    const metadata = stripe.create.mock.calls[0][0].metadata as Record<string, string>;

    expect(metadata).toMatchObject({
      comp_orgId: "org_acme",
      comp_createdByUid: "uid_paul",
      comp_name: "Marketing team step-off",
      comp_durationDays: "7",
      comp_priceBand: "team",
    });
  });

  it("sends a Stripe idempotency key derived from the draft, so a double-click cannot double-charge", async () => {
    const engine = new FakeEngineBilling({ org_acme: fakeOrg() });
    const stripe = stripeDouble();

    await handleCheckoutRequest(request(validBody()), deps(engine, stripe.client));
    await handleCheckoutRequest(request(validBody()), deps(engine, stripe.client));

    const [, firstOptions] = stripe.create.mock.calls[0];
    const [, secondOptions] = stripe.create.mock.calls[1];
    expect(firstOptions?.idempotencyKey).toBe("checkout:org_acme:draft_abc");
    // Identical key ⇒ Stripe returns the SAME session rather than making a
    // second one, so the two attempts cannot become two charges.
    expect(secondOptions?.idempotencyKey).toBe(firstOptions?.idempotencyKey);
  });

  it("reuses the org's existing Stripe customer, and omits it for an org that has none", async () => {
    const withCustomer = new FakeEngineBilling({ org_acme: fakeOrg({ stripeCustomerId: "cus_existing" }) });
    const withoutCustomer = new FakeEngineBilling({ org_acme: fakeOrg({ stripeCustomerId: null }) });

    const a = stripeDouble();
    await handleCheckoutRequest(request(validBody()), deps(withCustomer, a.client));
    expect(a.create.mock.calls[0][0].customer).toBe("cus_existing");

    const b = stripeDouble();
    const response = await handleCheckoutRequest(request(validBody()), deps(withoutCustomer, b.client));
    expect(response.status).toBe(200);
    expect(b.create.mock.calls[0][0].customer).toBeUndefined();
  });

  it("builds absolute success and cancel URLs from the configured site origin", async () => {
    const engine = new FakeEngineBilling({ org_acme: fakeOrg() });
    const stripe = stripeDouble();

    await handleCheckoutRequest(request(validBody()), deps(engine, stripe.client));
    const params = stripe.create.mock.calls[0][0];

    expect(params.success_url).toBe("https://ileadit.app/competitions/new/success?session_id={CHECKOUT_SESSION_ID}");
    expect(params.cancel_url).toBe("https://ileadit.app/competitions/new?checkout=cancelled");
  });

  it("forwards the caller's ID token to the engine — authorisation is the engine's call", async () => {
    const engine = new FakeEngineBilling({ org_acme: fakeOrg() });
    const stripe = stripeDouble();

    await handleCheckoutRequest(request(validBody(), "token-xyz"), deps(engine, stripe.client));
    expect(engine.orgFetches[0]).toEqual({ orgId: "org_acme", callerIdToken: "token-xyz" });
  });
});

describe("checkout — refusals, all before any money moves", () => {
  it("rejects a request with no bearer token", async () => {
    const engine = new FakeEngineBilling({ org_acme: fakeOrg() });
    const stripe = stripeDouble();

    const response = await handleCheckoutRequest(request(validBody(), null), deps(engine, stripe.client));

    expect(response.status).toBe(401);
    expect(engine.orgFetches).toHaveLength(0);
    expect(stripe.create).not.toHaveBeenCalled();
  });

  it("turns an engine 'unauthorised' into a 403 and creates no session", async () => {
    const engine = new FakeEngineBilling({ org_acme: fakeOrg() });
    engine.failWith = new EngineBillingError("unauthorised", "not a member of this org");
    const stripe = stripeDouble();

    const response = await handleCheckoutRequest(request(validBody()), deps(engine, stripe.client));

    expect(response.status).toBe(403);
    expect(stripe.create).not.toHaveBeenCalled();
  });

  it("returns 404 for an org that does not exist", async () => {
    const engine = new FakeEngineBilling({});
    const stripe = stripeDouble();

    const response = await handleCheckoutRequest(request(validBody()), deps(engine, stripe.client));
    expect(response.status).toBe(404);
  });

  it("returns 503, not a charge, when the engine is not configured", async () => {
    const engine = new FakeEngineBilling({ org_acme: fakeOrg() });
    engine.failWith = new EngineBillingError("not-configured", "no url");
    const stripe = stripeDouble();

    const response = await handleCheckoutRequest(request(validBody()), deps(engine, stripe.client));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ message: expect.stringContaining("Nobody has been charged") });
  });

  it("rejects an over-long description BEFORE creating a session, naming the field", async () => {
    const engine = new FakeEngineBilling({ org_acme: fakeOrg() });
    const stripe = stripeDouble();

    const body = validBody({ draft: { ...validBody().draft, description: "x".repeat(501) } });
    const response = await handleCheckoutRequest(request(body), deps(engine, stripe.client));
    const parsed = await response.json();

    expect(response.status).toBe(400);
    expect(parsed.fieldErrors.map((e: { field: string }) => e.field)).toContain("description");
    // The whole point: the refusal happens before the customer is sent to
    // a payment page, not after they have paid.
    expect(stripe.create).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing orgId", { orgId: "" }],
    ["a missing createdByUid", { createdByUid: "" }],
    ["a missing draft", { draft: undefined }],
  ])("rejects %s with 400", async (_label, overrides) => {
    const engine = new FakeEngineBilling({ org_acme: fakeOrg() });
    const stripe = stripeDouble();

    const response = await handleCheckoutRequest(request(validBody(overrides)), deps(engine, stripe.client));

    expect(response.status).toBe(400);
    expect(stripe.create).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON at all", async () => {
    const engine = new FakeEngineBilling({ org_acme: fakeOrg() });
    const stripe = stripeDouble();

    const bad = new Request("https://ileadit.app/api/billing/checkout", {
      method: "POST",
      headers: { authorization: "Bearer t" },
      body: "not json",
    });

    expect((await handleCheckoutRequest(bad, deps(engine, stripe.client))).status).toBe(400);
  });

  it("returns 502 and says nothing was charged when Stripe itself fails", async () => {
    const engine = new FakeEngineBilling({ org_acme: fakeOrg() });
    const create = vi.fn(async () => {
      throw new Error("Stripe is down");
    });
    const stripe = { checkout: { sessions: { create } } } as unknown as Pick<Stripe, "checkout">;

    const response = await handleCheckoutRequest(request(validBody()), deps(engine, stripe));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ message: expect.stringContaining("Nothing has been charged") });
  });

  it("returns 502 when Stripe returns a session with no URL", async () => {
    const engine = new FakeEngineBilling({ org_acme: fakeOrg() });
    const create = vi.fn(async () => ({ id: "cs_no_url", url: null }));
    const stripe = { checkout: { sessions: { create } } } as unknown as Pick<Stripe, "checkout">;

    expect((await handleCheckoutRequest(request(validBody()), deps(engine, stripe))).status).toBe(502);
  });
});
