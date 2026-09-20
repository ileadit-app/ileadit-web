import type Stripe from "stripe";
import { EngineBillingError, type EngineBillingClient } from "./engineBilling";
import { fulfilCheckoutSession } from "./fulfilCheckout";

/**
 * POST handler for `/api/stripe/webhook`. Modelled on santa-web's
 * `app/api/stripe/webhook/route.ts`, with the dedupe key changed for the
 * reason set out at length in `fulfilCheckout.ts` (session id, not event
 * id) and the logic split out of `route.ts` so it is testable with a real
 * signature and a fake engine.
 *
 * ── SIGNATURE VERIFICATION IS THE WHOLE SECURITY MODEL ──────────────────
 * This endpoint is public and unauthenticated by necessity — Stripe calls
 * it. The ONLY thing distinguishing a real payment confirmation from a
 * forged one is `stripe.webhooks.constructEvent`, which checks an HMAC over
 * the RAW body against `STRIPE_WEBHOOK_SECRET`. Consequences, all of them
 * load-bearing:
 *
 *   * The raw body must be read as TEXT and passed through byte-for-byte.
 *     `await request.json()` would re-serialise it and every signature
 *     would fail. Never "fix" a signature failure by skipping the check.
 *   * A missing `STRIPE_WEBHOOK_SECRET` returns 503 and processes nothing.
 *     It does NOT fall through to "well, assume it's Stripe" — an
 *     unverified webhook endpoint is a way to hand out free competitions by
 *     POSTing a made-up `checkout.session.completed`.
 *   * A bad signature is a 400 with no detail about why, and nothing is
 *     recorded.
 *
 * ── WHICH EVENTS, AND WHY THESE ─────────────────────────────────────────
 *   `checkout.session.completed`              — the card case; the session
 *                                               arrives already `paid`.
 *   `checkout.session.async_payment_succeeded` — delayed methods (bank
 *                                               debits). The `completed`
 *                                               event for these arrives
 *                                               `unpaid`, so without this
 *                                               a slow payment would never
 *                                               be fulfilled at all.
 *   `checkout.session.async_payment_failed`
 *   `checkout.session.expired`                — logged, nothing to undo:
 *                                               under pay-first nothing was
 *                                               created, so an abandoned or
 *                                               failed checkout leaves
 *                                               nothing behind. That is the
 *                                               order's whole advantage.
 *
 * Both fulfilling events funnel into ONE idempotent call keyed on the
 * session, so a session that fires both produces exactly one competition.
 */

export interface WebhookHandlerDeps {
  /** Only `webhooks.constructEvent` is used; typed narrowly so a test can
   * pass a real `new Stripe("sk_test_...")` without a network. */
  stripe: Pick<Stripe, "webhooks">;
  /** Throws if unset — the caller passes `getStripeWebhookSecret`, and a
   * throw here becomes a 503, never a skipped check. */
  webhookSecret: () => string;
  engine: EngineBillingClient;
  log?: (message: string, detail?: unknown) => void;
}

const FULFILLING_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);
const TERMINAL_EVENTS = new Set(["checkout.session.expired", "checkout.session.async_payment_failed"]);

export async function handleStripeWebhook(request: Request, deps: WebhookHandlerDeps): Promise<Response> {
  const log = deps.log ?? (() => {});

  let secret: string;
  try {
    secret = deps.webhookSecret();
  } catch (error) {
    log("[billing] webhook secret missing", error);
    return Response.json({ error: "webhook secret not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature") ?? "";
  // RAW text. See this file's header — do not change to request.json().
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = deps.stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    log("[billing] webhook signature rejected", { message: (error as Error).message });
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  if (TERMINAL_EVENTS.has(event.type)) {
    const session = event.data.object as Stripe.Checkout.Session;
    log(`[billing] ${event.type} — nothing created, nothing to undo`, { sessionId: session.id });
    return Response.json({ received: true, action: "none" }, { status: 200 });
  }

  if (!FULFILLING_EVENTS.has(event.type)) {
    // Acknowledged, not acted on. Returning 200 stops Stripe retrying
    // events this endpoint has no opinion about.
    return Response.json({ received: true, action: "ignored", type: event.type }, { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  try {
    const outcome = await fulfilCheckoutSession(session, { engine: deps.engine, log });
    log(`[billing] webhook ${event.type} → ${outcome.status}`, { eventId: event.id, sessionId: session.id });

    if (outcome.status === "unfulfillable") {
      // 200, deliberately: retrying cannot make bad metadata good, and
      // leaving Stripe to retry for 72 hours buries the one alert that
      // matters under noise. The log line above is the escalation.
      return Response.json({ received: true, action: "unfulfillable", reason: outcome.reason }, { status: 200 });
    }

    return Response.json({ received: true, action: outcome.status }, { status: 200 });
  } catch (error) {
    if (error instanceof EngineBillingError && error.retryable) {
      // 5xx ⇒ Stripe retries with backoff for ~72h. Safe because
      // fulfilment is keyed on the session id.
      log("[billing] fulfilment failed, asking Stripe to retry", { sessionId: session.id, kind: error.kind });
      return Response.json({ error: "fulfilment failed; retry" }, { status: 503 });
    }

    // Non-retryable engine error, or an unexpected throw. Still a 5xx —
    // Stripe retrying is harmless, and a 200 here would silently bury a
    // paid session that never became a competition.
    log("[billing] fulfilment failed (non-retryable)", { sessionId: session.id, error });
    return Response.json({ error: "fulfilment failed" }, { status: 500 });
  }
}
