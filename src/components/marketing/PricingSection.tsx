import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

const INCLUDED = [
  "Unlimited teams and department rivalries",
  "Public and private competitions",
  "iOS and Android apps for every player",
  "Employer view of participation, never step data",
];

export function PricingSection() {
  return (
    <section id="pricing" className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="rounded-3xl border border-border bg-card p-8 sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">
                Pricing
              </p>
              <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Simple, per-player pricing that scales with your team.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                No tiers to puzzle over on this page — just tell us the size
                of your team and we&apos;ll get you a straight quote.
              </p>
              <ul className="mt-6 space-y-3">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-brand-gold"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium text-foreground">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div
              id="employer"
              className="rounded-2xl bg-brand-navy p-6 text-on-navy-foreground sm:p-8"
            >
              <h3 className="text-xl font-bold text-on-navy-foreground">
                Are your employees average winners?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-on-navy-muted">
                Tell us a little about your team and we&apos;ll get back with
                a quote and a walkthrough.
              </p>
              <Link
                href="mailto:hello@ileadit.app"
                className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-gold text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
              >
                Talk to us
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
