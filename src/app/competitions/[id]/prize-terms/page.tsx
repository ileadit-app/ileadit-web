"use client";

import { use } from "react";
import { PrizeTerms } from "@/components/competitions/PrizeTerms";

/**
 * `/competitions/[id]/prize-terms` (PRZ-W1 deliverable 3, W4). Public —
 * deliberately NOT wrapped in `<ProtectedRoute>`, contrast
 * `/competitions/[id]/page.tsx`. A prize's terms need to be readable by
 * anyone with the link (a prospective player deciding whether to join, a
 * winner's family member, anyone) before/without ever signing in — same
 * reasoning `/invite/[code]/page.tsx` already documents for its own
 * deliberately-public route. See `PrizeTerms.tsx` for how the terms HTML
 * itself is rendered safely (sandboxed iframe, not `dangerouslySetInnerHTML`).
 */
export default function PrizeTermsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return <PrizeTerms competitionId={id} />;
}
