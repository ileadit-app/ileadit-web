"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useUser } from "@/context/AuthContext";
import { CreatedCompetitions } from "@/components/dashboard/CreatedCompetitions";
import { PlayingCompetitions } from "@/components/dashboard/PlayingCompetitions";
import { useCanCreateCompetitions } from "@/lib/useCanCreateCompetitions";

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

/**
 * P1.5b: Paul's 2026-09-20 decision made this page ADAPT to who's looking at
 * it. ANY signed-in user reaches `/dashboard` now (not just corporate
 * admins — sign-in is open to everyone so `/account-deletion` is reachable
 * for the Google Play requirement), but only an org/ileadit admin can
 * create a competition. So the page always leads with "competitions you're
 * playing in" (`PlayingCompetitions`) — the one section that applies to
 * every visitor, admin or not, since an admin can also be a player in
 * someone else's competition — and appends "competitions you created"
 * (`CreatedCompetitions`) ONLY once `useCanCreateCompetitions()` resolves to
 * `"allowed"`.
 *
 * This is two stacked sections, not a toggle or a merged list: the two
 * queries have entirely different shapes (one is "everything in
 * `activeCompetitionIds`", the other is "everything with
 * `creatorId == uid`") and, for the common case of a plain player, the
 * second section literally does not apply — there is nothing to toggle
 * between. An admin who is also a player just sees both sections stacked,
 * which reads as "here's what you're playing" then "here's what you run" —
 * two different relationships to ileadit, not duplicate views of the same
 * thing, so keeping them visually and structurally separate (own heading,
 * own empty/error states) is truthful to what they actually are rather than
 * forcing a single merged list to explain two different roles per card.
 *
 * `capability === "checking"` intentionally renders neither the admin
 * section nor its heading yet (same "briefly absent, not shown-then-yanked"
 * reasoning `CreatedCompetitions`'s old `canCreate` gate documented) — a
 * plain player never sees it flash in only to vanish.
 */
function DashboardContent() {
  const { user } = useUser();
  // Only mounted once `status === "signed-in"` (ProtectedRoute above) —
  // the precondition `useCanCreateCompetitions` documents for itself.
  const capability = useCanCreateCompetitions();
  if (!user) return null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">
        Dashboard
      </p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        Your competitions
      </h1>

      <section aria-labelledby="playing-heading">
        <h2 id="playing-heading" className="mt-10 text-xl font-bold text-foreground">
          Playing in
        </h2>
        <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Where you stand right now — points and position only.
        </p>
        <PlayingCompetitions uid={user.uid} />
      </section>

      {capability === "allowed" && (
        <section aria-labelledby="created-heading">
          <h2 id="created-heading" className="mt-14 text-xl font-bold text-foreground">
            Created by you
          </h2>
          <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Everything you&apos;ve set up, with where each one stands right now.
          </p>
          <CreatedCompetitions uid={user.uid} />
        </section>
      )}
    </div>
  );
}
