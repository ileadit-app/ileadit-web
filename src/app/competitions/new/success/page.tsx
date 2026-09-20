import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { createHttpEngineBillingClient } from "@/lib/billing/engineBilling";
import { fulfilCheckoutSession, type FulfilmentOutcome } from "@/lib/billing/fulfilCheckout";
import { getStripeServerClient } from "@/lib/billing/stripeServer";

/**
 * Where Stripe sends the customer after a successful payment.
 *
 * THIS PAGE IS NOT DECORATION — it is the second of the two triggers that
 * drive fulfilment, running the SAME idempotent
 * `fulfilCheckoutSession(session.id)` the webhook runs. Read
 * `src/lib/billing/fulfilCheckout.ts`'s header for why there are two: under
 * pay-first, a webhook that is late or briefly failing would otherwise
 * leave a paying customer looking at nothing. Here, the moment they get
 * back from Stripe, the competition is created if it has not been already.
 * Whichever trigger arrives second sees `already-fulfilled` and does
 * nothing.
 *
 * It also never lies. If fulfilment has not happened, the customer is told
 * so plainly, with their payment reference, rather than shown a success
 * screen for a competition that does not exist.
 *
 * Server component: it needs the Stripe secret key, which must never reach
 * the browser. `force-dynamic` because it acts on a query parameter and has
 * a side effect — it must never be prerendered or cached.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageState =
  | { kind: "no-session" }
  | { kind: "not-configured" }
  | { kind: "stripe-error" }
  | { kind: "outcome"; outcome: FulfilmentOutcome; sessionId: string };

async function resolveState(sessionId: string | undefined): Promise<PageState> {
  if (!sessionId) return { kind: "no-session" };

  let stripe;
  try {
    stripe = getStripeServerClient();
  } catch (error) {
    console.error("[billing] success page cannot start Stripe", error);
    return { kind: "not-configured" };
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    console.error("[billing] success page could not retrieve session", sessionId, error);
    return { kind: "stripe-error" };
  }

  try {
    const outcome = await fulfilCheckoutSession(session, {
      engine: createHttpEngineBillingClient(),
      log: (message, detail) => console.log(message, detail ?? ""),
    });
    return { kind: "outcome", outcome, sessionId };
  } catch (error) {
    // The webhook is still retrying in the background; say so honestly
    // rather than either crashing or claiming success.
    console.error("[billing] success-page fulfilment failed", sessionId, error);
    return {
      kind: "outcome",
      sessionId,
      outcome: { status: "unfulfillable", billingEventId: sessionId, reason: "fulfilment is still in progress" },
    };
  }
}

function Shell({
  tone,
  icon,
  title,
  children,
}: {
  tone: "good" | "warn";
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-20 text-center sm:px-6">
      <div
        className={
          "mx-auto flex size-12 items-center justify-center rounded-full " +
          (tone === "good" ? "bg-brand-gold/15 text-brand-navy" : "bg-brand-coral/10 text-brand-coral")
        }
      >
        {icon}
      </div>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{title}</h1>
      <div className="mx-auto mt-3 max-w-md space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex h-11 items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
      >
        Go to your dashboard
      </Link>
    </div>
  );
}

function PaymentReference({ sessionId }: { sessionId: string }) {
  return (
    <p>
      Your payment reference is <code className="font-mono text-xs text-foreground">{sessionId}</code>. Quote it if you
      email{" "}
      <a href="mailto:hello@ileadit.app" className="font-semibold text-foreground underline">
        hello@ileadit.app
      </a>
      .
    </p>
  );
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const state = await resolveState(sessionId);

  if (state.kind === "no-session") {
    return (
      <Shell tone="warn" icon={<AlertTriangle className="size-6" aria-hidden="true" />} title="Nothing to show here">
        <p>This page needs a checkout reference. If you were paying for a competition, reopen the link Stripe sent you.</p>
      </Shell>
    );
  }

  if (state.kind === "not-configured" || state.kind === "stripe-error") {
    return (
      <Shell
        tone="warn"
        icon={<AlertTriangle className="size-6" aria-hidden="true" />}
        title="We couldn't check your payment"
      >
        <p>
          Your card may still have been charged — we just can&apos;t confirm it from here right now. Please don&apos;t
          pay again.
        </p>
        <p>
          Email{" "}
          <a href="mailto:hello@ileadit.app" className="font-semibold text-foreground underline">
            hello@ileadit.app
          </a>{" "}
          and we&apos;ll sort it out.
        </p>
      </Shell>
    );
  }

  const { outcome } = state;

  if (outcome.status === "fulfilled" || outcome.status === "already-fulfilled") {
    return (
      <Shell tone="good" icon={<CheckCircle2 className="size-6" aria-hidden="true" />} title="Your competition is set up">
        <p>Payment received and your competition has been created. You&apos;ll find it on your dashboard.</p>
      </Shell>
    );
  }

  if (outcome.status === "not-paid") {
    return (
      <Shell tone="warn" icon={<Clock className="size-6" aria-hidden="true" />} title="Payment not completed">
        <p>
          We haven&apos;t received payment for this competition, so nothing has been created and nothing has been
          charged. Some payment methods take a few days to clear — if you used one, we&apos;ll set the competition up
          automatically once it does.
        </p>
        <PaymentReference sessionId={state.sessionId} />
      </Shell>
    );
  }

  // `unfulfillable` — paid, not created. Never dressed up as success.
  return (
    <Shell
      tone="warn"
      icon={<AlertTriangle className="size-6" aria-hidden="true" />}
      title="Payment received — setup didn't finish"
    >
      <p>
        We&apos;ve taken your payment but couldn&apos;t finish creating the competition. We&apos;re retrying
        automatically. <strong className="text-foreground">Please don&apos;t pay again.</strong>
      </p>
      <PaymentReference sessionId={state.sessionId} />
    </Shell>
  );
}
