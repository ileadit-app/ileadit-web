import { handleCheckoutRequest } from "@/lib/billing/checkoutHandler";
import { createHttpEngineBillingClient } from "@/lib/billing/engineBilling";
import { getSiteBaseUrl, getStripeServerClient } from "@/lib/billing/stripeServer";

/**
 * `POST /api/billing/checkout` — start (or skip) payment for one
 * competition. Thin wrapper; the behaviour and its reasoning live in
 * `src/lib/billing/checkoutHandler.ts`, which the tests exercise directly.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let stripe;
  let siteBaseUrl;
  try {
    stripe = getStripeServerClient();
    siteBaseUrl = getSiteBaseUrl();
  } catch (error) {
    console.error("[billing] checkout route is not configured", error);
    return Response.json(
      { status: "error", message: "Payments aren't configured on this server. Nobody has been charged." },
      { status: 503 },
    );
  }

  return handleCheckoutRequest(request, {
    stripe,
    siteBaseUrl,
    engine: createHttpEngineBillingClient(),
    log: (message, detail) => console.log(message, detail ?? ""),
  });
}
