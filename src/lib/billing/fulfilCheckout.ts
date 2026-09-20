import type Stripe from "stripe";
import { decodeDraftFromMetadata } from "./competitionDraft";
import type { EngineBillingClient, PaidCompetitionRecord } from "./engineBilling";

/**
 * ════════════════════════════════════════════════════════════════════════
 * THE ORDER-OF-OPERATIONS DECISION: **PAY FIRST, THEN CREATE.**
 * ════════════════════════════════════════════════════════════════════════
 *
 * A paid competition is created only once the payment is confirmed. It does
 * not exist, in any state, before then. The alternative — create it as a
 * draft, then charge — was considered and rejected.
 *
 * WHY. Both orders have a failure mode; they are not symmetrical.
 *
 *   Create-then-pay fails INTO A HOLE THIS REPO CANNOT CLOSE. There is no
 *   `paymentStatus` field on a competition and no unpaid/draft state in the
 *   engine (see this repo's CLAUDE.md "Firestore Collections" section and
 *   `src/lib/createCompetition.ts`'s list of engine-derived fields — status
 *   is derived from dates, not from payment). Every competition is readable
 *   by any signed-in user under the current rules. So "create, then send to
 *   Stripe" means a user who closes the tab at the payment page has a live,
 *   joinable, free competition. That failure is SILENT, SELF-SERVICE, and
 *   REPEATABLE AT ZERO COST by anyone who can reach the form. Closing it
 *   would require the engine to grow an unpaid state and suppress it
 *   everywhere — engine work this branch does not own and must not invent.
 *
 *   Pay-then-create fails LOUDLY AND RARELY. It needs Stripe to succeed and
 *   the engine to fail in the same breath. When it happens we hold a Stripe
 *   Checkout Session and PaymentIntent, the exact competition the customer
 *   asked for (carried in the session's metadata — `competitionDraft.ts`),
 *   and a customer who is visibly mid-flow rather than quietly ahead.
 *
 * ── WHAT ACTUALLY HAPPENS IF THE USER PAYS AND CREATION THEN FAILS ──────
 *
 * The money is taken and the competition does not appear. Concretely:
 *
 *  1. The webhook calls the engine, the engine fails, the webhook returns
 *     5xx. Stripe retries `checkout.session.completed` with backoff for up
 *     to ~72 hours. Because the key is the SESSION id (below), every retry
 *     is safe: at most one competition and one billing record can result.
 *  2. Independently, when the customer lands on
 *     `/competitions/new/success?session_id=...`, that page runs THIS SAME
 *     function against THIS SAME key. So the common case — engine briefly
 *     down, or the webhook not yet delivered — self-heals the moment the
 *     user gets back from Stripe, without waiting for a retry. Two
 *     triggers, one idempotent operation: the standard Stripe fulfilment
 *     pattern, and the reason this function is a shared module rather than
 *     webhook-only code.
 *  3. If BOTH keep failing for 72 hours, Stripe gives up and the session
 *     sits in the dashboard as paid-and-unfulfilled. The success page has
 *     by then shown the customer a clear failure with their payment
 *     reference — never a "you're all set" — so the situation is visible
 *     from both ends rather than discovered by a customer wondering where
 *     their competition went.
 *
 * THIS IS THE FAILURE MODE BEING ACCEPTED: a charge can exist for up to 72
 * hours with no competition against it, recoverable by re-driving the same
 * session id, and resolvable by refunding the PaymentIntent. It is accepted
 * because the alternative order's failure is free competitions that nobody
 * finds out about. See the report and the open question for Paul about
 * whether an automatic refund should be attempted after N failed retries —
 * this branch deliberately does NOT auto-refund, because an automatic
 * refund on a transient engine outage would destroy a recoverable
 * situation.
 *
 * ── THE IDEMPOTENCY KEY IS THE CHECKOUT SESSION, NOT THE EVENT ──────────
 *
 * santa-web keys its webhook dedupe on `event.id` and that is right for
 * what it does there. Here it would be WRONG, and this is the single
 * subtlest thing on this branch:
 *
 *   * `event.id` dedupes RETRIES of one event. It does not dedupe two
 *     DIFFERENT events that describe the same paid session — and there are
 *     such pairs: `checkout.session.completed` and
 *     `checkout.session.async_payment_succeeded` can both arrive for one
 *     session paid by a delayed method. Keyed on `event.id` those are two
 *     distinct keys and would create two competitions and two billing
 *     records for one payment. Double-recording is the exact failure this
 *     ticket names as the one that matters most.
 *   * `event.id` also cannot dedupe the webhook against the success page,
 *     which has no event at all — only a session id.
 *
 * `session.id` is one-to-one with "a customer paid for one competition",
 * which is precisely the thing that must happen once. Every path into
 * fulfilment has it. So that is the key, and `event.id` is used only for
 * logging.
 */

export interface FulfilCheckoutDeps {
  engine: EngineBillingClient;
  /** Injected so tests do not need a clock, and so a log line can carry a
   * deterministic timestamp. */
  now?: () => Date;
  log?: (message: string, detail?: unknown) => void;
}

export type FulfilmentOutcome =
  /** Created this time. */
  | { status: "fulfilled"; billingEventId: string; competitionId: string | null }
  /** Already created by an earlier call with the same key. Not an error —
   * the expected result of a Stripe retry or a success-page refresh. */
  | { status: "already-fulfilled"; billingEventId: string; competitionId: string | null }
  /** The session exists but is not paid (abandoned, expired, or an async
   * payment still pending). Nothing to do, and nothing went wrong. */
  | { status: "not-paid"; billingEventId: string; paymentStatus: string | null }
  /** The session cannot be turned into a competition — bad or absent
   * metadata, no amount. Terminal: retrying cannot fix it. */
  | { status: "unfulfillable"; billingEventId: string; reason: string };

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * Turn a paid Checkout Session into exactly one competition.
 *
 * Safe to call any number of times with the same session. Throws only for
 * conditions the CALLER must decide about (an `EngineBillingError` — the
 * webhook turns a retryable one into a 5xx so Stripe tries again). Every
 * outcome that is merely "nothing to do" is returned, not thrown.
 */
export async function fulfilCheckoutSession(
  session: Stripe.Checkout.Session,
  deps: FulfilCheckoutDeps,
): Promise<FulfilmentOutcome> {
  const log = deps.log ?? (() => {});
  const billingEventId = session.id;

  if (session.payment_status !== "paid") {
    log("[billing] session not paid; nothing to fulfil", {
      billingEventId,
      paymentStatus: session.payment_status,
    });
    return { status: "not-paid", billingEventId, paymentStatus: session.payment_status ?? null };
  }

  const decoded = decodeDraftFromMetadata(session.metadata ?? undefined);
  if (!decoded.ok) {
    // Money has moved and we cannot tell what it was for. Terminal, and
    // deliberately loud: this needs a human with the session id in hand.
    log("[billing] PAID SESSION WITH UNUSABLE METADATA — needs manual handling", {
      billingEventId,
      reason: decoded.reason,
    });
    return { status: "unfulfillable", billingEventId, reason: decoded.reason };
  }

  // What was ACTUALLY charged, read off the paid session — not recomputed
  // from the price table, which may have changed since checkout began.
  const amountPaidPence = session.amount_total;
  if (typeof amountPaidPence !== "number") {
    log("[billing] paid session has no amount_total", { billingEventId });
    return { status: "unfulfillable", billingEventId, reason: "paid session has no amount_total" };
  }

  const record: PaidCompetitionRecord = {
    billingEventId,
    orgId: decoded.draft.orgId,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: idOf(session.payment_intent),
    stripeCustomerId: idOf(session.customer),
    amountPaidPence,
    // Stripe always sets this on a completed session; the fallback exists
    // only so a malformed fixture cannot write `undefined` into a record.
    currency: session.currency ?? "gbp",
    priceBand: decoded.priceBand,
    draft: decoded.draft,
  };

  const outcome = await deps.engine.recordPaidCompetition(record);

  log(`[billing] engine reported ${outcome.status}`, {
    billingEventId,
    competitionId: outcome.competitionId,
    at: (deps.now ?? (() => new Date()))().toISOString(),
  });

  return outcome.status === "duplicate"
    ? { status: "already-fulfilled", billingEventId, competitionId: outcome.competitionId }
    : { status: "fulfilled", billingEventId, competitionId: outcome.competitionId };
}
