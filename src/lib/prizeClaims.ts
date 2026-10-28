"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, type FirestoreError } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";

/**
 * `competitions/{cid}/prizeClaims/{uid}` (PRZ-E1/E2, spec §3.2/§4.6 — not
 * deployed as of 2026-10-27). One doc per winner. Rule: "owner read;
 * organiser/admin read of status only" — the "status only" half is a
 * STATED INTENT about what the organiser is meant to consume, not a
 * Firestore field-level restriction (Firestore rules can't partially
 * redact a document); the one genuinely access-restricted sub-path is
 * `prizeClaims/{uid}/private/delivery` (admin-only, Phase 2 physical-prize
 * addresses), which this hook never reads. `OrganiserPrizePanel.tsx` only
 * ever displays `status` from what this hook returns, by choice, matching
 * the spec's intent even though nothing stops it reading more.
 *
 * `enabled` follows the same "only subscribe once gated" shape as
 * `useCompetitionPlayers` — only mounted for a confirmed organiser viewing
 * a finished competition, never for an ordinary player.
 */
export type PrizeClaimStatus =
  | "waiting"
  | "ready"
  | "revealed"
  | "optedIn"
  | "declined"
  | "given"
  | "sent";

const KNOWN_CLAIM_STATUSES: readonly PrizeClaimStatus[] = [
  "waiting",
  "ready",
  "revealed",
  "optedIn",
  "declined",
  "given",
  "sent",
];

function asPrizeClaimStatus(value: unknown): PrizeClaimStatus | null {
  return typeof value === "string" && (KNOWN_CLAIM_STATUSES as readonly string[]).includes(value)
    ? (value as PrizeClaimStatus)
    : null;
}

export interface PrizeClaim {
  /** The winner's own uid — the claim doc's own id. */
  uid: string;
  place: number | null;
  status: PrizeClaimStatus | null;
  givenAt: unknown;
}

export type PrizeClaimsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: FirestoreError }
  | { status: "success"; claims: PrizeClaim[] };

export function usePrizeClaims(competitionId: string, enabled: boolean): PrizeClaimsState {
  const [state, setState] = useState<PrizeClaimsState>({ status: "idle" });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const unsubscribe = onSnapshot(
      collection(getFirebaseDb(), "competitions", competitionId, "prizeClaims"),
      (snapshot) => {
        const claims: PrizeClaim[] = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data();
          return {
            uid: docSnapshot.id,
            place: typeof data.place === "number" ? data.place : null,
            status: asPrizeClaimStatus(data.status),
            givenAt: data.givenAt ?? null,
          };
        });
        setState({ status: "success", claims });
      },
      (error) => {
        console.error("[usePrizeClaims] query failed", error);
        setState({ status: "error", error });
      },
    );

    return unsubscribe;
  }, [competitionId, enabled]);

  return state;
}

export function findClaimForUid(claims: PrizeClaim[], uid: string): PrizeClaim | null {
  return claims.find((claim) => claim.uid === uid) ?? null;
}
