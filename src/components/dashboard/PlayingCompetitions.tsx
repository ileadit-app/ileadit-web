"use client";

import Link from "next/link";
import { AlertCircle, Medal, Smartphone, Trophy } from "lucide-react";
import {
  usePlayingCompetitions,
  type PlayingCompetitionSummary,
} from "@/lib/playerCompetitions";
import { CompetitionStatusChip } from "@/components/status/CompetitionStatusChip";

/**
 * "Competitions you're playing in" (P1.5b) — the view every signed-in user
 * gets, admin or not. Paul's 2026-09-20 decision: anyone with an ileadit
 * account can sign in to the website (mainly so `/account-deletion` is
 * reachable for the Google Play requirement), but only org/ileadit admins
 * can create competitions — so for most visitors here, "competitions you
 * created" (`CreatedCompetitions.tsx`) is permanently and correctly empty.
 * This component is the real content for that majority. See
 * `src/lib/playerCompetitions.ts` for the data-source explanation (why this
 * ISN'T the Android app's N+1 "list everything, test membership" query).
 *
 * Same `uid`-is-explicit convention as `CreatedCompetitions` — takes a
 * non-null `uid` rather than re-deriving auth state itself.
 */
export function PlayingCompetitions({ uid }: { uid: string }) {
  const state = usePlayingCompetitions(uid);

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
          <PlayingCompetitionCard competition={competition} />
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
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" aria-hidden="true" />
        ))}
      </div>
      <span className="sr-only">Loading the competitions you&apos;re playing in…</span>
    </div>
  );
}

/**
 * Deliberately distinct copy and distinct visual treatment from
 * `EmptyState` below, same discipline as `CreatedCompetitions.tsx`'s pair:
 * "you're not in any competitions" and "we couldn't check" must never
 * collapse into the same message, or a real outage reads as "you've been
 * removed from everything."
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
          We couldn&apos;t load the competitions you&apos;re playing in
        </p>
        <p className="mt-1 text-sm leading-relaxed text-destructive/90">
          Something went wrong talking to ileadit while checking this. You haven&apos;t lost your
          spot in anything — try reloading the page. If this keeps happening,{" "}
          <a href="mailto:hello@ileadit.app" className="font-semibold underline">
            email hello@ileadit.app
          </a>{" "}
          and we&apos;ll take a look.
        </p>
      </div>
    </div>
  );
}

/**
 * A brand-new account is IN ZERO competitions by default — this is the
 * common case, not an edge case (P1.5's brief for the admin view said the
 * same thing about its own empty state, and it's even more true here now
 * that every signed-in user, not just admins, lands on this page).
 *
 * What's the next action? Two real facts rule out the obvious options: (1)
 * this player cannot create a competition (only org/ileadit admins can —
 * `CreatedCompetitions.tsx`'s own empty state already covers that
 * refusal for the OTHER section), and (2) there is no "browse and join a
 * public competition" page on the WEBSITE at all — per CLAUDE.md's page
 * list and `/download`'s own copy ("Free to download, free to join a public
 * competition... on Android today"), joining happens in the app, not here.
 * So the honest, actually-actionable next step is: get the app. This links
 * to `/download` rather than inventing a web join-flow that doesn't exist.
 */
function EmptyState() {
  return (
    <div className="mt-8 rounded-3xl border border-dashed border-border bg-card p-10 text-center sm:p-14">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-gold/15 text-brand-navy">
        <Trophy className="size-6" aria-hidden="true" />
      </div>
      <p className="mt-4 text-lg font-bold text-foreground">You&apos;re not playing in anything yet</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Competitions are joined from the ileadit app, not the website — open the app to join a
        public competition, or watch for an invite from a friend, family member or employer.
      </p>
      <Link
        href="/download"
        className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-gold px-6 text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
      >
        <Smartphone className="size-4" aria-hidden="true" />
        Get the app
      </Link>
    </div>
  );
}

/** Same `YYYY-MM-DD`-as-local-calendar-components parsing as
 * `CreatedCompetitions.tsx`'s `formatDateRange` — never `new Date(string)`,
 * which would drift a day depending on the browser's own timezone. */
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

/** "#3 of 12" — position and points ONLY, never a step count (RULES.md's
 * "players compete on points, never steps", CLAUDE.md's Privacy Rules).
 * Neither field exists on the data this card is given, by construction —
 * see `PlayingCompetitionSummary` in `src/lib/playerCompetitions.ts`. */
function StandingLine({ competition }: { competition: PlayingCompetitionSummary }) {
  const { position, points, playerCount } = competition;

  if (position === null || points === null) {
    return (
      <span className="text-muted-foreground">Your standing is still being calculated</span>
    );
  }

  return (
    <span className="font-semibold text-foreground">
      #{position}
      {playerCount !== null ? ` of ${playerCount}` : ""} · {points} {points === 1 ? "point" : "points"}
    </span>
  );
}

function PlayingCompetitionCard({ competition }: { competition: PlayingCompetitionSummary }) {
  return (
    <div className="flex h-full flex-col rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold text-foreground">
          {competition.name ?? "Untitled competition"}
        </h3>
        <CompetitionStatusChip
          status={competition.status}
          startDate={competition.startDate}
          timeZone={competition.timeZone}
        />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {formatDateRange(competition.startDate, competition.endDate)}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 text-sm">
        <Medal className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <StandingLine competition={competition} />
      </div>
    </div>
  );
}
