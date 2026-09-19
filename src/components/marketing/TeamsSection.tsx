import { Building2, Globe2 } from "lucide-react";

const DEPARTMENTS = [
  { name: "Marketing", points: "18,240 pts", place: "1st" },
  { name: "Sales", points: "17,960 pts", place: "2nd" },
  { name: "Finance", points: "15,110 pts", place: "3rd" },
  { name: "Engineering", points: "14,730 pts", place: "4th" },
];

export function TeamsSection() {
  return (
    <section id="teams" className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">
            Teams &amp; rivalries
          </p>
          <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Marketing vs Sales. Or Marketing vs the World.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Every competition works the same way, whichever players you put
            in it. Run it inside your walls, or open it up and let your
            company take on someone else&apos;s.
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
                  Inside your walls
                </p>
                <h3 className="text-lg font-bold text-foreground">
                  Department vs department
                </h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Pit Marketing against Sales against Finance. Every team&apos;s
              score is built from players beating their own averages — so a
              department full of casual walkers competes just as hard as one
              full of marathoners.
            </p>
            <div className="mt-5 space-y-2">
              {DEPARTMENTS.map((dept) => (
                <div
                  key={dept.name}
                  className="flex items-center justify-between rounded-xl bg-muted px-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-extrabold text-brand-coral">
                      {dept.place}
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {dept.name}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground">
                    {dept.points}
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
                  Open to the world
                </p>
                <h3 className="text-lg font-bold text-on-navy-foreground">
                  Your company vs theirs
                </h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-on-navy-muted">
              A competition is just players, however they&apos;re grouped.
              That means your team can go head-to-head with another
              company&apos;s team, or join a public competition open to
              anyone who wants in. Beating a rival firm is a better story
              than beating Karen in Accounts.
            </p>
            <div className="mt-5 rounded-2xl bg-white/10 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-gold">
                Live rivalry
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-base font-extrabold text-on-navy-foreground">
                  ileadit HQ
                </span>
                <span className="text-xs font-bold text-on-navy-muted">vs</span>
                <span className="text-base font-extrabold text-on-navy-foreground">
                  Northwind Co.
                </span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/15">
                <div className="h-full w-[58%] rounded-full bg-brand-gold" />
              </div>
              <p className="mt-2 text-xs font-semibold text-on-navy-muted">
                ileadit HQ leads by 340 pts, day 4 of 7
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
