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

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/* ------------------------------------------------------------------ *
 * 1. The competition document itself.
 *
 * Read rule: `admin-web/firestore.rules:232` —
 * `allow read: if signedIn();` — unconditional for any signed-in user,
 * member or not. This is why the SAME document (and therefore the SAME
 * route) can serve both the join-decision view and the leaderboard view:
 * there is nothing membership-gated about this particular read.
 * ------------------------------------------------------------------ */

export interface CompetitionDetailDoc {
  id: string;
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  backgroundImageUrl: string | null;
  status: CompetitionStatus | null;
  /** `YYYY-MM-DD`, engine-derived, the competition's own calendar. */
  startDate: string | null;
  endDate: string | null;
  durationDays: number | null;
  playerCount: number | null;
  winnerIds: string[];
}

export type CompetitionDetailState =
  | { status: "loading" }
  | { status: "not-found" }
  /** Rules technically permit any signed-in user to read this doc today
   * (see the header comment above) — this branch models the gap the design
   * doc calls out (§6.1 / CLAUDE.md's PROPOSED `visibility` field): if a
   * permission-denied ever surfaces here anyway, it means an invite-only
   * competition ID leaked to someone who shouldn't have it, and the copy
   * should say so rather than looking like a generic bug. */
  | { status: "denied" }
  | { status: "error"; error: FirestoreError }
  | { status: "success"; competition: CompetitionDetailDoc };

export function useCompetitionDetail(competitionId: string): CompetitionDetailState {
  const [state, setState] = useState<CompetitionDetailState>({ status: "loading" });

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(getFirebaseDb(), "competitions", competitionId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setState({ status: "not-found" });
          return;
        }
        const data = snapshot.data();
        setState({
          status: "success",
          competition: {
            id: snapshot.id,
            name: typeof data.name === "string" ? data.name : null,
            description: typeof data.description === "string" ? data.description : null,
            imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : null,
            backgroundImageUrl:
              typeof data.backgroundImageUrl === "string" ? data.backgroundImageUrl : null,
            status: asCompetitionStatus(data.status),
            startDate: typeof data.startDate === "string" ? data.startDate : null,
            endDate: typeof data.endDate === "string" ? data.endDate : null,
            durationDays: typeof data.durationDays === "number" ? data.durationDays : null,
            playerCount: typeof data.playerCount === "number" ? data.playerCount : null,
            winnerIds: asStringArray(data.winnerIds),
          },
        });
      },
      (error) => {
        console.error("[useCompetitionDetail] query failed", error);
        setState({ status: error.code === "permission-denied" ? "denied" : "error", error });
      },
    );

    return unsubscribe;
  }, [competitionId]);

  return state;
}

/* ------------------------------------------------------------------ *
 * 2. "Am I a member, and what does my own player doc say."
 *
 * Read rule: `admin-web/firestore.rules:262-265` —
 *   allow read: if signedIn()
 *     && exists(.../competitions/{competitionId}/players/{request.auth.uid});
 *   allow write: if false;
 *
 * The `exists()` clause is keyed on the READER's OWN uid, regardless of
 * which player doc they're trying to read. So attempting to read your own
 * player doc, specifically, collapses to "does my own player doc exist" —
 * which is exactly the membership question this hook exists to answer, and
 * exactly the mechanism that makes a non-member's read of the whole
 * `players` subcollection (not just other people's docs) fail. A
 * `permission-denied` here is therefore not a real error — it is the rule's
 * own, authoritative "you are not a member" signal, and this hook treats it
 * as such rather than surfacing it as `ErrorState`.
 * ------------------------------------------------------------------ */

export interface OwnPlayerData {
  displayName: string | null;
  avatarIndex: number | null;
  points: number;
  todayPoints: number;
  livesRemaining: number;
  eliminated: boolean;
  /** `rank`, engine-written ONLY at settlement (`finalise.ts`'s
   * `settleMemberOnce`, engine commit `d8d8e79`) — `null` for every status
   * before `finished`, and `null` even at `finished` for the brief window
   * before this specific player's own settlement transaction has committed.
   * See `src/lib/leaderboardRank.ts`'s `rankFinishedLeaderboard` for why
   * this field, once present, must be shown as-is and never recomputed. */
  frozenRank: number | null;
}

export type OwnMembershipState =
  | { status: "checking" }
  | { status: "not-member" }
  | { status: "member"; player: OwnPlayerData }
  | { status: "error"; error: FirestoreError };

export function useOwnMembership(
  uid: string | null,
  competitionId: string,
): OwnMembershipState {
  const [state, setState] = useState<OwnMembershipState>({ status: "checking" });

  useEffect(() => {
    if (!uid) {
      return;
    }

    const unsubscribe = onSnapshot(
      doc(getFirebaseDb(), "competitions", competitionId, "players", uid),
      (snapshot) => {
        if (!snapshot.exists()) {
          // Should be unreachable given the rule above (a readable doc that
          // doesn't exist would already have been permission-denied), kept
          // as a safe fallback rather than an assumption.
          setState({ status: "not-member" });
          return;
        }
        const data = snapshot.data();
        setState({
          status: "member",
          player: {
            displayName: typeof data.displayName === "string" ? data.displayName : null,
            avatarIndex: typeof data.avatarIndex === "number" ? data.avatarIndex : null,
            points: typeof data.points === "number" ? data.points : 0,
            todayPoints: typeof data.todayPoints === "number" ? data.todayPoints : 0,
            livesRemaining: typeof data.livesRemaining === "number" ? data.livesRemaining : 0,
            eliminated: data.eliminated === true,
            frozenRank: typeof data.rank === "number" ? data.rank : null,
          },
        });
      },
      (error) => {
        if (error.code === "permission-denied") {
          setState({ status: "not-member" });
          return;
        }
        console.error("[useOwnMembership] query failed", error);
        setState({ status: "error", error });
      },
    );

    return unsubscribe;
  }, [uid, competitionId]);

  return state;
}

/* ------------------------------------------------------------------ *
 * 3. The full leaderboard — only legal to query once membership (above)
 * has resolved to "member". `enabled=false` intentionally subscribes
 * nothing, so a non-member's page never issues a query the rules would
 * reject.
 * ------------------------------------------------------------------ */

export interface LeaderboardPlayer {
  id: string;
  displayName: string | null;
  avatarIndex: number | null;
  points: number;
  todayPoints: number;
  livesRemaining: number;
  eliminated: boolean;
  /** See `OwnPlayerData.frozenRank` — same field, same doc, same rules. */
  frozenRank: number | null;
}

export type LeaderboardState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: FirestoreError }
  | { status: "success"; players: LeaderboardPlayer[] };

export function useCompetitionPlayers(
  competitionId: string,
  enabled: boolean,
): LeaderboardState {
  // Starts, and stays, "idle" until `enabled` is true — no setState call in
  // the effect body itself, only inside the async `onSnapshot` callbacks
  // below (same discipline as `usePlayingCompetitions`'s
  // react-hooks/set-state-in-effect fix: a synchronous setState as the
  // first thing in an effect body is a smell, not a requirement — the
  // lazy `useState` initializer already covers "not subscribed yet", and
  // `CompetitionLeaderboard` renders the same skeleton for `"idle"` as for
  // `"loading"`, so there is no visible difference to preserve here).
  const [state, setState] = useState<LeaderboardState>({ status: "idle" });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const playersQuery = query(
      collection(getFirebaseDb(), "competitions", competitionId, "players"),
      orderBy("points", "desc"),
    );

    const unsubscribe = onSnapshot(
      playersQuery,
      (snapshot) => {
        const players: LeaderboardPlayer[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            displayName: typeof data.displayName === "string" ? data.displayName : null,
            avatarIndex: typeof data.avatarIndex === "number" ? data.avatarIndex : null,
            points: typeof data.points === "number" ? data.points : 0,
            todayPoints: typeof data.todayPoints === "number" ? data.todayPoints : 0,
            livesRemaining: typeof data.livesRemaining === "number" ? data.livesRemaining : 0,
            eliminated: data.eliminated === true,
            frozenRank: typeof data.rank === "number" ? data.rank : null,
          };
        });
        setState({ status: "success", players });
      },
      (error) => {
        console.error("[useCompetitionPlayers] query failed", error);
        setState({ status: "error", error });
      },
    );

    return unsubscribe;
  }, [competitionId, enabled]);

  return state;
}
