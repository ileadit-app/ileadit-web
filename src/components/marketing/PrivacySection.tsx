import { EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";

const POINTS = [
  {
    icon: LockKeyhole,
    title: "Step counts stay private",
    body: "Nobody sees another player\u2019s step count. Not a rival, not a manager, not us on a dashboard. Ever.",
  },
  {
    icon: EyeOff,
    title: "Points and rank only",
    body: "What players see about each other is points and leaderboard position — never the raw number behind them.",
  },
  {
    icon: ShieldCheck,
    title: "Built in, not promised",
    body: "This isn't a policy we could quietly change. Individual step data simply never leaves a player's own view.",
  },
];

export function PrivacySection() {
  return (
    <section id="privacy" className="bg-secondary py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">
            Privacy, for employers and everyone else
          </p>
          <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            There&apos;s nothing to leak, because there&apos;s nothing to
            compare.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Since every player runs against their own average, there was
            never a reason to show anyone else&apos;s steps in the first
            place. Employers see participation and engagement across the
            competition — never a single employee&apos;s personal step data.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {POINTS.map((point) => (
            <div
              key={point.title}
              className="rounded-3xl border border-border bg-card p-6"
            >
              <div className="flex size-11 items-center justify-center rounded-2xl bg-brand-navy text-on-navy-foreground">
                <point.icon className="size-5" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-foreground">
                {point.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {point.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
