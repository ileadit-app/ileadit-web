"use client";

import { useEffect, useState } from "react";
import { canCreateCompetitions } from "./adminClaim";

/**
 * Tri-state result of the client-side "can this user create a competition"
 * check (`src/lib/adminClaim.ts`, `canCreateCompetitions()`). `"checking"`
 * is the state while the forced token refresh is in flight — deliberately
 * distinct from `"denied"` so a caller never has to guess whether a refusal
 * is real or just not-loaded-yet (same discriminated-union discipline as
 * `CreatedCompetitionsState` in `src/lib/competitions.ts`, never a nullable
 * boolean).
 */
export type CreateCompetitionCapability = "checking" | "allowed" | "denied";

/**
 * Same "start in the already-correct state, only setState from inside the
 * async callback" shape as `useCreatedCompetitions` (`src/lib/
 * competitions.ts`) — avoids `react-hooks/set-state-in-effect` by never
 * calling `setState` synchronously in the effect body (see that file, and
 * `AuthContext.tsx`, for the two prior occurrences of this same fix).
 *
 * PRECONDITION, same shape as `useCreatedCompetitions`'s `uid` contract:
 * only mount a component using this hook once the caller's own auth
 * `status` (`useUser()`, `AuthContext.tsx`) is `"signed-in"` — e.g. inside
 * `<ProtectedRoute>`. `canCreateCompetitions()` reads
 * `getFirebaseAuth().currentUser`, which is `null` while signed out, and
 * this hook has no way to distinguish "signed out" from "claim genuinely
 * absent" — both resolve to `"denied"`. That's the correct behaviour for a
 * signed-out visitor (nothing to allow), but it means this hook must not be
 * used as a substitute for `ProtectedRoute`'s own sign-in gate.
 */
export function useCanCreateCompetitions(): CreateCompetitionCapability {
  const [capability, setCapability] = useState<CreateCompetitionCapability>("checking");

  useEffect(() => {
    let cancelled = false;

    canCreateCompetitions()
      .then((allowed) => {
        if (!cancelled) setCapability(allowed ? "allowed" : "denied");
      })
      .catch((error) => {
        // Fail CLOSED, not open: a claim-check error (network blip, token
        // refresh failure) must never be treated as permission granted.
        console.error("[useCanCreateCompetitions] claim check failed", error);
        if (!cancelled) setCapability("denied");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return capability;
}
