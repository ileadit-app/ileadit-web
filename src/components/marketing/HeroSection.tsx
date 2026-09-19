import Link from "next/link";
import { ArrowRight, Lock, PlayCircle } from "lucide-react";

/**
 * The approved primary headline (design spec, "are you an average winner?"
 * direction). The spec's v0 draft cycled all four candidates automatically
 * client-side; per Paul's brief for this build we ship ONE static, crawlable
 * headline and leave the rest here as swap-in candidates — change
 * PRIMARY_HEADLINE below to try another without touching markup.
 *
 * Alternative candidates from the approved spec:
 * - "Average is the whole point."
 * - "The most average person in the office could win this."
 * - "Beat your own average. Not everyone else's steps."
 */
const PRIMARY_HEADLINE = "Are you an average winner?";

export function HeroSection() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-brand-navy text-on-navy-foreground"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-pink/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 left-[-10%] h-96 w-96 rounded-full bg-brand-gold/15 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-5 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:flex-row lg:items-center lg:gap-16 lg:pb-28 lg:pt-24">
        <div className="max-w-2xl">
          <span className="inline-flex items-center rounded-full border border-on-navy-border bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-gold">
            A step-count game, not a fitness plan
          </span>

          <h1 className="mt-4 text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            {PRIMARY_HEADLINE}
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-on-navy-muted sm:text-xl">
            You&apos;re never scored against anyone else&apos;s step count —
            only your own rolling average. Walk more than usual and you
            climb. That means the fittest person in the office and the least
            active have exactly the same shot at winning.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/#employer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-gold px-6 text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
            >
              Bring it to your team
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-on-navy-border bg-transparent px-6 text-base font-bold text-on-navy-foreground transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <PlayCircle className="size-4" aria-hidden="true" />
              See how it works
            </Link>
          </div>

          <div className="mt-6 flex items-center gap-2 text-sm font-medium text-on-navy-muted">
            <Lock className="size-4 shrink-0 text-brand-gold" aria-hidden="true" />
            Your step count is private. Always. Only you ever see the number.
          </div>
        </div>

        <AverageWinnerCard />
      </div>
    </section>
  );
}

function AverageWinnerCard() {
  return (
    <div className="relative mx-auto w-full max-w-sm shrink-0 lg:mx-0">
      <div className="rounded-3xl border border-on-navy-border bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-gold">
          Today&apos;s scoreboard
        </p>
        <div className="mt-4 space-y-3">
          <PlayerRow
            name="Priya"
            note="ordinary walker"
            percent={112}
            points="+40 pts"
            highlight
          />
          <PlayerRow
            name="Deepak"
            note="office \u2018fitness person\u2019"
            percent={104}
            points="+40 pts"
          />
          <PlayerRow name="Marcus" note="new starter" percent={68} points="+10 pts" />
        </div>
        <p className="mt-5 text-sm leading-relaxed text-on-navy-muted">
          Priya and Deepak walked wildly different distances today. Same
          percentage over their own average, same points. That&apos;s the
          whole game.
        </p>
      </div>
    </div>
  );
}

function PlayerRow({
  name,
  note,
  percent,
  points,
  highlight,
}: {
  name: string;
  note: string;
  percent: number;
  points: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
        highlight ? "bg-brand-gold/15" : "bg-white/5"
      }`}
    >
      <div>
        <p className="text-sm font-bold text-on-navy-foreground">{name}</p>
        <p className="text-xs text-on-navy-muted">{note}</p>
      </div>
      <div className="text-right">
        <p
          className={`text-sm font-extrabold ${
            highlight ? "text-brand-gold" : "text-on-navy-foreground"
          }`}
        >
          {percent}% of avg
        </p>
        <p className="text-xs font-semibold text-brand-coral">{points}</p>
      </div>
    </div>
  );
}
