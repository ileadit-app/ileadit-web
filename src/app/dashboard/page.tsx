"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useUser } from "@/context/AuthContext";
import { CreatedCompetitions } from "@/components/dashboard/CreatedCompetitions";
import { useCanCreateCompetitions } from "@/lib/useCanCreateCompetitions";

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

/**
 * `ProtectedRoute` only renders its children once `status === "signed-in"`
 * (src/components/auth/ProtectedRoute.tsx) — so by the time this component
 * mounts, `user` is guaranteed non-null. The `if (!user) return null` guard
 * below is defensive typing, not a real code path: it exists so
 * `CreatedCompetitions` can take a plain `uid: string` instead of a
 * nullable one, rather than because this component expects to render
 * without a user.
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
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Everything you&apos;ve set up, with where each one stands right now.
      </p>

      {/* `canCreate` gates the empty-state CTA below (P1.4 ticket:
          "must only render for users who can actually create"). While
          `capability === "checking"` this is `false`, so the button is
          briefly absent rather than shown-then-yanked for a user who turns
          out not to have the claim — a late appearance for an admin reads
          better than a working-looking button vanishing under a player. */}
      <CreatedCompetitions uid={user.uid} canCreate={capability === "allowed"} />
    </div>
  );
}
