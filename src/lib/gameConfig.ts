"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, type FirestoreError } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";

/**
 * `config/game` (engine `functions/src/config/schema.ts`, sibling `ileadit`
 * repo commit `76146a7`) is game-BALANCE configuration, not player data —
 * `admin-web/firestore.rules`: `match /config/game { allow read: if
 * signedIn(); ... }`, unconditional for any signed-in user. This carries
 * none of the privacy weight CLAUDE.md attaches to `users/{uid}/days/{date}`
 * (banned outright for this portal — see `src/lib/todayCard.ts`'s header) —
 * it is one shared document describing the game's rules, the same for every
 * player, containing no step data at all.
 *
 * Only `target.warmupDays` is consumed today (ticket W7-TODAY, the "Day N of
 * 7" warm-up pill). `DEFAULT_WARMUP_DAYS` mirrors the engine's OWN
 * documented default (`functions/src/config/schema.ts`'s `DEFAULT_CONFIG.
 * target.warmupDays: 7`) and is used ONLY as a fallback if the live document
 * is missing or fails to parse as a positive integer — never as a silent
 * substitute for a real read that succeeded.
 */
const DEFAULT_WARMUP_DAYS = 7;

export type WarmupDaysConfigState =
  | { status: "loading" }
  | { status: "error"; error: FirestoreError }
  | { status: "success"; warmupDays: number };

export function useWarmupDaysConfig(): WarmupDaysConfigState {
  const [state, setState] = useState<WarmupDaysConfigState>({ status: "loading" });

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(getFirebaseDb(), "config", "game"),
      (snapshot) => {
        const data = snapshot.data();
        const target = data?.target as Record<string, unknown> | undefined;
        const raw = target?.warmupDays;
        const warmupDays =
          typeof raw === "number" && Number.isInteger(raw) && raw > 0
            ? raw
            : DEFAULT_WARMUP_DAYS;
        setState({ status: "success", warmupDays });
      },
      (error) => {
        console.error("[useWarmupDaysConfig] query failed", error);
        setState({ status: "error", error });
      },
    );

    return unsubscribe;
  }, []);

  return state;
}
