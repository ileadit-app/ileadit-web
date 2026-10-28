"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, type FirestoreError } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";

/**
 * `competitions/{cid}/terms/current` (PRZ-W4, spec §3.3/§4.6 — not deployed
 * as of 2026-10-27). Public read, unconditionally — unlike every other
 * prize-related read in this ticket, this one is deliberately NOT gated on
 * sign-in, membership, or organiser status. The public `/prize-terms` page
 * (W4) must work for a signed-out visitor who followed a link, so this hook
 * takes no `uid`/`enabled` param at all.
 *
 * `approvedTemplateVersion === "DRAFT-NOT-APPROVED"` is a real, spec-named
 * sentinel value (§4.6) — not a generic "unapproved" boolean — used verbatim
 * so the page can show "Draft terms, not yet approved" without inventing a
 * separate approval flag.
 *
 * A missing doc is a normal, expected state ("no prize terms for this
 * competition" — e.g. the competition has no prize at all, or the engine
 * hasn't generated terms yet) and must never be conflated with a real error.
 */
export interface CompetitionTermsDoc {
  version: string | null;
  html: string | null;
  generatedAt: unknown;
  approvedTemplateVersion: string | null;
}

export const DRAFT_NOT_APPROVED_SENTINEL = "DRAFT-NOT-APPROVED";

export type CompetitionTermsState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error"; error: FirestoreError }
  | { status: "success"; terms: CompetitionTermsDoc };

export function useCompetitionTerms(competitionId: string): CompetitionTermsState {
  const [state, setState] = useState<CompetitionTermsState>({ status: "loading" });

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(getFirebaseDb(), "competitions", competitionId, "terms", "current"),
      (snapshot) => {
        if (!snapshot.exists()) {
          setState({ status: "not-found" });
          return;
        }
        const data = snapshot.data();
        setState({
          status: "success",
          terms: {
            version: typeof data.version === "string" ? data.version : null,
            html: typeof data.html === "string" ? data.html : null,
            generatedAt: data.generatedAt ?? null,
            approvedTemplateVersion:
              typeof data.approvedTemplateVersion === "string"
                ? data.approvedTemplateVersion
                : null,
          },
        });
      },
      (error) => {
        console.error("[useCompetitionTerms] query failed", error);
        setState({ status: "error", error });
      },
    );

    return unsubscribe;
  }, [competitionId]);

  return state;
}

export function isDraftNotApproved(terms: CompetitionTermsDoc): boolean {
  return terms.approvedTemplateVersion === DRAFT_NOT_APPROVED_SENTINEL;
}
