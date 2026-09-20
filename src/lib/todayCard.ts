"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, type FirestoreError } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";

/**
 * Data support for the Today Card (ticket W7-TODAY, `/competitions/[id]`'s
 * hero-for-members). Read this header before touching this file.
 *
 * ============================================================================
 * THE BLOCKING FINDING THIS TICKET SURFACED
 * ============================================================================
 * The design spec this ticket points at
 * (`ileadit-leaderboard-design-20260920.md` §1's `DayRecord` contract, §1's
 * "on track / progress-toward-a-moving-bar" framing, and the null-vs-zero
 * `steps` rule) is written entirely against `users/{uid}/days/{date}`. That
 * collection is real, and the security rules technically permit the OWNER to
 * read their own record (`admin-web/firestore.rules`: `match /days/{date} {
 * allow read: if isOwner(userId); ... }`).
 *
 * But CLAUDE.md — this project's own standing instructions, which this
 * agent's operating rules say override everything else, INCLUDING a ticket
 * brief that assumes otherwise — says, in its Firestore Collections section,
 * under `users/{userId}/days/{date}`:
 *
 *   "Portal: must not read or display, ever, even though the rules
 *   technically allow the owner to read their own day record (Privacy
 *   Rules, below — this is a project-level ban stricter than the rules).
 *   Engine-write only."
 *
 * This is a deliberate, already-decided, project-level ban on this exact
 * collection — not a gap, not an oversight, and broader than "don't show
 * steps to other players": it also covers the `points`/`perCompetition`
 * fields on that SAME document (a different, allowed `points` field exists
 * on `competitions/{cid}/players/{uid}` — that one is fine, see below). The
 * Privacy Rules section is equally absolute and carries no "except to
 * yourself" carve-out: "NEVER expose step counts on the website."
 *
 * Consequence: this file, and the `TodayCard` component built on it, NEVER
 * read `users/{uid}/days/{date}`, for any uid, under any condition. That
 * single decision blocks three things the spec asked for and this ticket's
 * own acceptance criteria assumed would be readable:
 *   1. The literal `steps: null` vs `steps: 0` render distinction — both
 *      values live only on the banned document.
 *   2. A live "percent of today's target" bar — the live target is
 *      `max(average, floorSteps, lockTarget)` (verified against
 *      `functions/src/domain/target.ts`), which is also the engine's OWN
 *      scoring formula; replicating it client-side would additionally
 *      violate this ticket's own "do not compute a score" instruction, even
 *      before the privacy ban is considered.
 *   3. The honest "you needed 8,400, you hit 9,100" closed-day summary — the
 *      only place a concrete target number is ever written is
 *      `days/{date}.perCompetition[cid].pointsTarget`, on the banned doc.
 *
 * None of these are built. This is a deliberate, reported omission, not a
 * missed requirement — see the ticket's findings report for the full
 * account. What IS built below uses only fields this portal has always been
 * allowed to read: `competitions/{cid}/players/{uid}` (todayPoints, points,
 * livesRemaining, eliminated — already engine-computed, already used by
 * `competitionDetail.ts`) and `users/{uid}/private/game` (which CLAUDE.md
 * does not restrict beyond ordinary owner-read) for warm-up state, PLUS
 * `average`'s mere EXISTENCE (never its numeric value, which is a steps
 * figure) as the closest legitimate analog available for the "don't
 * conflate no-data with a real value" discipline the spec's `steps`
 * null-vs-zero rule was really about.
 * ============================================================================
 */

export interface AccountGameState {
  /**
   * `private/game.average !== null`. Deliberately a boolean, never the
   * number itself: `average` is a rolling STEP average, and "NEVER expose
   * step counts on the website" (CLAUDE.md Privacy Rules) has no
   * owner-only exception. Only whether an average has been established is
   * used, as a state signal — not the figure.
   */
  averageEstablished: boolean;
  /** IANA zone this account's game days are computed in — needed to ask
   * "what calendar date is it for THIS player right now", which is not
   * necessarily the viewer's own browser zone. */
  timeZone: string | null;
  /** `YYYY-MM-DD`, the account's first game day. `null` before
   * `seedHistory` has ever run (brand new account, nothing seeded yet). */
  firstDay: string | null;
  /** `YYYY-MM-DD`, inclusive last warm-up day. `null` before seeding. */
  warmupEndsOn: string | null;
}

export type AccountGameStateResult =
  | { status: "loading" }
  | { status: "error"; error: FirestoreError }
  | { status: "success"; state: AccountGameState };

/** `users/{uid}/private/game` — owner-read, engine-write only. Not the
 * banned collection; see this file's header. */
export function useAccountGameState(uid: string | null): AccountGameStateResult {
  const [state, setState] = useState<AccountGameStateResult>({ status: "loading" });

  useEffect(() => {
    if (!uid) {
      return;
    }

    const unsubscribe = onSnapshot(
      doc(getFirebaseDb(), "users", uid, "private", "game"),
      (snapshot) => {
        const data = snapshot.data();
        setState({
          status: "success",
          state: {
            averageEstablished: typeof data?.average === "number",
            timeZone: typeof data?.timeZone === "string" ? data.timeZone : null,
            firstDay: typeof data?.firstDay === "string" ? data.firstDay : null,
            warmupEndsOn: typeof data?.warmupEndsOn === "string" ? data.warmupEndsOn : null,
          },
        });
      },
      (error) => {
        console.error("[useAccountGameState] query failed", error);
        setState({ status: "error", error });
      },
    );

    return unsubscribe;
  }, [uid]);

  return state;
}

export interface WarmupStatus {
  /** 1-based: "Day N of totalDays". */
  dayOfWarmup: number;
  totalDays: number;
}

/**
 * Pure — no Firebase, mutation-tested directly. Returns `null` when the
 * warm-up pill should NOT be shown: either warm-up hasn't been established
 * yet (brand new, unseeded account — `firstDay`/`warmupEndsOn` still null)
 * or it has already ended for this player (today's calendar date, in the
 * ACCOUNT's own zone, is past `warmupEndsOn`).
 *
 * `warmupDays` is the LIVE `config/game.target.warmupDays` value, used only
 * to LABEL the pill ("of N") — it is not what decides whether warm-up is
 * still active (that's `warmupEndsOn`, fixed at seed time). If the config's
 * `warmupDays` is ever changed after an account's `warmupEndsOn` was
 * already set, the label could show a different N than the window actually
 * seeded with. There is no per-account record of "the warmupDays value in
 * effect when I was seeded" to fall back on, and inventing one is exactly
 * what this ticket says not to do — flagged here as a known, accepted
 * limitation rather than worked around.
 */
export function resolveWarmupStatus(
  gameState: Pick<AccountGameState, "timeZone" | "firstDay" | "warmupEndsOn">,
  warmupDays: number,
  now: Date = new Date(),
): WarmupStatus | null {
  const { timeZone, firstDay, warmupEndsOn } = gameState;
  if (!timeZone || !firstDay || !warmupEndsOn) {
    return null;
  }

  const today = formatDateInZone(now, timeZone);
  if (today > warmupEndsOn) {
    return null;
  }

  const dayOfWarmup = daysBetweenDateStrings(firstDay, today) + 1;
  if (dayOfWarmup < 1) {
    // Clock skew / not-yet-started edge case — never show "Day 0" or below.
    return null;
  }

  return {
    dayOfWarmup: Math.min(dayOfWarmup, warmupDays),
    totalDays: warmupDays,
  };
}

/** `YYYY-MM-DD` in the given IANA zone, for the given instant. `en-CA`
 * formats dates in that exact order, which sorts/compares identically to
 * the engine's own date strings (see `daysBetweenDateStrings` below and
 * `functions/src/domain/dates.ts`'s own string-based day comparisons). */
function formatDateInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Whole calendar days between two `YYYY-MM-DD` strings, computed via UTC
 * midnight so host-timezone DST quirks never enter the arithmetic — both
 * inputs are already resolved calendar dates by the time they get here. */
function daysBetweenDateStrings(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}
