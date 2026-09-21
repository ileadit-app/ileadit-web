"use client";

import { useEffect, useState } from "react";
import { isCurrentUserAdmin } from "./adminClaim";

/**
 * Tri-state "is this signed-in user allowed to manage invites for THIS
 * competition" check (WEB-INV-1, BUILD item 2: "organiser view only:
 * creator or admin, as the page decides today"). No organisation/tenant
 * model exists yet (CLAUDE.md's Firestore Collections section — "no
 * organisation/tenant/seat concept exists anywhere in the engine"), so
 * "org owner/admin" from the INV-1 contract has no real check to make yet
 * on the web portal; this hook covers the two halves that DO have one:
 * the competition's own `creatorId` (added to `CompetitionDetailDoc` for
 * this ticket) and the ileadit admin custom claim
 * (`isCurrentUserAdmin`, `src/lib/adminClaim.ts`). If/when an org model
 * ships, extend this hook, not `createInvite`'s server-side check —
 * the server is always the real boundary; this is UI gating only, same
 * caveat as every other claim-based hook in this codebase.
 *
 * Deliberately built as a PURE per-render comparison
 * (`creatorId === uid`) for the creator half, not something computed
 * inside an effect — `creatorId` can transition from `null` (a freshly
 * created competition doc, before the engine's `onCompetitionWritten`
 * trigger backfills it — see `CompetitionDetailDoc`'s own field comments
 * for other fields with this same transient-null window) to the real
 * value at any point during this component's lifetime, and an
 * effect gated on "only run once" would miss that transition. Only the
 * admin-claim half needs an effect (an async token refresh), and that
 * effect's own state only ever changes via its `.then()`/`.catch()`
 * callbacks — never synchronously in the effect body — per this
 * codebase's established `react-hooks/set-state-in-effect` fix (see
 * `useCanCreateCompetitions.ts` for the same shape).
 */
export type CompetitionOrganiserCapability = "checking" | "organiser" | "not-organiser";

function useAdminClaimState(): "checking" | "admin" | "not-admin" {
  const [state, setState] = useState<"checking" | "admin" | "not-admin">("checking");

  useEffect(() => {
    let cancelled = false;

    isCurrentUserAdmin()
      .then((isAdmin) => {
        if (!cancelled) setState(isAdmin ? "admin" : "not-admin");
      })
      .catch((error) => {
        // Fail CLOSED: a claim-check error must never be treated as "is an
        // admin" — same discipline as `useCanCreateCompetitions`.
        console.error("[useIsCompetitionOrganiser] admin claim check failed", error);
        if (!cancelled) setState("not-admin");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function useIsCompetitionOrganiser(
  creatorId: string | null,
  uid: string | null,
): CompetitionOrganiserCapability {
  const isCreator = creatorId !== null && uid !== null && creatorId === uid;
  const adminState = useAdminClaimState();

  // A confirmed creator match never has to wait on the (slower) admin
  // token-refresh round trip — resolve immediately rather than showing a
  // "checking" skeleton to the one person who is definitely allowed.
  if (isCreator) return "organiser";
  if (adminState === "checking") return "checking";
  return adminState === "admin" ? "organiser" : "not-organiser";
}
