"use client";

import { useEffect, useState } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { useUser } from "@/context/AuthContext";
import { getFirebaseAuth } from "./firebase";
import { hasStrictAdminClaim } from "./adminClaim";

/**
 * Tri-state result of the STRICT admin check: only `claims.admin === true`
 * (`hasStrictAdminClaim`), never the `canCreateCompetitions` capability claim.
 * `"checking"` is distinct from `"denied"` so a caller can render nothing, and
 * start no reads, until the answer is known.
 */
export type StrictAdminState = "checking" | "allowed" | "denied";

interface Checked {
  uid: string;
  allowed: boolean;
}

/**
 * Gate for admin-only pages. Mount inside `<ProtectedRoute>` (which handles
 * the signed-out redirect), or rely on this hook's own `"checking"` for a
 * signed-out/loading session: it never resolves to `"allowed"` without a
 * forced-refresh token that carries the claim.
 *
 * - Forces `getIdTokenResult(true)`, so a claim granted mid-session is seen.
 * - Fails CLOSED: a token error resolves to `"denied"`.
 * - Re-checks (without forcing) whenever the ID token changes, so a revoked
 *   claim closes the page without a reload. That listener only ever
 *   DOWNGRADES; it never grants.
 * - Result is keyed by uid, so a different user signing in on the same tab
 *   starts again from `"checking"`.
 * - No synchronous setState in an effect body (react-hooks/set-state-in-effect):
 *   state is derived from `{uid, allowed}` against the current user.
 */
export function useStrictAdmin(): StrictAdminState {
  const { user, status } = useUser();
  const [checked, setChecked] = useState<Checked | null>(null);
  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    user
      .getIdTokenResult(true)
      .then((result) => {
        if (!cancelled) setChecked({ uid: user.uid, allowed: hasStrictAdminClaim(result.claims) });
      })
      .catch((error) => {
        console.error("[useStrictAdmin] admin check failed", error);
        if (!cancelled) setChecked({ uid: user.uid, allowed: false });
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    // Firebase calls the listener once straight away with the CACHED token.
    // That token can predate a claim granted mid-session and the forced
    // refresh above is what settles that case, so the first call is skipped:
    // acting on it could downgrade a correct "allowed".
    let first = true;
    const unsubscribe = onIdTokenChanged(getFirebaseAuth(), (changed) => {
      if (first) {
        first = false;
        return;
      }
      if (!changed || changed.uid !== uid) return;
      changed
        .getIdTokenResult()
        .then((result) => {
          if (!cancelled && !hasStrictAdminClaim(result.claims)) setChecked({ uid, allowed: false });
        })
        .catch(() => {
          if (!cancelled) setChecked({ uid, allowed: false });
        });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [uid]);

  if (status !== "signed-in" || !uid) return "checking";
  if (checked === null || checked.uid !== uid) return "checking";
  return checked.allowed ? "allowed" : "denied";
}
