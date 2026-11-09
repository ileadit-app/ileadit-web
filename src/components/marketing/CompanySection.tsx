import { Building2, Globe2 } from "lucide-react";

/**
 * WEB-HONEST-1. This section used to be "Teams & rivalries" (department vs
 * department, company vs company). Team-vs-team competitions do not exist in
 * the app: every competition is a single leaderboard of individual players
 * ranked on points. This section now describes only what exists.
 *
 * The example leaderboard is illustrative (fictional names) and shows points
 * only, never steps.
 */
const EXAMPLE_PLAYERS = [
  { name: "Priya", points: "412 points", place: "1st" },
  { name: "Sam", points: "398 points", place: "2nd" },
  { name: "Marcus", points: "371 points", place: "3rd" },
  { name: "Jordan", points: "340 points", place: "4th" },
];

export function CompanySection() {
  return (
    <section id="companies" className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wide text-coral-text">
            For companies
          </p>
          <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Everyone in the office, on one leaderboard.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Run a private competition for your colleagues. Everyone plays as
            themselves, scored on points against their own average, so the
            keenest walker and the busiest desk-worker start level.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Building2 className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Inside your company
                </p>
                <h3 className="text-lg font-bold text-foreground">
                  Colleagues, ranked on points
                </h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Invite colleagues to a private competition and watch the
              leaderboard move. Organisers see points, lives and leaderboard
              position, never anyone&apos;s step count.
            </p>
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Example leaderboard
            </p>
            <div className="mt-2 space-y-2">
              {EXAMPLE_PLAYERS.map((player) => (
                <div
                  key={player.name}
                  className="flex items-center justify-between rounded-xl bg-muted px-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-extrabold text-coral-text">
                      {player.place}
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {player.name}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground">
                    {player.points}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-brand-navy/20 bg-brand-navy p-6 text-on-navy-foreground sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-brand-gold text-brand-navy">
                <Globe2 className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-on-navy-muted">
                  Or open to anyone
                </p>
                <h3 className="text-lg font-bold text-on-navy-foreground">
                  Public competitions
                </h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-on-navy-muted">
              Not ready to bring the whole company in? Anyone can join a
              public competition from the app and play against people they
              have never met.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
