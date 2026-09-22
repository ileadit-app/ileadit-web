"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, type FirestoreError } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";

/**
 * The engine's four lifecycle states (`functions/src/services/competitions.ts`
 * and `finalise.ts`, ileadit engine repo commit `9d190fd`): `scheduled` →
 * `active` → `finalising` → `finished`, driven entirely by
 * `runCompetitionLifecycle`/`finaliseCompetitionOnce` server-side. No client,
 * including this one, can ever write this field — see
 * `competitionEngineFields()` in `admin-web/firestore.rules`.
 */
export type CompetitionStatus = "scheduled" | "active" | "finalising" | "finished";

const KNOWN_STATUSES: readonly CompetitionStatus[] = [
  "scheduled",
  "active",
  "finalising",
  "finished",
];

function asCompetitionStatus(value: unknown): CompetitionStatus | null {
  return typeof value === "string" && (KNOWN_STATUSES as readonly string[]).includes(value)
    ? (value as CompetitionStatus)
    : null;
}

/**
 * The subset of a `competitions/{id}` document this dashboard is allowed to
 * read and needs to show. Deliberately does NOT include anything
 * step-derived (there is nothing step-derived on this document at all —
 * `RULES.md`'s "points and position only, never steps" is enforced by the
 * engine's own schema here, not by us filtering fields).
 *
 * `status`/`startDate`/`endDate`/`playerCount` are engine fields, populated
 * asynchronously by `onCompetitionWritten` shortly after creation — a
 * freshly created document can transiently have none of them yet, so all
 * four are optional/nullable here rather than assumed present.
 */
export interface CreatedCompetitionSummary {
  id: string;
  name: string | null;
  status: CompetitionStatus | null;
  /** `YYYY-MM-DD`, the competition's own calendar (never UTC) — see
   * `deriveCompetitionFields` in the engine repo. */
  startDate: string | null;
  endDate: string | null;
  playerCount: number | null;
  /** IANA zone the competition's own dates are computed in (WEB-3 item 3) —
   * needed to answer "is it this competition's startDate yet" correctly for
   * a viewer in a different zone. `null` before the engine trigger has
   * populated it; callers fall back to `DEFAULT_COMPETITION_ZONE`. */
  timeZone: string | null;
  /** `"public" | "private" | null` (PC-9). `null` means a doc that predates
   * this field — treat as public (legacy); see
   * `resolveCompetitionVisibility` in `CompetitionVisibilityChip.tsx`, the
   * one place that conversion happens. Not editable after creation. */
  visibility: "public" | "private" | null;
}

export type CreatedCompetitionsState =
  | { status: "loading" }
  | { status: "error"; error: FirestoreError }
  | { status: "success"; competitions: CreatedCompetitionSummary[] };

/**
 * Live query for "competitions I created" (P1.5). Permitted by
 * `admin-web/firestore.rules` §"competitions": `allow read: if signedIn();`
 * — an unconditional, non-field-scoped read grant for any signed-in user, so
 * a `where("creatorId", "==", uid)` query needs no further rule support
 * (unlike `players/{playerId}`, which requires an `exists()` proof of
 * membership and could NOT be queried this way).
 *
 * `uid` is expected to be non-null only once the caller's own auth `status`
 * is `"signed-in"` (see `AuthContext.tsx`) — passing `null` (still resolving,
 * or signed out) intentionally parks this hook in `"loading"` and subscribes
 * nothing, so it never fires a query with a not-yet-known uid.
 *
 * Uses `onSnapshot`, not a one-shot `getDocs`: competition status changes
 * server-side on the engine's own clock (`competitionLifecycle` job), and a
 * corporate admin watching their own dashboard should see `scheduled →
 * active` land without a manual refresh.
 */
export function useCreatedCompetitions(uid: string | null): CreatedCompetitionsState {
  // Always starts "loading" — for both the "no uid yet" case and the "have a
  // uid, subscribing now" case, so there is nothing to reset synchronously
  // inside the effect below (react-hooks/set-state-in-effect flags a
  // synchronous setState call in an effect body; see the AuthContext.tsx
  // `missingFirebaseConfigKeys()` precedent for this pattern). `uid`
  // practically never flips from one real value to another within this
  // hook's mounted lifetime — the caller (Dashboard) only mounts once
  // `status === "signed-in"` and unmounts immediately on sign-out
  // (ProtectedRoute) — so there is no "stale data under a new uid" case to
  // design for here.
  const [state, setState] = useState<CreatedCompetitionsState>({ status: "loading" });

  useEffect(() => {
    if (!uid) {
      return;
    }

    const competitionsQuery = query(
      collection(getFirebaseDb(), "competitions"),
      where("creatorId", "==", uid),
    );

    const unsubscribe = onSnapshot(
      competitionsQuery,
      (snapshot) => {
        const competitions: CreatedCompetitionSummary[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: typeof data.name === "string" ? data.name : null,
            status: asCompetitionStatus(data.status),
            startDate: typeof data.startDate === "string" ? data.startDate : null,
            endDate: typeof data.endDate === "string" ? data.endDate : null,
            playerCount: typeof data.playerCount === "number" ? data.playerCount : null,
            timeZone: typeof data.timeZone === "string" ? data.timeZone : null,
            visibility:
              data.visibility === "public" || data.visibility === "private"
                ? data.visibility
                : null,
          };
        });
        setState({ status: "success", competitions });
      },
      (error) => {
        // Never coerce this into "success" with an empty list — "you have no
        // competitions" and "we could not load your competitions" are
        // opposite messages (P1.5 ticket). Log loudly, surface the real
        // error to the caller.
        console.error("[useCreatedCompetitions] query failed", error);
        setState({ status: "error", error });
      },
    );

    return unsubscribe;
  }, [uid]);

  return state;
}
