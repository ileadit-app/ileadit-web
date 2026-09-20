"use client";

import { use } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { CompetitionDetail } from "@/components/competitions/CompetitionDetail";

/**
 * `/competitions/[id]` (P2.1). Listed under CLAUDE.md's "Authenticated"
 * page table ("Detail + leaderboard (points only)") alongside `/dashboard`
 * and `/competitions/new` — so this uses the same `<ProtectedRoute>` guard
 * as those, not a bespoke signed-out gate. See `CompetitionDetail.tsx` for
 * why detail and leaderboard are ONE component/route rather than two.
 */
export default function CompetitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ProtectedRoute>
      <CompetitionDetail competitionId={id} />
    </ProtectedRoute>
  );
}
