import { loadStripe } from "@stripe/stripe-js";

// Stripe publishable key — actual value must be added to .env.local.
export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);
