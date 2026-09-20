import { getFirebaseAuth } from "../firebase";
import type { DraftFieldError } from "./competitionDraft";

/**
 * Browser side of the checkout flow: hand a competition draft to
 * `/api/billing/checkout` and either redirect to Stripe or learn that
 * there is nothing to pay.
 *
 * NO STRIPE SDK. Checkout returns a hosted `session.url`; redirecting to
 * it is a plain `window.location.assign`. `@stripe/stripe-js` would add a
 * bundle for nothing, which is why the old `src/lib/stripe.ts` stub (an
 * unused `loadStripe()` call with a key that was never in `.env.local`) is
 * deleted on this branch rather than repaired.
 *
 * NO PRICE IS SENT. This deliberately cannot name an amount — the server
 * reads the band off the org. See `checkoutHandler.ts`.
 */

export interface StartCheckoutInput {
  orgId: string;
  /** Stable for one user attempt; the server uses it as the Stripe
   * idempotency key so a double-click cannot produce two sessions. */
  draftId: string;
  name: string;
  startTimeIso: string;
  durationDays: number;
  timeZone: string;
  description?: string;
  imageUrl?: string;
  backgroundImageUrl?: string;
}

export type StartCheckoutOutcome =
  /** Free band — the caller should create the competition directly through
   * the existing `createCompetition` callable. */
  | { status: "no-payment-required" }
  /** The browser is being sent to Stripe; this promise does not resolve to
   * anything useful afterwards. */
  | { status: "redirecting"; url: string }
  | { status: "quote-required"; message: string }
  | { status: "error"; message: string; fieldErrors?: DraftFieldError[] };

/** `crypto.randomUUID` where available, with a plain fallback so a draft id
 * can always be made (older Safari, and jsdom without the shim). */
export function newDraftId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
  return `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function startCompetitionCheckout(
  input: StartCheckoutInput,
  /** Injected in tests; defaults to a real redirect. */
  redirect: (url: string) => void = (url) => window.location.assign(url),
): Promise<StartCheckoutOutcome> {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    return { status: "error", message: "You've been signed out. Sign in again and try once more." };
  }

  let idToken: string;
  try {
    idToken = await user.getIdToken();
  } catch (error) {
    console.error("[billing] could not get an ID token", error);
    return { status: "error", message: "We couldn't verify your sign-in. Try again." };
  }

  const { orgId, ...draft } = input;

  let response: Response;
  try {
    response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ orgId, createdByUid: user.uid, draft }),
    });
  } catch (error) {
    console.error("[billing] checkout request failed", error);
    return { status: "error", message: "Couldn't reach the server. Nothing has been charged." };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { status: "error", message: "The server sent something we couldn't read. Nothing has been charged." };
  }

  const parsed = body as {
    status?: string;
    url?: string;
    message?: string;
    fieldErrors?: DraftFieldError[];
  };

  switch (parsed.status) {
    case "no-payment-required":
      return { status: "no-payment-required" };
    case "checkout":
      if (typeof parsed.url !== "string" || !parsed.url) {
        return { status: "error", message: "Checkout didn't return a payment link. Nothing has been charged." };
      }
      redirect(parsed.url);
      return { status: "redirecting", url: parsed.url };
    case "quote-required":
      return {
        status: "quote-required",
        message: parsed.message ?? "Email hello@ileadit.app and we'll set this competition up for you.",
      };
    default:
      return {
        status: "error",
        message: parsed.message ?? "We couldn't start checkout. Nothing has been charged.",
        ...(parsed.fieldErrors ? { fieldErrors: parsed.fieldErrors } : {}),
      };
  }
}
