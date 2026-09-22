"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  type FirestoreError,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import type { CompetitionStatus } from "./competitions";
import { findLeaderboardRank } from "./leaderboardRank";

// Re-export so callers of this module don't also need to import from
// `competitions.ts` just for the status union.
export type { CompetitionStatus } from "./competitions";

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
 * Per competition, what a PLAYER (not a creator) sees on their dashboard
 * (P1.5b). `points`/`position` come from `competitions/{id}/players` — never
 * from anything step-derived, because nothing step-derived exists on that
 * document at all (RULES.md:34, :102, :161 — points and position only, not
 * even to the player's own account-holder view, and certainly never to
 * anyone else's).
 *
 * `position` is a 1-based rank computed client-side by ordering the
 * competition's own player documents by `points` descending (same technique
 * as the Android app's `CompetitionLeaderboardActivity` /
 * `observeCompetitionPlayers`) — `null` while that query's first snapshot is
 * still in flight, or in the (should-be-impossible, since
 * `activeCompetitionIds` and `players/{uid}` are written in the same engine
 * transaction — see `joinCompetition.ts`) case that this competition's own
 * player collection doesn't contain a doc for this uid.
 */
export interface PlayingCompetitionSummary {
  id: string;
  name: string | null;
  status: CompetitionStatus | null;
  startDate: string | null;
  endDate: string | null;
  /** Total players in the competition (engine field, for "#3 of 12"). */
  playerCount: number | null;
  points: number | null;
  position: number | null;
  /** IANA zone the competition's own dates are computed in (WEB-3 item 3) —
   * see `CreatedCompetitionSummary.timeZone` in `competitions.ts`. */
  timeZone: string | null;
  /** `"public" | "private" | null` (PC-9). `null` means a doc that predates
   * this field — treat as public (legacy); see
   * `resolveCompetitionVisibility` in `CompetitionVisibilityChip.tsx`. Not
   * editable after creation. */
  visibility: "public" | "private" | null;
}

export type PlayingCompetitionsState =
  | { status: "loading" }
  | { status: "error"; error: FirestoreError }
  | { status: "success"; competitions: PlayingCompetitionSummary[] };

interface CompetitionDocData {
  name: string | null;
  status: CompetitionStatus | null;
  startDate: string | null;
  endDate: string | null;
  playerCount: number | null;
  timeZone: string | null;
  visibility: "public" | "private" | null;
}

interface PlayerStanding {
  points: number | null;
  position: number | null;
}

/**
 * "Competitions I'm playing in" (P1.5b). THE DATA PROBLEM this hook exists
 * to solve correctly, not work around:
 *
 * There is no client-queryable "list of competitions this user has joined" —
 * `competitions/{id}/players/{playerId}` can only be READ once membership of
 * that exact competition is already proven (`admin-web/firestore.rules`,
 * the `players/{playerId}` match block: `allow read: if signedIn() &&
 * exists(.../competitions/{competitionId}/players/{request.auth.uid});`).
 * There is no `collectionGroup("players")` escape hatch either: the rule's
 * `exists()` check is keyed on `competitionId`, which a collection-group
 * query has no way to bind without already knowing it, and the player
 * documents don't store their own uid as a field to filter on (id-only) — a
 * collection-group query filtered by document path segment isn't something
 * Firestore supports. So naively, "which competitions am I in" would need
 * the Android app's N+1 (`CompetitionRepository.isUserInActiveCompetition`:
 * list EVERY competition in the system, then `get()` a player doc per
 * competition to test membership) — one read per system-wide competition,
 * every time the dashboard loads, permission-denied on most of them. That
 * does not scale past a small system-wide competition count.
 *
 * It turns out that N+1 is NOT actually necessary here, because the engine
 * already maintains a real per-user index:
 * `users/{uid}/private/game.activeCompetitionIds` (`docs/FIRESTORE_SCHEMA.md`
 * in the engine repo, and written by `joinCompetition.ts`/`leaveCompetition.ts`
 * in the SAME transaction as the player doc, plus refreshed by `close.ts`'s
 * daily job). That document is owner-read (`admin-web/firestore.rules`,
 * `private/game`), so this hook reads it directly and only subscribes to the
 * competitions actually named in it — cost is O(k), k = this player's own
 * active-competition count (in practice small, capped by how many
 * competitions a person can realistically be in at once), never O(every
 * competition that has ever existed). See `src/lib/competitions.ts` for the
 * counterpart admin query, which has a different, genuinely-unconditional
 * rule to lean on (`competitions/{id}`'s own `allow read: if signedIn()`)
 * and so doesn't need this two-level subscription at all.
 *
 * Caveat this hook does NOT attempt to solve, and DECIDED (ticket
 * W8-FINISHED, 2026-09-20): `activeCompetitionIds` only contains
 * competitions that are scheduled, active, or not yet settled for THIS
 * member — verified against `functions/src/services/close.ts` (engine
 * commit `d8d8e79`)'s `refreshedIds` computation, which drops a competition
 * id the moment `endDate < nextDate`, i.e. the SAME close that processes
 * this member's own last competition day. Cross-checked against
 * `finalise.ts`'s `finaliseCompetitionOnce`: a competition only reaches
 * `status: "finished"` after EVERY member has been settled, which itself
 * requires every member's last day to have already closed. So by
 * construction, a `finished` competition has ALREADY been dropped from
 * `activeCompetitionIds` for every member, for every one of them, before
 * the competition doc's own status can ever read `finished` — there is no
 * observable state where a `finished` (or, for an on-time closer, even a
 * `finalising`) competition still shows up here. This is not a gap to
 * patch; a finished competition has nowhere legitimate to appear in a
 * per-member "currently active id" list, structurally, not by omission.
 *
 * A finished competition moves instead into `private/game.competitionHistory`
 * (capped at the last 10), and that record's own shape includes
 * `averageSteps` — a raw step-derived field that must NEVER be read or
 * rendered by this portal (CLAUDE.md's Privacy Rules). A future "your past
 * competitions" dashboard section reading that array would need to project
 * out every field except `averageSteps` explicitly — not built here; this
 * hook's `PlayingCompetitionSummary.status` (`CompetitionStatus | null`,
 * rendered via `CompetitionStatusChip` — `src/lib/competition-status.ts`)
 * still includes `"finished"` only for type-completeness against
 * `CompetitionStatus`, not because this hook is expected to ever actually
 * emit one.
 */
export function usePlayingCompetitions(uid: string | null): PlayingCompetitionsState {
  const [state, setState] = useState<PlayingCompetitionsState>({ status: "loading" });

  useEffect(() => {
    if (!uid) {
      return;
    }
    const currentUid = uid;

    const db = getFirebaseDb();
    let cancelled = false;

    const competitionData = new Map<string, CompetitionDocData>();
    const standingData = new Map<string, PlayerStanding>();
    const unsubscribers = new Map<string, () => void>();

    function emit() {
      if (cancelled) return;
      const competitions: PlayingCompetitionSummary[] = [...competitionData.entries()].map(
        ([id, comp]) => {
          const standing = standingData.get(id);
          return {
            id,
            name: comp.name,
            status: comp.status,
            startDate: comp.startDate,
            endDate: comp.endDate,
            playerCount: comp.playerCount,
            points: standing?.points ?? null,
            position: standing?.position ?? null,
            timeZone: comp.timeZone,
            visibility: comp.visibility,
          };
        },
      );
      setState({ status: "success", competitions });
    }

    function onFatalError(error: FirestoreError) {
      if (cancelled) return;
      console.error("[usePlayingCompetitions] query failed", error);
      setState({ status: "error", error });
    }

    function subscribeToCompetition(competitionId: string) {
      const compUnsub = onSnapshot(
        doc(db, "competitions", competitionId),
        (snapshot) => {
          if (!snapshot.exists()) {
            competitionData.delete(competitionId);
            emit();
            return;
          }
          const data = snapshot.data();
          competitionData.set(competitionId, {
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
          });
          emit();
        },
        onFatalError,
      );

      // Ordered by points server-side (same technique as the Android
      // leaderboard's `observeCompetitionPlayers`) — legal here specifically
      // because the reader has already proven membership of THIS
      // competition (it's in their own `activeCompetitionIds`), which is
      // exactly the precondition the rule's `exists()` check enforces for
      // every doc in the query, not only the reader's own. The server-side
      // `orderBy` is just a reasonable base fetch order, though — the
      // DISPLAYED position is computed by `findLeaderboardRank`
      // (`src/lib/leaderboardRank.ts`), the one shared sort/rank utility
      // (W5-LEADERBOARD), so this "playing in" position is never wrong in
      // the two ways a raw `index + 1` would be: an eliminated player who
      // banked more points before going out must not outrank an active
      // survivor with fewer points (D-18), and two players tied on points
      // must show the SAME position, not an arbitrary tie-broken one.
      const standingsUnsub = onSnapshot(
        query(collection(db, "competitions", competitionId, "players"), orderBy("points", "desc")),
        (snapshot) => {
          const rankable = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              displayName: typeof data.displayName === "string" ? data.displayName : null,
              points: typeof data.points === "number" ? data.points : 0,
              eliminated: data.eliminated === true,
            };
          });
          const ownSnapshotDoc = snapshot.docs.find((d) => d.id === currentUid) ?? null;
          const points =
            ownSnapshotDoc && typeof ownSnapshotDoc.data().points === "number"
              ? (ownSnapshotDoc.data().points as number)
              : null;
          standingData.set(competitionId, {
            points,
            position: ownSnapshotDoc ? findLeaderboardRank(rankable, currentUid) : null,
          });
          emit();
        },
        onFatalError,
      );

      unsubscribers.set(competitionId, () => {
        compUnsub();
        standingsUnsub();
      });
    }

    function unsubscribeFromCompetition(competitionId: string) {
      unsubscribers.get(competitionId)?.();
      unsubscribers.delete(competitionId);
      competitionData.delete(competitionId);
      standingData.delete(competitionId);
    }

    const gameUnsub = onSnapshot(
      doc(db, "users", uid, "private", "game"),
      (snapshot) => {
        const data = snapshot.data();
        const activeIds: string[] = Array.isArray(data?.activeCompetitionIds)
          ? data.activeCompetitionIds.filter((v): v is string => typeof v === "string")
          : [];
        const activeIdSet = new Set(activeIds);

        for (const id of activeIds) {
          if (!unsubscribers.has(id)) subscribeToCompetition(id);
        }
        for (const id of [...unsubscribers.keys()]) {
          if (!activeIdSet.has(id)) unsubscribeFromCompetition(id);
        }

        // With zero active ids there is nothing left to wait on — emit
        // immediately rather than staying in "loading" forever. With one or
        // more, `emit()` fires naturally once each new subscription's first
        // snapshot lands, so we deliberately do NOT call it here in that
        // case (it would emit a transiently-incomplete list on every
        // `activeCompetitionIds` change).
        if (activeIds.length === 0) {
          emit();
        }
      },
      onFatalError,
    );

    return () => {
      cancelled = true;
      gameUnsub();
      for (const id of [...unsubscribers.keys()]) unsubscribeFromCompetition(id);
    };
  }, [uid]);

  return state;
}
