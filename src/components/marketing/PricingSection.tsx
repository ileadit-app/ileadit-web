import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

// WEB-HONEST-1: this section used to promise per-player pricing, "unlimited
// teams and department rivalries" and a quote. None of that is real yet:
// January is free, there are no paid plans, and team competitions do not
// exist. Only list things that are true today.
const INCLUDED = [
  "Free to run in January",
  "Up to 3 pilot competitions",
  "Private competitions for your colleagues",
  "Organisers see points, never step counts",
];

export function PricingSection() {
  return (
    <section id="pricing" className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="rounded-3xl border border-border bg-card p-8 sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-coral-text">
                Pricing
              </p>
              <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Free company pilots in January.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                We&apos;re running up to 3 free pilot competitions with
                companies in January. Tell us about yours and we&apos;ll get
                in touch.
              </p>
              <ul className="mt-6 space-y-3" role="list">
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
                Tell us a little about your company and we&apos;ll get back to
                you about a pilot.
              </p>
              <Link
                href="mailto:hello@ileadit.co.uk"
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
