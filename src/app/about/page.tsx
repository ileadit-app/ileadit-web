import Link from "next/link";
import { ArrowRight, Check, Lock, X } from "lucide-react";

/**
 * Positioning on this page is not negotiable — see
 * AndroidStudioProjects/ileadit/RULES.md, sections 1 and 7.1:
 *
 *   "Core Identity: ileadit is a game that requires movement, NOT a fitness
 *   app." / "Players compete on POINTS, not steps. Step counts are NEVER
 *   shown to other players."
 *
 * Every claim below is a direct paraphrase of that document, not an
 * invented pitch. Do not add language that implies step counts are ever
 * visible to anyone but the player themselves, and do not call this a
 * fitness app, tracker, or health app anywhere on this page.
 */

const WHAT_WE_ARE = [
  "A game where walking is the input, not the point of the game",
  '"Inclusive—designed for Mr. and Mrs. Average, not fitness enthusiasts"',
  '"Strategic—winning requires thinking, not just walking"',
  '"Fun first, health benefits are a side effect"',
];

const WHAT_WE_ARE_NOT = [
  '"A step counter or fitness tracker"',
  '"A platform that rewards who walks the most"',
  '"A place where users feel judged for their activity level"',
  '"A data-selling business"',
];

export default function About() {
  return (
    <>
      {/* Header */}
      <section className="relative overflow-hidden bg-brand-navy text-on-navy-foreground">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-pink/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
          <span className="inline-flex items-center rounded-full border border-on-navy-border bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-gold">
            About ileadit
          </span>
          <h1 className="mt-4 max-w-2xl text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
            A game you play by walking. Not a fitness app wearing a costume.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-on-navy-muted sm:text-xl">
            ileadit turns your ordinary, everyday steps into the input for a
            game — one where the office&apos;s least active person has
            exactly the same shot at winning as its most active.
          </p>
        </div>
      </section>

      {/* What we are / what we're not */}
      <section className="bg-background py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">
              Say it plainly
            </p>
            <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              &ldquo;A game that requires movement, NOT a fitness app.&rdquo;
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              That line is the actual, literal definition we build against —
              not marketing copy written after the fact.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Check className="size-5" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-foreground">
                What ileadit is
              </h3>
              <ul className="mt-4 space-y-3" role="list">
                {WHAT_WE_ARE.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
                  >
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-brand-coral/15 text-brand-coral">
                <X className="size-5" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-foreground">
                What ileadit is not
              </h3>
              <ul className="mt-4 space-y-3" role="list">
                {WHAT_WE_ARE_NOT.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
                  >
                    <X
                      className="mt-0.5 size-4 shrink-0 text-brand-coral"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why average wins */}
      <section id="why-average" className="bg-secondary py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">
              Why an ordinary walker can win
            </p>
            <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              You compete against your own average. Never anyone else&apos;s
              steps.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Everyone plays against a personal, self-adjusting rolling
              average — a number that only ever tracks them. Beat 50% of it
              and you keep your lives. Beat 100% of it and the bonus points
              escalate. The office&apos;s biggest walker and its least active
              person are scored on the exact same scale, because it&apos;s
              their own scale.
            </p>
            <Link
              href="/#average"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-bold text-foreground transition-colors hover:bg-muted"
            >
              See the full breakdown
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="bg-background py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">
              Privacy is the whole design, not a policy bolted on
            </p>
            <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Nobody sees your step count. Not rivals, not your employer, not
              us on a dashboard.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              What other players — and, in a workplace competition, what HR
              — ever see is your points and your leaderboard position. The
              raw number of steps behind them is never shown to anyone but
              you.
            </p>
          </div>
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-border bg-card p-5 sm:max-w-2xl">
            <Lock
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Full detail on what we collect and why is on the{" "}
              <Link href="/privacy" className="font-semibold text-foreground underline underline-offset-2">
                privacy policy
              </Link>{" "}
              page.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-navy py-16 text-on-navy-foreground sm:py-20">
        <div className="mx-auto max-w-2xl px-5 text-center sm:px-6">
          <h2 className="text-balance text-2xl font-extrabold tracking-tight sm:text-3xl">
            Ready to find out if you&apos;re a winner?
          </h2>
          <Link
            href="/download"
            className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-gold px-6 text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
          >
            Get the app
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
