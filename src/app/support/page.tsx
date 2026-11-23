import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Support — ileadit",
  description:
    "Need a hand with ileadit? Quick answers about points, lives, syncing your steps, your account, and how to reach us.",
};

/**
 * WEB-SUPPORT-1. Public support page, used as the App Store "Support URL".
 *
 * Positioning is the same as /about: ileadit is a game, not a fitness app,
 * and nothing here may imply anyone but the player can see their step count.
 * Every answer below mirrors something already on /privacy or /terms, or was
 * read from the engine/apps on main; if you change one, check it there first.
 *
 *  - 3 lives at the start of a competition, a life lost on a very quiet day,
 *    out at 0: engine `STARTING_LIVES` and `closeDay/scoring.ts`.
 *  - 7-day warm-up with no life ever lost: engine `config.target.warmupDays`
 *    and `domain/warmup.ts`.
 *  - Permission paths (Health Connect / Apple Health): copied from /privacy.
 *  - Free, coins can't be bought: /terms sections 1 and 7.
 *
 * Reply time ("within 2 working days") is a business commitment from Paul
 * (23 Nov 2026), not something derivable from code.
 */

const SUPPORT_EMAIL = "hello@ileadit.co.uk";

const linkClassName =
  "font-semibold text-foreground underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy";

interface Faq {
  id: string;
  question: string;
  answer: ReactNode;
}

const FAQS: Faq[] = [
  {
    id: "points",
    question: "How do points work?",
    answer: (
      <>
        <p>
          Each day, ileadit compares your steps with your own normal day, not
          with anyone else&apos;s. Your normal adjusts as you play, so
          everyone has a fair chance, whether they walk a lot or a little.
        </p>
        <p>
          Other players see your points, your lives and your place on the
          leaderboard. They never see your steps.
        </p>
      </>
    ),
  },
  {
    id: "lives",
    question: "What are lives?",
    answer: (
      <>
        <p>
          You start each competition with 3 lives. A very quiet day, well
          below your own normal, can cost you one. Lose all three and
          you&apos;re out of that competition.
        </p>
        <p>
          Your first week is a warm-up. You can&apos;t lose a life while
          you&apos;re warming up.
        </p>
      </>
    ),
  },
  {
    id: "syncing",
    question: "My steps aren\u2019t showing",
    answer: (
      <>
        <p>
          ileadit can only count steps your phone has recorded, and only if
          you&apos;ve given it permission to read them. Check that first:
        </p>
        <ul className="list-disc space-y-1 pl-5" role="list">
          <li>
            <strong className="font-semibold text-foreground">Android:</strong>{" "}
            open Health Connect, then App permissions, then ileadit, and allow
            steps.
          </li>
          <li>
            <strong className="font-semibold text-foreground">iPhone:</strong>{" "}
            open Settings, then Health, then Data Access &amp; Devices, then
            ileadit, and allow steps.
          </li>
        </ul>
        <p>
          Then open the app and give it a little while. Steps can take a few
          minutes to appear. If they still aren&apos;t there, email us and
          tell us which phone you have.
        </p>
      </>
    ),
  },
  {
    id: "privacy",
    question: "Who can see my steps?",
    answer: (
      <p>
        Nobody else. Not other players, and not competition organisers.
        They see your points, lives and leaderboard position, never your
        steps. The details are in our{" "}
        <Link href="/privacy" className={linkClassName}>
          privacy policy
        </Link>
        .
      </p>
    ),
  },
  {
    id: "delete",
    question: "How do I delete my account?",
    answer: (
      <p>
        You can do it in the app, under Settings, then Delete account. You
        can also follow the steps on our{" "}
        <Link href="/account-deletion" className={linkClassName}>
          account deletion page
        </Link>
        .
      </p>
    ),
  },
  {
    id: "free",
    question: "Is it free?",
    answer: (
      <p>
        Yes. ileadit is free to play, and joining a competition never costs
        money. Coins are game currency only: you earn them in the game and
        spend them in the game. They can&apos;t be bought and have no cash
        value.
      </p>
    ),
  },
];

export default function Support() {
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
            Support
          </span>
          <h1 className="mt-4 max-w-2xl text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
            Need a hand?
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-on-navy-muted sm:text-xl">
            We&apos;re a small team and we read every message.
          </p>
        </div>
      </section>

      {/* Contact */}
      <section className="bg-background pt-16 sm:pt-20">
        <div className="mx-auto max-w-3xl px-5 sm:px-6">
          <div className="flex items-start gap-4 rounded-3xl border border-border bg-card p-6 sm:p-8">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Mail className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground">Email us</h2>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className={`${linkClassName} break-all`}
                >
                  {SUPPORT_EMAIL}
                </a>
              </p>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                We aim to reply within 2 working days.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section
        aria-labelledby="faq-heading"
        className="bg-background py-16 sm:py-20"
      >
        <div className="mx-auto max-w-3xl px-5 sm:px-6">
          <p className="text-sm font-bold uppercase tracking-wide text-coral-text">
            Quick answers
          </p>
          <h2
            id="faq-heading"
            className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
          >
            Common questions
          </h2>

          <ul className="mt-8 space-y-3" role="list">
            {FAQS.map((faq) => (
              <li key={faq.id}>
                <details className="group rounded-2xl border border-border bg-card">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-3 text-base font-bold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <ChevronDown
                      className="size-5 shrink-0 text-primary transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <div className="space-y-3 px-5 pb-5 text-base leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </div>
                </details>
              </li>
            ))}
          </ul>

          <p className="mt-10 text-base leading-relaxed text-muted-foreground">
            More detail:{" "}
            <Link href="/privacy" className={linkClassName}>
              Privacy policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className={linkClassName}>
              Terms of use
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
