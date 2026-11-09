import Link from "next/link";
import { EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";

const POINTS = [
  {
    icon: LockKeyhole,
    title: "Step counts stay private",
    body: "Other players and competition organisers never see your step count. Not a rival, not a manager.",
  },
  {
    icon: EyeOff,
    title: "Points and rank only",
    body: "What players see about each other is points and leaderboard position — never the raw number behind them.",
  },
  {
    icon: ShieldCheck,
    title: "What we do with your steps",
    body: "Your phone sends us your daily step total so the game can score it. We don’t sell it or share it with advertisers or data brokers, and the daily records are deleted automatically 30 days after the day, or 30 days after the end of a competition that day counted towards, whichever is later.",
  },
];

export function PrivacySection() {
  return (
    <section id="privacy" className="bg-secondary py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wide text-coral-text">
            Privacy, for employers and everyone else
          </p>
          <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Rivals see your points. Never your steps.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Since every player runs against their own average, there was
            never a reason to show anyone else&apos;s steps in the first
            place. Organisers see points, lives and leaderboard position —
            never anyone&apos;s step count.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            The full detail is in our{" "}
            <Link
              href="/privacy"
              className="font-semibold text-foreground underline underline-offset-2"
            >
              privacy policy
            </Link>
            .
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
