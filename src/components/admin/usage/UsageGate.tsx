"use client";

import Link from "next/link";
import { useStrictAdmin } from "@/lib/useStrictAdmin";
import { UsageDashboard } from "./UsageDashboard";

/**
 * Strict admin gate for `/admin/usage`. Mount inside `<ProtectedRoute>` (signed
 * out goes to `/login`). Only `claims.admin === true` mounts the dashboard, so
 * no Firestore request is made while checking or when denied. The
 * `canCreateCompetitions` capability claim does not pass this gate.
 */
export function UsageGate() {
  const state = useStrictAdmin();

  if (state === "checking") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16" role="status" aria-live="polite">
        <p className="text-lg text-muted-foreground">Checking your access…</p>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-brand-navy">This account doesn&apos;t have admin access</h1>
        <p className="mt-3 text-muted-foreground">The usage numbers are for ileadit admins only.</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-brand-gold px-6 text-sm font-bold text-brand-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
        >
          Back to your dashboard
        </Link>
      </div>
    );
  }

  return <UsageDashboard />;
}
