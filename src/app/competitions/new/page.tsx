"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { CreateCompetitionGate } from "@/components/competitions/CreateCompetitionGate";

/**
 * `/competitions/new` (P1.4). Two gates stack here, deliberately kept
 * separate: `ProtectedRoute` (must be signed in at all — any player) and
 * `CreateCompetitionGate` (must additionally be able to create — org/
 * ileadit admins only, see that component's header comment). Do not merge
 * them; "signed in" and "can create" are different questions with
 * different refusal UX, per the P1.4 ticket.
 */
export default function NewCompetitionPage() {
  return (
    <ProtectedRoute>
      <CreateCompetitionGate />
    </ProtectedRoute>
  );
}
