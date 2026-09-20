import type Stripe from "stripe";
import { encodeDraftToMetadata, type CompetitionDraft, type DraftFieldError } from "./competitionDraft";
import { EngineBillingError, type EngineBillingClient } from "./engineBilling";
import { formatPence, resolvePrice } from "./priceBands";

/**
 * POST handler for `/api/billing/checkout` — "I want to create this
 * competition; take my money if there is any to take."
 *
 * The logic lives here rather than in `route.ts` so it can be called with
 * injected dependencies from a test without standing up a Next.js server.
 * `route.ts` is a four-line wrapper that supplies the real ones.
 *
 * ── THE RULE THIS FILE EXISTS TO ENFORCE ────────────────────────────────
 * THE PRICE IS NEVER TAKEN FROM THE REQUEST. The client sends an `orgId`
 * and a competition draft; it does not send an amount, a band, or a
 * currency, and if it did they would be ignored — the band is read off the
 * ORG, fetched server-side from the engine, and turned into an amount by
 * `resolvePrice()`. A client that could name its own price could name £0.
 *
 * ── AUTHORISATION IS THE ENGINE'S, NOT THIS ROUTE'S ─────────────────────
 * This repo has no `firebase-admin` and therefore cannot verify a Firebase
 * ID token itself. Rather than invent a weaker check, the caller's token is
 * forwarded to the engine on `fetchBillingOrg`, and the engine decides
 * whether this user may bill this org — the same division this codebase
 * already documents in `src/lib/adminClaim.ts` ("the callable is the
 * security boundary and this only mirrors it"). An `unauthorised` from the
 * engine becomes a 403 here and no Checkout Session is created.
 *
 * FLAGGED FOR PAUL: that makes the engine's `billingOrg` endpoint a real
 * security boundary that does not exist yet. Until it does, this route
 * cannot be exposed on a deployed site. It is not deployed by this branch.
 */

export interface CheckoutHandlerDeps {
  engine: EngineBillingClient;
  stripe: Pick<Stripe, "checkout">;
  /** Absolute site origin for success/cancel URLs, e.g. `https://ileadit.app`. */
  siteBaseUrl: string;
  log?: (message: string, detail?: unknown) => void;
}

export interface CheckoutRequestBody {
  orgId: string;
  draft: Omit<CompetitionDraft, "orgId" | "createdByUid">;
  /** Firebase uid of the signed-in caller. Sent for the record; the
   * ENGINE's verification of the bearer token is what actually establishes
   * identity, so a lie here is caught there, not trusted here. */
  createdByUid: string;
}

export type CheckoutResponseBody =
  /** Nothing to charge — the caller should create the competition directly
   * via the existing `createCompetition` callable. */
  | { status: "no-payment-required"; priceBand: string }
  /** Redirect the browser to `url`. */
  | { status: "checkout"; url: string; amountPence: number; amountLabel: string; priceBand: string }
  /** Enterprise: a human has to quote it. */
  | { status: "quote-required"; priceBand: string; message: string }
  | { status: "error"; message: string; fieldErrors?: DraftFieldError[] };

function json(body: CheckoutResponseBody, status: number): Response {
  return Response.json(body, { status });
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

function parseBody(raw: unknown): CheckoutRequestBody | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "Request body must be a JSON object." };
  const body = raw as Record<string, unknown>;

  const orgId = typeof body.orgId === "string" ? body.orgId.trim() : "";
  if (!orgId) return { error: "orgId is required." };

  const createdByUid = typeof body.createdByUid === "string" ? body.createdByUid.trim() : "";
  if (!createdByUid) return { error: "createdByUid is required." };

  if (typeof body.draft !== "object" || body.draft === null) return { error: "draft is required." };
  const draft = body.draft as Record<string, unknown>;

  const str = (key: string): string => (typeof draft[key] === "string" ? (draft[key] as string) : "");

  return {
    orgId,
    createdByUid,
    draft: {
      draftId: str("draftId"),
      name: str("name"),
      startTimeIso: str("startTimeIso"),
      durationDays: typeof draft.durationDays === "number" ? draft.durationDays : Number.NaN,
      timeZone: str("timeZone"),
      ...(str("description") ? { description: str("description") } : {}),
      ...(str("imageUrl") ? { imageUrl: str("imageUrl") } : {}),
      ...(str("backgroundImageUrl") ? { backgroundImageUrl: str("backgroundImageUrl") } : {}),
    },
  };
}

export async function handleCheckoutRequest(request: Request, deps: CheckoutHandlerDeps): Promise<Response> {
  const log = deps.log ?? (() => {});

  const callerIdToken = readBearerToken(request);
  if (!callerIdToken) {
    return json(
      { status: "error", message: "Sign in again — this request carried no Firebase ID token." },
      401,
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ status: "error", message: "Request body was not valid JSON." }, 400);
  }

  const parsed = parseBody(rawBody);
  if ("error" in parsed) return json({ status: "error", message: parsed.error }, 400);

  // ── The org, and therefore the price, comes from the engine ───────────
  let org;
  try {
    org = await deps.engine.fetchBillingOrg(parsed.orgId, callerIdToken);
  } catch (error) {
    if (error instanceof EngineBillingError) {
      log("[billing] fetchBillingOrg failed", { orgId: parsed.orgId, kind: error.kind });
      switch (error.kind) {
        case "unauthorised":
          return json({ status: "error", message: "You don't have permission to bill this organisation." }, 403);
        case "not-found":
          return json({ status: "error", message: "That organisation doesn't exist." }, 404);
        case "not-configured":
          return json(
            {
              status: "error",
              message: "Billing isn't configured on this server yet. Nobody has been charged.",
            },
            503,
          );
        default:
          return json({ status: "error", message: "Couldn't reach billing just now. Try again shortly." }, 502);
      }
    }
    throw error;
  }

  const price = resolvePrice(org.priceBand);

  if (price.kind === "quote-required") {
    return json(
      {
        status: "quote-required",
        priceBand: org.priceBand,
        message:
          `${price.band.label} pricing is agreed with us directly rather than paid online. ` +
          `Email hello@ileadit.app and we'll set this competition up for you.`,
      },
      409,
    );
  }

  const fullDraft: CompetitionDraft = {
    ...parsed.draft,
    orgId: org.id,
    createdByUid: parsed.createdByUid,
  };

  // Validate the draft BEFORE any Stripe call, including on the free path,
  // so "too long to carry through a payment" is never discovered after the
  // customer has paid.
  const encoded = encodeDraftToMetadata(fullDraft, org.priceBand);
  if (!encoded.ok) {
    return json(
      { status: "error", message: "That competition can't be submitted as it stands.", fieldErrors: encoded.errors },
      400,
    );
  }

  if (price.kind === "free") {
    // No Checkout Session, no Stripe object, no charge. The caller creates
    // the competition through the existing `createCompetition` callable.
    // The free band is genuinely free — it is NOT a £0 Stripe payment.
    log("[billing] free band; no payment required", { orgId: org.id, band: org.priceBand });
    return json({ status: "no-payment-required", priceBand: org.priceBand }, 200);
  }

  const successUrl = `${deps.siteBaseUrl}/competitions/new/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${deps.siteBaseUrl}/competitions/new?checkout=cancelled`;

  let session: Stripe.Checkout.Session;
  try {
    session = await deps.stripe.checkout.sessions.create(
      {
        mode: "payment",
        ...(org.stripeCustomerId ? { customer: org.stripeCustomerId } : {}),
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: price.currency,
              unit_amount: price.amountPence,
              product_data: {
                name: `ileadit competition — ${fullDraft.name}`,
                description: `${price.band.label} band · ${fullDraft.durationDays} day(s) · ${org.name}`,
              },
            },
          },
        ],
        // The draft rides on the SESSION, because the session id is the
        // fulfilment key (see fulfilCheckout.ts).
        metadata: encoded.metadata,
        // Mirrored onto the PaymentIntent so a refund investigation from
        // the Stripe dashboard can see which competition it was for
        // without following the session back.
        payment_intent_data: {
          metadata: {
            comp_draftId: fullDraft.draftId,
            comp_orgId: org.id,
            comp_name: fullDraft.name,
          },
        },
        client_reference_id: fullDraft.draftId,
        success_url: successUrl,
        cancel_url: cancelUrl,
      },
      {
        // A double-clicked submit, or a POST the browser retried, reuses
        // the SAME session instead of creating a second one — so it cannot
        // produce a second charge. Keyed on the caller's draftId, which is
        // stable for one attempt at one competition.
        idempotencyKey: `checkout:${org.id}:${fullDraft.draftId}`,
      },
    );
  } catch (error) {
    log("[billing] Stripe session creation failed", { orgId: org.id, error });
    return json({ status: "error", message: "Couldn't start checkout. Nothing has been charged." }, 502);
  }

  if (!session.url) {
    return json({ status: "error", message: "Stripe did not return a checkout URL. Nothing has been charged." }, 502);
  }

  return json(
    {
      status: "checkout",
      url: session.url,
      amountPence: price.amountPence,
      amountLabel: formatPence(price.amountPence),
      priceBand: org.priceBand,
    },
    200,
  );
}
