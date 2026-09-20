import { createHttpEngineBillingClient } from "@/lib/billing/engineBilling";
import { getStripeServerClient, getStripeWebhookSecret } from "@/lib/billing/stripeServer";
import { handleStripeWebhook } from "@/lib/billing/webhookHandler";

/**
 * Stripe webhook endpoint. Deliberately a thin wrapper — all behaviour,
 * and all of the reasoning about it, lives in
 * `src/lib/billing/webhookHandler.ts`, which is what the tests exercise.
 *
 * `runtime = "nodejs"`: signature verification needs Node's crypto, and the
 * Stripe SDK's sync `constructEvent` is Node-only. `dynamic = "force-dynamic"`:
 * this must never be prerendered or cached.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let stripe;
  try {
    stripe = getStripeServerClient();
  } catch (error) {
    // No secret key (or a live key without the explicit opt-in). 503, not a
    // bare crash, so Stripe retries once the server is configured — and so
    // the dashboard shows a legible failure rather than an unhandled 500.
    console.error("[billing] webhook cannot start Stripe", error);
    return Response.json({ error: "stripe not configured" }, { status: 503 });
  }

  return handleStripeWebhook(request, {
    stripe,
    webhookSecret: getStripeWebhookSecret,
    engine: createHttpEngineBillingClient(),
    log: (message, detail) => console.log(message, detail ?? ""),
  });
}
