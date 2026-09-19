import { Footprints, Gauge, TrendingUp, Trophy } from "lucide-react";

const STEPS = [
  {
    icon: Footprints,
    title: "We learn your normal",
    body: "A couple of weeks of walking however you already walk sets your personal rolling average. No targets, no minimums, no judgement.",
  },
  {
    icon: Gauge,
    title: "Beat it, score it",
    body: "Hit 75%, 100%, or over 100% of your own average and the points climb. Drop below half your average and you lose a life.",
  },
  {
    icon: TrendingUp,
    title: "The bar moves with you",
    body: "Every great day nudges your average up a little. Beat it again tomorrow and it climbs again — the game keeps pace with you, not the other way round.",
  },
  {
    icon: Trophy,
    title: "Play for something",
    body: "Climb team leaderboards, take on rivals, or join public competitions that anyone, anywhere, can enter.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">
            How it works
          </p>
          <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Four steps. Zero targets to fail.
          </h2>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="relative rounded-3xl border border-border bg-card p-6"
            >
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <step.icon className="size-5" aria-hidden="true" />
              </div>
              <p className="mt-5 text-xs font-bold text-muted-foreground">
                Step {i + 1}
              </p>
              <h3 className="mt-1 text-lg font-bold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
