import type { ReactNode } from "react";
import {
  COIN_REASON_TOKENS,
  EARNED_REASONS,
  MIN_CHART_DAYS,
  PERCENT_MIN_DENOMINATOR,
  REASON_LABELS,
  RETENTION_TREND_MIN_COHORTS,
  SMALL_COMPETITION_MEMBERS,
  SPENT_REASONS,
  challengeKinds,
  coinTotals,
  firstD30Date,
  fmtCount,
  fmtDate,
  fmtDateTimeUtc,
  fmtDayMonth,
  fmtOne,
  funnel,
  hasAnyD30,
  isShortSeries,
  knownRunStatus,
  ofText,
  partialDays,
  retentionRows,
  retentionTrend,
  stickiness,
  trailingAverage,
  weekdayShort,
  type CompetitionsTable,
  type ReadyModel,
  type RetentionCell,
  type UsageDay,
  type UsageModel,
  type UsageRun,
} from "@/lib/usageMetrics";
import { HBar, Legend, LineChart, StackedBars, TwoSidedBars, UsageSvgDefs, type LegendItem } from "./UsageCharts";

/**
 * The visible content of /admin/usage. Pure presentation: it takes a finished
 * view model (`buildModel` in src/lib/usageMetrics.ts) and renders it. It makes
 * no request and holds no state, so every empty state, marker and meaning is
 * tested by rendering it with fixture models.
 *
 * Port of the old admin viewer's usage-render.js; the strings are the same.
 */

const CARD = "rounded-3xl border border-border bg-card p-5 sm:p-6";
const H2 = "text-xl font-bold text-foreground";
const H3 = "mt-6 text-base font-bold text-foreground";
const SUB = "mt-1 text-sm leading-relaxed text-muted-foreground";
const EMPTY = "mt-3 text-sm text-muted-foreground";
const TH = "px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground";
const THN = `${TH} text-right`;
const TD = "px-3 py-2 text-sm text-foreground";
const TDN = `${TD} text-right tabular-nums`;

function Section({ id, title, sub, children }: { id: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={CARD}>
      <h2 id={`${id}-h`} className={H2}>
        {title}
      </h2>
      {sub ? <p className={SUB}>{sub}</p> : null}
      {children}
    </section>
  );
}

function TileBox({ label, value, context, tile }: { label: string; value: string; context?: string; tile?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4" data-tile={tile}>
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums text-brand-navy">{value}</p>
      {context ? <p className="mt-1 text-sm text-muted-foreground">{context}</p> : null}
    </div>
  );
}

/** Fewer than 7 recorded days: "Mon 3 · Tue 4 · Wed 3". */
function DayValues({ rows, valueText }: { rows: UsageDay[]; valueText: (row: UsageDay) => string }) {
  return (
    <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-sm text-foreground" data-testid="day-values">
      {rows.map((r, i) => (
        <span key={r.date}>
          {i > 0 ? <span aria-hidden="true">· </span> : null}
          {`${weekdayShort(r.date)} ${Number(r.date.slice(8))} `}
          <strong>{valueText(r)}</strong>
          {r.final ? null : <span className="text-muted-foreground"> (provisional)</span>}
        </span>
      ))}
    </p>
  );
}

function ShortNote() {
  return (
    <p className={SUB}>{`Fewer than ${MIN_CHART_DAYS} days of data, so the days are listed instead of charted.`}</p>
  );
}

function dateRangeText(rows: UsageDay[]): string {
  if (rows.length === 0) return "";
  return rows.length === 1
    ? fmtDate(rows[0].date)
    : `${fmtDayMonth(rows[0].date)} to ${fmtDate(rows[rows.length - 1].date)}`;
}

function Figure({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="mt-4">
      <figcaption className="text-sm font-semibold text-foreground">{caption}</figcaption>
      {children}
    </figure>
  );
}

function LineKey({ cls, label }: { cls: "solid" | "dash" | "avg"; label: string }) {
  const stroke = cls === "avg" ? "var(--usage-cat-2)" : "var(--usage-cat-1)";
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={22} height={8} aria-hidden="true">
        <line
          x1={0}
          x2={22}
          y1={4}
          y2={4}
          stroke={stroke}
          strokeWidth={2}
          strokeDasharray={cls === "dash" ? "4 3" : undefined}
        />
      </svg>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Header parts
// ---------------------------------------------------------------------------

export function UsageMeta({ model }: { model: UsageModel }) {
  if (model.state === "empty") return null;
  const n = model.newest;
  const ex = n.excluded;
  const excluded =
    ex.demo + ex.listed + ex.robots === 0
      ? "No accounts are excluded."
      : `Excluded accounts: ${fmtCount(ex.demo)} demo, ${fmtCount(ex.listed)} listed, ${fmtCount(ex.robots)} robots.`;
  return (
    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
      {`Data to ${fmtDate(n.date)}. Yesterday is provisional until every time zone has closed it. `}
      {excluded}
    </p>
  );
}

function runWhen(run: UsageRun): string {
  return fmtDateTimeUtc(run.finishedAt ?? run.failedAt ?? run.startedAt);
}

/**
 * The last run, in one line: when and whether it succeeded. The job runs
 * hourly, so this is not "nightly". The status is shown only when it is one
 * the page knows (ok / failed / running); anything else reads "unknown".
 */
export function UsageLastRun({ run }: { run: UsageRun | null }) {
  if (run === null || run.status === "failed") return null;
  const when = runWhen(run);
  const state = knownRunStatus(run.status) ?? "unknown";
  return (
    <p className="mt-1 text-sm text-muted-foreground" data-testid="last-run">
      {`Last run: ${state}${when ? ` at ${when}` : ""}.`}
    </p>
  );
}

/**
 * Shown when the latest run is recorded as failed. Stage and error code are the
 * short fixed identifiers the engine writes (kept only when they look like one
 * by `normalizeRun`); errorMessage and the run id are never read.
 */
export function UsageBanner({ model }: { model: UsageModel }) {
  if (!model.failed) return null;
  // Only a run recorded as failed has a stage, code and time worth showing. The
  // banner can also come from the alert document alone (run write failed).
  const run = model.lastRun?.status === "failed" ? model.lastRun : null;
  const stage = run?.stage ?? null;
  const errorCode = run?.errorCode ?? null;
  const detail = [stage ? `Stage: ${stage}.` : null, errorCode ? `Error code: ${errorCode}.` : null]
    .filter(Boolean)
    .join(" ");
  const good = model.newest ? fmtDate(model.newest.date) : null;
  const at = run ? fmtDateTimeUtc(run.failedAt ?? run.startedAt) : "";
  return (
    <div
      role="alert"
      className="break-words rounded-2xl border border-accent bg-accent/15 p-4 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]"
    >
      <strong>The nightly job failed</strong>
      {at ? ` at ${at}.` : "."}
      {detail ? ` ${detail}` : null}
      {good ? ` The last good snapshot is for ${good}; the page shows what it has.` : " There is no snapshot to show yet."}
    </div>
  );
}

export function UsageEmpty({ model }: { model: UsageModel }) {
  const run = model.lastRun;
  const last = run ? fmtDateTimeUtc(run.finishedAt ?? run.failedAt ?? run.startedAt) : "";
  return (
    <section id="no-data" className={CARD}>
      <h2 className={H2}>No data yet</h2>
      <p className={EMPTY}>The nightly job has not run yet.</p>
      {last ? <p className={SUB}>{`Its last recorded run was ${last}.`}</p> : null}
    </section>
  );
}

function Tiles({ model }: { model: ReadyModel }) {
  return (
    <section aria-label="Headline numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {model.tiles.map((t) => (
        <TileBox
          key={t.key}
          tile={t.key}
          label={t.label}
          value={t.value === null ? "-" : fmtCount(t.value)}
          context={t.context}
        />
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function Activity({ model }: { model: ReadyModel }) {
  const { rows, all } = model;
  const range = dateRangeText(rows);
  const stick = stickiness(all);
  let body: ReactNode;
  if (isShortSeries(rows)) {
    body = (
      <>
        <ShortNote />
        <DayValues rows={rows} valueText={(r) => `${fmtCount(r.dau)} active`} />
        <p className={SUB}>New and returning: </p>
        <DayValues
          rows={rows}
          valueText={(r) => `${fmtCount(r.newActive)} new, ${fmtCount(r.returning)} returning`}
        />
      </>
    );
  } else {
    const avg = trailingAverage(rows);
    body = (
      <div className="mt-2 grid gap-6 lg:grid-cols-2">
        <Figure caption="Daily active players">
          <LineChart
            rows={rows}
            label={`Daily active players, ${range}.`}
            series={[
              {
                name: "active players",
                singular: "active player",
                cls: "line-main",
                points: rows.map((r) => ({ date: r.date, value: r.dau, provisional: !r.final })),
              },
              ...(avg.length > 0
                ? [
                    {
                      name: "7-day average",
                      cls: "line-avg",
                      points: avg.map((a) => ({ date: a.date, value: a.value, provisional: false })),
                    },
                  ]
                : []),
            ]}
          />
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <LineKey cls="solid" label="Active players" />
            <LineKey cls="dash" label="provisional day" />
            {avg.length > 0 ? <LineKey cls="avg" label="7-day average" /> : null}
          </p>
        </Figure>
        <Figure caption="New and returning">
          <StackedBars
            rows={rows}
            label={`New and returning active players per day, ${range}.`}
            keys={[
              { key: "newActive", label: "new", cat: 4 },
              { key: "returning", label: "returning", cat: 1 },
            ]}
            value={(r, k) => (k === "newActive" ? r.newActive : r.returning)}
          />
          <Legend
            items={[
              { cat: 4, label: "New (signed up that day)" },
              { cat: 1, label: "Returning" },
            ]}
          />
        </Figure>
      </div>
    );
  }
  return (
    <Section
      id="activity"
      title="Activity"
      sub="A player counts as active on a day when the engine accepted at least one step sync for that game day. A background sync counts."
    >
      {body}
      <p className="mt-4 text-sm text-foreground">
        {stick.meanDau === null
          ? stick.reason
          : `Average daily active over 28 days: ${fmtOne(stick.meanDau)}. Active in 28 days: ${fmtCount(stick.mau)}. ${
              stick.ratio === null ? stick.reason : `Stickiness: ${Math.round(stick.ratio * 100)}%.`
            }`}
      </p>
    </Section>
  );
}

function Signups({ model }: { model: ReadyModel }) {
  const { rows } = model;
  const f = funnel(rows);
  return (
    <Section id="signups" title="Sign-ups and funnel">
      {isShortSeries(rows) ? (
        <>
          <ShortNote />
          <DayValues rows={rows} valueText={(r) => `${fmtCount(r.signups)} new`} />
        </>
      ) : (
        <Figure caption="Sign-ups per day">
          <StackedBars
            rows={rows}
            label={`New sign-ups per day, ${dateRangeText(rows)}.`}
            keys={[{ key: "signups", label: "sign-ups", singular: "sign-up", cat: 1 }]}
            value={(r) => r.signups}
          />
        </Figure>
      )}
      <h3 className={H3}>First-week funnel</h3>
      {f.created === 0 ? (
        <p className={EMPTY}>No sign-up cohorts have reached their seventh day in this range.</p>
      ) : (
        <>
          <p className={SUB}>
            {`${fmtCount(f.cohorts)} daily cohorts, each followed for the 7 days after sign-up. Provisional days are left out.`}
          </p>
          <ol className="mt-3 space-y-3">
            {f.steps.map((s) => (
              <li key={s.key} className="grid gap-1 sm:grid-cols-[14rem_1fr_9rem] sm:items-center sm:gap-3">
                <span className="text-sm text-foreground">{s.label}</span>
                <HBar share={f.created === 0 ? 0 : s.value / f.created} />
                <span className="text-sm tabular-nums text-muted-foreground sm:text-right">
                  {ofText(s.value, f.created, "")}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </Section>
  );
}

function RetentionTd({ c }: { c: RetentionCell }) {
  if (c.state !== "ok") {
    return (
      <td className={`${TDN} text-muted-foreground`} aria-label="not yet">
        -
      </td>
    );
  }
  const share = c.of > 0 ? c.k / c.of : 0;
  return (
    <td
      className={`${TDN}${c.provisional ? " italic" : ""}`}
      style={{ background: `color-mix(in srgb, var(--usage-cat-1) ${Math.round(share * 35)}%, transparent)` }}
      title={
        c.partial
          ? "Some days in this row have not reached this age yet."
          : c.provisional
            ? "Includes a provisional day."
            : undefined
      }
      data-provisional={c.provisional ? "true" : undefined}
    >
      {ofText(c.k, c.of, "")}
      {c.partial ? <span> *</span> : null}
      {c.provisional ? <span className="sr-only"> (provisional)</span> : null}
    </td>
  );
}

function Retention({ model }: { model: ReadyModel }) {
  const { all, rows, range } = model;
  const table = retentionRows(all, rows, range);
  const nonEmpty = table.some((r) => r.size > 0);
  const trend = retentionTrend(all);
  return (
    <Section id="retention" title="Retention">
      {!nonEmpty ? (
        <p className={EMPTY}>No players signed up in this range, so there are no cohorts to follow.</p>
      ) : (
        <>
          <div className="relative mt-3 overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse">
              <caption className="sr-only">Retention by sign-up cohort</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className={TH}>
                    {range === "7" ? "Signed up" : "Cohort"}
                  </th>
                  <th scope="col" className={THN}>
                    Size
                  </th>
                  {["Day 1", "Day 7", "Day 14", "Day 30"].map((l) => (
                    <th key={l} scope="col" className={THN}>
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.map((r) => (
                  <tr key={r.key} className="border-b border-border last:border-0">
                    <th scope="row" className={`${TD} text-left font-semibold`}>
                      {r.label}
                    </th>
                    <td className={TDN}>{fmtCount(r.size)}</td>
                    {r.cells.map((c) => (
                      <RetentionTd key={c.n} c={c} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={SUB}>
            Each cell is the players of that cohort who were active exactly that many days after signing up. A dash
            means that age has not been reached yet. * means some days in the row have not reached it.
          </p>
        </>
      )}
      {!hasAnyD30(table) ? (
        <p className="mt-3 text-sm text-foreground">
          {`Day 30 retention needs 31 days of history. First value on ${fmtDate(firstD30Date(all))}.`}
        </p>
      ) : null}
      {trend.enough ? (
        <Figure caption="Day 1 and Day 7 retention by sign-up day (%)">
          <LineChart
            rows={trend.points.map((p) => ({ date: p.date }))}
            label="Day 1 and Day 7 retention by sign-up day, in percent."
            series={[
              {
                name: "% active on day 1",
                cls: "line-main",
                points: trend.points.map((p) => ({ date: p.date, value: Math.round(p.d1 * 100), provisional: false })),
              },
              {
                name: "% active on day 7",
                cls: "line-avg",
                points: trend.points
                  .filter((p) => p.d7 !== null)
                  .map((p) => ({ date: p.date, value: Math.round((p.d7 as number) * 100), provisional: false })),
              },
            ]}
          />
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <LineKey cls="solid" label="Day 1" />
            <LineKey cls="avg" label="Day 7" />
          </p>
        </Figure>
      ) : (
        <p className="mt-3 text-sm text-foreground">
          {`The retention trend needs ${RETENTION_TREND_MIN_COHORTS} cohorts and at least ${PERCENT_MIN_DENOMINATOR} sign-ups. It is hidden until then.`}
        </p>
      )}
    </Section>
  );
}

function Lapsed({ model }: { model: ReadyModel }) {
  const n = model.newest;
  const atRisk = Math.max(0, n.mau - n.wau);
  return (
    <Section id="lapsed" title="Lapsed">
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <TileBox label="At risk" value={fmtCount(atRisk)} context="Active in 28 days, quiet for 7" />
        <TileBox label="Lapsed" value={fmtCount(n.lapsed)} context="Quiet for over 28 days" />
        <TileBox
          label="Came back this week"
          value={n.resurrected === null ? "-" : fmtCount(n.resurrected)}
          context={n.resurrected === null ? "Not recorded by the nightly job yet" : "Active again after a quiet week"}
        />
      </div>
    </Section>
  );
}

/**
 * The per-competition table of the newest day. Counts only. Competitions under
 * SMALL_COMPETITION_MEMBERS members arrive as one folded last row and are never
 * named here.
 */
export function CompetitionTable({ date, table }: { date: string; table: CompetitionsTable | null }) {
  if (table === null) {
    return <p className={EMPTY}>This day has no per-competition table. Days recorded before it was added do not.</p>;
  }
  if (table.list.length === 0 && table.small === null) {
    return <p className={EMPTY}>No competition was live or finished on this day.</p>;
  }
  const status = (s: string) => (s === "finished" ? "Finished" : "Live");
  return (
    <>
      <p className={SUB}>{`On ${fmtDate(date)}: competitions that were live or finished that day.`}</p>
      <div className="relative mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse" data-testid="by-competition">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={TH}>
                Competition
              </th>
              <th scope="col" className={TH}>
                Status
              </th>
              {["Members", "Active", "Eliminated", "Joined by invite"].map((l) => (
                <th key={l} scope="col" className={THN}>
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.list.map((c, i) => (
              <tr key={`${c.id}-${i}`} className="border-b border-border last:border-0">
                <th scope="row" className={`${TD} text-left font-semibold`}>
                  {c.name === null ? "Unnamed competition" : c.name}
                </th>
                <td className={TD}>{status(c.status)}</td>
                <td className={TDN}>{fmtCount(c.members)}</td>
                <td className={TDN}>{fmtCount(c.active)}</td>
                <td className={TDN}>{fmtCount(c.eliminated)}</td>
                <td className={TDN}>{fmtCount(c.joinedViaInvite)}</td>
              </tr>
            ))}
            {table.small !== null ? (
              <tr className="bg-secondary/60" data-testid="small-row">
                <th scope="row" className={`${TD} text-left font-semibold`}>
                  {`${fmtCount(table.small.competitions)} small ${
                    table.small.competitions === 1 ? "competition" : "competitions"
                  } (under ${SMALL_COMPETITION_MEMBERS} members)`}
                </th>
                <td className={TD}>-</td>
                <td className={TDN}>{fmtCount(table.small.members)}</td>
                <td className={TDN}>{fmtCount(table.small.active)}</td>
                <td className={TDN}>{fmtCount(table.small.eliminated)}</td>
                <td className={TDN}>{fmtCount(table.small.joinedViaInvite)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className={SUB}>
        Active is that day. Eliminated is the total so far. Members are those still in the competition.
      </p>
    </>
  );
}

function Competitions({ model }: { model: ReadyModel }) {
  const { rows, newest } = model;
  const c = newest.competitions;
  const joinTotal = rows.reduce((s, r) => s + r.competitions.joins, 0);
  const fin = rows.filter((r) => r.competitions.finalised > 0);
  return (
    <Section id="competitions" title="Competitions">
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <TileBox label="Scheduled" value={fmtCount(c.scheduled)} />
        <TileBox label="Live" value={fmtCount(c.live)} context={`${fmtCount(c.membersLive)} members`} />
        <TileBox label="Finished" value={fmtCount(c.finishedTotal)} />
      </div>

      <h3 className={H3}>Joins per day</h3>
      {joinTotal === 0 ? (
        <p className={EMPTY}>Nobody joined a competition in this range.</p>
      ) : isShortSeries(rows) ? (
        <>
          <ShortNote />
          <DayValues rows={rows} valueText={(r) => `${fmtCount(r.competitions.joins)} joined`} />
        </>
      ) : (
        <figure className="mt-3">
          <StackedBars
            rows={rows}
            label={`Competition joins per day, split by invite link and public list, ${dateRangeText(rows)}.`}
            keys={[
              { key: "invite", label: "joined by invite link", cat: 4 },
              { key: "list", label: "joined from the public list", cat: 1 },
            ]}
            value={(r, k) =>
              k === "invite" ? r.competitions.joinsViaInvite : Math.max(0, r.competitions.joins - r.competitions.joinsViaInvite)
            }
          />
          <Legend
            items={[
              { cat: 4, label: "Invite link" },
              { cat: 1, label: "Public list" },
            ]}
          />
        </figure>
      )}

      <h3 className={H3}>By competition</h3>
      <CompetitionTable date={newest.date} table={newest.competitionsTable} />

      <h3 className={H3}>Competitions that finished</h3>
      {fin.length === 0 ? (
        <p className={EMPTY}>No competitions have finished in this range.</p>
      ) : (
        <>
          <div className="relative mt-3 overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className={TH}>
                    Day
                  </th>
                  {["Finished", "Members", "Survived", "Eliminated"].map((l) => (
                    <th key={l} scope="col" className={THN}>
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fin.map((r) => (
                  <tr key={r.date} className="border-b border-border last:border-0">
                    <th scope="row" className={`${TD} text-left font-semibold`}>
                      {fmtDate(r.date)}
                    </th>
                    <td className={TDN}>{fmtCount(r.competitions.finalised)}</td>
                    <td className={TDN}>{fmtCount(r.competitions.finishedMembers)}</td>
                    <td className={TDN}>{fmtCount(r.competitions.finishers)}</td>
                    <td className={TDN}>
                      {fmtCount(Math.max(0, r.competitions.finishedMembers - r.competitions.finishers))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={SUB}>Totals per day, not per competition. Players who left before the end are not counted.</p>
        </>
      )}
    </Section>
  );
}

function Challenges({ model }: { model: ReadyModel }) {
  const kinds = challengeKinds(model.rows, model.newest);
  const max = Math.max(1, ...kinds.map((k) => k.total));
  const toolKinds = kinds.filter((k) => k.tool);
  const allToolsOff = toolKinds.length > 0 && toolKinds.every((k) => k.off && k.total === 0);
  const shown = kinds.filter((k) => !k.tool || !allToolsOff);
  const nothing = kinds.every((k) => k.total === 0) && !kinds.some((k) => k.off);
  return (
    <Section id="challenges" title="Challenges and tools" sub="Created in the selected range.">
      {nothing ? (
        <p className={EMPTY}>No challenges or tools were used in this range.</p>
      ) : (
        <>
          <ul className="mt-3 space-y-3">
            {shown.map((k) => (
              <li key={k.key} className="grid gap-1 sm:grid-cols-[16rem_1fr_4rem] sm:items-center sm:gap-3">
                <span className="text-sm text-foreground">
                  {k.label}
                  {k.off ? (
                    <span className="ml-2 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                      Off
                    </span>
                  ) : null}
                </span>
                <HBar share={k.total / max} cat={k.tool ? 4 : 1} hatched={k.tool} />
                <span className="text-sm font-semibold tabular-nums text-foreground sm:text-right">
                  {fmtCount(k.total)}
                </span>
              </li>
            ))}
          </ul>
          {allToolsOff ? (
            <p className={EMPTY}>Tools are switched off, so there is nothing to show.</p>
          ) : kinds.some((k) => k.off) ? (
            <p className={SUB}>
              Off means the tool is switched off in the game config, so a zero is not a lack of interest.
            </p>
          ) : null}
        </>
      )}
    </Section>
  );
}

function Coins({ model }: { model: ReadyModel }) {
  const { rows, newest } = model;
  const totals = coinTotals(rows);
  const earnedSum = Object.values(totals.earned).reduce((s, v) => s + v, 0);
  const spentSum = Object.values(totals.spent).reduce((s, v) => s + v, 0);
  const items: LegendItem[] = [];
  for (const k of EARNED_REASONS) {
    if (totals.earned[k] > 0) {
      items.push({
        cat: COIN_REASON_TOKENS.earned[k],
        solid: true,
        label: `Earned: ${REASON_LABELS[k]}`,
        note: fmtCount(totals.earned[k]),
      });
    }
  }
  for (const k of SPENT_REASONS) {
    if (totals.spent[k] > 0) {
      items.push({
        cat: COIN_REASON_TOKENS.spent[k],
        solid: true,
        label: `Spent: ${REASON_LABELS[k]}`,
        note: fmtCount(totals.spent[k]),
      });
    }
  }
  const late = partialDays(rows);
  const sumOf = (o: Record<string, number>) => Object.values(o).reduce((s, v) => s + v, 0);
  return (
    <Section id="coins" title="Coins">
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <TileBox
          label="Coins outstanding"
          value={fmtCount(newest.coins.outstanding)}
          context={`held by ${fmtCount(newest.accounts.total)} accounts`}
        />
        <TileBox label="Earned in range" value={fmtCount(earnedSum)} />
        <TileBox label="Spent in range" value={fmtCount(spentSum)} />
      </div>
      {earnedSum === 0 && spentSum === 0 ? (
        <p className={EMPTY}>No coins were earned or spent in this range.</p>
      ) : isShortSeries(rows) ? (
        <>
          <ShortNote />
          <DayValues
            rows={rows}
            valueText={(r) => `+${fmtCount(sumOf(r.coins.earned))} / -${fmtCount(sumOf(r.coins.spent))}`}
          />
        </>
      ) : (
        <Figure caption="Earned above the line, spent below">
          <TwoSidedBars
            rows={rows}
            label={`Coins earned (above) and spent (below) per day by reason, ${dateRangeText(rows)}.`}
          />
        </Figure>
      )}
      {items.length > 0 ? <Legend items={items} /> : null}
      {late > 0 ? (
        <p className="mt-3 text-sm text-foreground">
          {`${fmtCount(late)} ${late === 1 ? "day was" : "days were"} recorded late, so sign-ups, competition and coin counts for ${
            late === 1 ? "it" : "them"
          } may be low.`}
        </p>
      ) : null}
    </Section>
  );
}

/** The whole content area for a model: the empty state, or every section. */
export function UsageContent({ model }: { model: UsageModel }) {
  if (model.state === "empty") return <UsageEmpty model={model} />;
  return (
    <div className="space-y-5">
      <UsageSvgDefs />
      <Tiles model={model} />
      <Activity model={model} />
      <Signups model={model} />
      <Retention model={model} />
      <Lapsed model={model} />
      <Competitions model={model} />
      <Challenges model={model} />
      <Coins model={model} />
    </div>
  );
}

export function UsageNotes() {
  const items: [string, string][] = [
    [
      "Game day",
      "The engine's own day: a date in the player's own time zone. It opens at local midnight and accepts step syncs until 10:00 local the next morning. Dates here are shown as stored, with no conversion.",
    ],
    [
      "Active",
      "A player is active on a game day when the engine accepted at least one step sync for it. The phone syncs in the background, so this means the phone reported in, not that the player opened the app.",
    ],
    [
      "Provisional and final",
      "A day is provisional until every time zone has closed it (22:00 UTC the next day). Provisional days are drawn dashed and marked in the tables. Final days are never rewritten.",
    ],
    [
      "Excluded accounts",
      "Store-review (demo) accounts, accounts on the internal list, and Google Play pre-launch robot accounts that never synced are in no number. The header says how many of each.",
    ],
    [
      "Sign-up date",
      "The day the account was created, in the player's own time zone. Retention counts the players of a cohort who were active exactly 1, 7, 14 or 30 days later, over the sign-ups recorded on the day. Players who later deleted their account count as not retained.",
    ],
    [
      "Coins, challenges and competitions",
      "Coin movements, joins, eliminations and finished competitions are counted by their date in Europe/London. A day recorded late may be low, because accounts deleted in the meantime are missing.",
    ],
    ["What is not here", "No step counts, no averages and no individual players. These are counts and coin totals only."],
  ];
  return (
    <details className={`${CARD} mt-5`}>
      <summary className="cursor-pointer text-base font-bold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy">
        How these numbers are made
      </summary>
      <dl className="mt-3 space-y-3">
        {items.map(([dt, dd]) => (
          <div key={dt}>
            <dt className="text-sm font-bold text-foreground">{dt}</dt>
            <dd className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{dd}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
