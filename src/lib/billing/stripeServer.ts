import Stripe from "stripe";

/**
 * THE server-side Stripe client. Patterned on santa-web's `lib/stripe.ts`
 * (the same author's working integration) with ONE deliberate divergence,
 * explained below.
 *
 * santa-web does this at module top level:
 *
 *     const key = process.env.STRIPE_SECRET_KEY;
 *     if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
 *     export const stripe = new Stripe(key);
 *
 * That is right for santa-web, where the server always has its env. It is
 * WRONG here, for the exact reason `src/lib/firebase.ts` already documents
 * at length: `next build` evaluates every route module during prerender, so
 * a top-level throw takes down the whole build on any machine without a
 * `.env.local` — including CI, and including a developer who only wants to
 * run the marketing pages. Same lesson, same fix: lazy getter.
 *
 * What is NOT softened is the failure itself. There is no fallback client,
 * no no-op stub, and no "" default. Call `getStripeServerClient()` with no
 * `STRIPE_SECRET_KEY` and it throws, loudly, naming the variable. A
 * payments path that silently does nothing is worse than one that 500s.
 *
 * SERVER ONLY. Never import this from a `"use client"` module — it reads a
 * secret, and Next.js will (correctly) refuse to bundle it for the browser.
 * The browser side of Checkout needs nothing from Stripe at all here: the
 * checkout route returns `session.url` and the client does a plain
 * redirect, so `@stripe/stripe-js` is not needed and is not used. (The
 * previous five-line `src/lib/stripe.ts` stub, which called `loadStripe()`
 * with a key that was never in `.env.local` and which nothing imported, is
 * deleted on this branch rather than left to look like a working thing.)
 */

let cachedClient: Stripe | null = null;
let cachedForKey: string | null = null;

/**
 * Explicit, deliberate gate on live keys. Paul's instruction for this work
 * was test mode only, and "the wrong key was in the env" is a mistake that
 * otherwise produces real charges with no warning at all.
 *
 * This is not a permanent ban — going live is setting `STRIPE_ALLOW_LIVE_MODE=true`
 * alongside the live key, one deliberate act, at which point this check
 * stops firing. What it prevents is a live key reaching production by
 * accident (copied into the wrong `.env`, restored from the wrong backup)
 * while everyone still believes they are in test mode.
 */
function assertKeyModeAllowed(key: string): void {
  const isLive = key.startsWith("sk_live_") || key.startsWith("rk_live_");
  if (!isLive) return;

  if (process.env.STRIPE_ALLOW_LIVE_MODE === "true") return;

  throw new Error(
    "STRIPE_SECRET_KEY is a LIVE key but STRIPE_ALLOW_LIVE_MODE is not \"true\". " +
      "Refusing to start Stripe in live mode. Use a test key (sk_test_...), or set " +
      "STRIPE_ALLOW_LIVE_MODE=true deliberately if real charges are genuinely intended.",
  );
}

export function getStripeServerClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Copy .env.example to .env.local and fill in the test-mode " +
        "secret key from the Stripe dashboard. Never commit .env.local.",
    );
  }

  assertKeyModeAllowed(key);

  // Re-create if the key changed (only really happens in tests, which set
  // the env var per-case) — caching on the key value rather than on "have
  // we built one yet" means a test can never accidentally reuse a client
  // built from a previous case's key.
  if (cachedClient && cachedForKey === key) return cachedClient;

  cachedClient = new Stripe(key);
  cachedForKey = key;
  return cachedClient;
}

/**
 * The webhook signing secret, or a throw. Separate from the client because
 * a missing signing secret is a DIFFERENT failure with a different fix, and
 * because the webhook route must be able to fail on it before it has done
 * anything else.
 */
export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not set. Without it the webhook cannot verify that a request " +
        "actually came from Stripe, and an unverified payment-confirmation endpoint is forgeable. " +
        "Get it from `stripe listen` (local) or the dashboard's webhook endpoint (deployed).",
    );
  }
  return secret;
}

/**
 * Absolute base URL for Checkout's `success_url` / `cancel_url`. Required,
 * not inferred from the incoming request's `Origin` header — Stripe needs
 * an absolute URL, and deriving one from an attacker-controllable header is
 * a bad habit to start in a payments path even where the blast radius is
 * small.
 */
export function getSiteBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL is not set. Stripe Checkout needs absolute success/cancel URLs " +
        "(e.g. http://localhost:3000 in development, https://ileadit.app in production).",
    );
  }
  return url.replace(/\/+$/, "");
}
