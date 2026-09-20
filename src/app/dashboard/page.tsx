"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useUser } from "@/context/AuthContext";
import { CreatedCompetitions } from "@/components/dashboard/CreatedCompetitions";

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

      <CreatedCompetitions uid={user.uid} />
    </div>
  );
}
