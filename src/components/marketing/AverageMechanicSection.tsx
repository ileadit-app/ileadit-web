import { Heart, Sparkles } from "lucide-react";

const TIERS = [
  {
    label: "Under 50%",
    detail: "of your own average",
    result: "Lose a life",
    tone: "coral" as const,
  },
  {
    label: "75%",
    detail: "of your own average",
    result: "Small bonus",
    tone: "muted" as const,
  },
  {
    label: "100%",
    detail: "of your own average",
    result: "Solid bonus",
    tone: "gold" as const,
  },
  {
    label: "Over 100%",
    detail: "of your own average",
    result: "Big bonus",
    tone: "goldStrong" as const,
  },
];

const TONE_CLASSES: Record<string, string> = {
  coral: "border-brand-coral/30 bg-brand-coral/10 text-brand-coral",
  muted: "border-border bg-muted text-foreground",
  gold: "border-brand-gold/40 bg-brand-gold/15 text-brand-navy",
  goldStrong: "border-brand-gold bg-brand-gold text-brand-navy",
};

export function AverageMechanicSection() {
  return (
    <section id="average" className="bg-secondary py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">
            Why an ordinary walker can win
          </p>
          <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Nobody is measured against anyone else&apos;s steps. Ever.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Every player is scored against their own rolling average — a
            number that only tracks them. So the office&apos;s most active
            walker and its most sedentary have identical odds of winning
            today.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Same day, two players
            </p>
            <div className="mt-5 space-y-4">
              <ComparisonRow name="Sam" avg="2,400" today="2,650" percent={110} />
              <ComparisonRow name="Jordan" avg="14,800" today="16,280" percent={110} />
            </div>
            <div className="mt-5 flex items-center gap-2 rounded-2xl bg-brand-gold/15 px-4 py-3 text-sm font-bold text-brand-navy">
              <Sparkles className="size-4 shrink-0" aria-hidden="true" />
              Same 110%. Same bonus. Different lives, same game.
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              What your percentage earns you
            </p>
            <div className="mt-5 space-y-3">
              {TIERS.map((tier) => (
                <div
                  key={tier.label}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${TONE_CLASSES[tier.tone]}`}
                >
                  <div>
                    <p className="text-sm font-extrabold">{tier.label}</p>
                    <p className="text-xs opacity-80">{tier.detail}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-bold">
                    {tier.tone === "coral" && (
                      <Heart className="size-4" aria-hidden="true" />
                    )}
                    {tier.result}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              And the average is self-adjusting: keep beating it and the bar
              climbs with you, so yesterday&apos;s best effort becomes
              today&apos;s new normal.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ComparisonRow({
  name,
  avg,
  today,
  percent,
}: {
  name: string;
  avg: string;
  today: string;
  percent: number;
}) {
  return (
    <div className="rounded-2xl bg-muted p-4">
      <div className="flex items-center justify-between">
        <p className="font-bold text-foreground">{name}</p>
        <span className="rounded-full bg-brand-navy px-3 py-1 text-xs font-extrabold text-on-navy-foreground">
          {percent}% of own average
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>
          Rolling average: <strong className="text-foreground">{avg}</strong>{" "}
          steps
        </span>
        <span>
          Today: <strong className="text-foreground">{today}</strong> steps
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-brand-gold"
          style={{ width: `${Math.min(percent, 130) / 1.3}%` }}
        />
      </div>
    </div>
  );
}
