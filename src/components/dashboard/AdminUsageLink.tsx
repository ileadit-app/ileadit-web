"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { useUser } from "@/context/AuthContext";
import { hasStrictAdminClaim } from "@/lib/adminClaim";

/**
 * A convenience link from the dashboard to `/admin/usage`, shown ONLY when the
 * signed-in user's token carries `claims.admin === true` (strict: the
 * `canCreateCompetitions` capability claim does not count).
 *
 * This is not the gate: `/admin/usage` runs its own forced-refresh check and
 * makes no read before it passes. So this reads the CACHED token (no forced
 * refresh, no listener, no network) and simply stays hidden when it can't tell.
 * Renders nothing while checking, so a plain player never sees it flash.
 */
export function AdminUsageLink() {
  const { user } = useUser();
  const [result, setResult] = useState<{ uid: string; admin: boolean } | null>(null);
  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdTokenResult();
        if (!cancelled) setResult({ uid: user.uid, admin: hasStrictAdminClaim(token.claims) });
      } catch {
        // Cannot tell: leave the link hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!uid || result === null || result.uid !== uid || !result.admin) return null;

  return (
    <p className="mt-14">
      <Link
        href="/admin/usage"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-bold text-brand-navy transition-colors hover:border-brand-navy/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
      >
        <BarChart3 className="size-4" aria-hidden="true" />
        Usage numbers (admin)
      </Link>
    </p>
  );
}
