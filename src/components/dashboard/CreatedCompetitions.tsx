"use client";

import Link from "next/link";
import { AlertCircle, PlusCircle, Trophy, Users } from "lucide-react";
import { useCreatedCompetitions, type CreatedCompetitionSummary } from "@/lib/competitions";
import { CompetitionStatusChip } from "@/components/status/CompetitionStatusChip";
import {
  CompetitionVisibilityChip,
  resolveCompetitionVisibility,
} from "@/components/status/CompetitionVisibilityChip";

/**
 * "The competitions you created" (P1.5). Takes `uid` rather than calling
 * `useUser()` itself so this component has a single, explicit precondition
 * (a real uid) instead of quietly re-deriving auth state a second time —
 * `src/app/dashboard/page.tsx` is the one place that reads `useUser()` and
 * only mounts this component once `status === "signed-in"`.
 *
 * P1.5b update: `src/app/dashboard/page.tsx` now only mounts this component
 * once `useCanCreateCompetitions()` resolves to `"allowed"` — a dedicated
 * `PlayingCompetitions` view (`src/components/dashboard/
 * PlayingCompetitions.tsx`) is the real content for everyone else. That
 * makes the `canCreate` prop this component used to take (and the refusal
 * copy branch it fed into `EmptyState`, for a player who couldn't create
 * anything) dead weight — removed. This component can now assume, simply by
 * being mounted, that its caller has already confirmed the create
 * capability.
 */
export function CreatedCompetitions({ uid }: { uid: string }) {
  const state = useCreatedCompetitions(uid);

  if (state.status === "loading") {
    return <LoadingState />;
  }

  if (state.status === "error") {
    return <ErrorState />;
  }

  if (state.competitions.length === 0) {
    return <EmptyState />;
  }

  return (
    <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
      {state.competitions.map((competition) => (
        <li key={competition.id}>
          <CompetitionCard competition={competition} />
        </li>
      ))}
    </ul>
  );
}

function LoadingState() {
  return (
    <div
      className="mt-8 rounded-3xl border border-border bg-card p-8"
      role="status"
      aria-live="polite"
    >
      <div className="h-4 w-40 animate-pulse rounded-full bg-muted" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl bg-muted"
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="sr-only">Loading your competitions…</span>
    </div>
  );
}

/**
 * Distinct from `EmptyState` on purpose (P1.5 acceptance criterion 3): "you
 * have no competitions" and "we could not load your competitions" are
 * opposite messages, and defaulting a failed query to an empty list would
 * tell a corporate admin their competitions were deleted when really the
 * read just failed.
 */
function ErrorState() {
  return (
    <div
      className="mt-8 flex items-start gap-3 rounded-3xl border border-destructive/30 bg-destructive/10 p-6"
      role="alert"
    >
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
      <div>
        <p className="text-base font-bold text-destructive">
          We couldn&apos;t load your competitions
        </p>
        <p className="mt-1 text-sm leading-relaxed text-destructive/90">
          Something went wrong talking to ileadit while fetching this list. Your
          competitions are still there — try reloading the page. If this keeps
          happening,{" "}
          <a href="mailto:hello@ileadit.co.uk" className="font-semibold underline">
            email hello@ileadit.co.uk
          </a>{" "}
          and we&apos;ll take a look.
        </p>
      </div>
    </div>
  );
}

/**
 * The first thing a new corporate admin sees (P1.5 brief: "it matters more
 * than the populated state"). Makes the next action obvious rather than just
 * stating a fact. Only ever rendered for a confirmed org/ileadit admin
 * (P1.5b: the dashboard page only mounts `CreatedCompetitions` once
 * `useCanCreateCompetitions()` is `"allowed"`), so this can unconditionally
 * point at the creation flow — no refusal-copy branch needed any more.
 */
function EmptyState() {
  return (
    <div className="mt-8 rounded-3xl border border-dashed border-border bg-card p-10 text-center sm:p-14">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-gold/15 text-brand-navy">
        <Trophy className="size-6" aria-hidden="true" />
      </div>
      <p className="mt-4 text-lg font-bold text-foreground">
        No competitions yet
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Once you set one up, it&apos;ll show up here with its dates, status and
        player count.
      </p>
      <Link
        href="/competitions/new"
        className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold px-6 text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
      >
        <PlusCircle className="size-4" aria-hidden="true" />
        Create your first competition
      </Link>
    </div>
  );
}

/** `startDate`/`endDate` are `YYYY-MM-DD` in the competition's own calendar
 * zone (never UTC) — parsed as local calendar components, not through
 * `new Date(string)`, so this never drifts a day depending on the browser's
 * own timezone. */
function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate || !endDate) return "Dates being finalised";

  const format = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return value;
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(
      new Date(year, month - 1, day),
    );
  };

  return `${format(startDate)} – ${format(endDate)}`;
}

/**
 * PORTAL-NAV-1: the whole card is the link to `/competitions/{id}` (details,
 * leaderboard, edit/manage) — same fix and same reasoning as
 * `PlayingCompetitions.tsx`'s `PlayingCompetitionCard`, applied here too so
 * BOTH dashboard sections are reachable. See that component's comment for
 * the accessible-name and focus-ring reasoning; kept identical on purpose.
 */
function CompetitionCard({ competition }: { competition: CreatedCompetitionSummary }) {
  const name = competition.name ?? "Untitled competition";
  return (
    <Link
      href={`/competitions/${competition.id}`}
      aria-label={`View ${name}`}
      className="flex h-full flex-col rounded-3xl border border-border bg-card p-5 transition-colors hover:border-brand-navy/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold text-foreground">{name}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <CompetitionStatusChip
            status={competition.status}
            startDate={competition.startDate}
            timeZone={competition.timeZone}
          />
          <CompetitionVisibilityChip
            visibility={resolveCompetitionVisibility(competition.visibility)}
          />
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {formatDateRange(competition.startDate, competition.endDate)}
      </p>
      <div className="mt-auto flex items-center gap-2 pt-4 text-sm font-semibold text-foreground">
        <Users className="size-4 text-muted-foreground" aria-hidden="true" />
        {competition.playerCount === null
          ? "Player count pending"
          : `${competition.playerCount} ${competition.playerCount === 1 ? "player" : "players"}`}
      </div>
    </Link>
  );
}
