import type { FunctionsError } from "firebase/functions";

/**
 * The engine's typed failure reasons this web client knows how to
 * recognise, read verbatim from `functions/src/callables/*.ts` in the
 * ileadit engine repo at commit `c91f9e3` (never guessed) - the same set
 * the Android client's `EngineFailure` mirrors, so both clients fail
 * identically for identical causes:
 *
 *   - `not-seeded`          — submitSteps.ts: history not seeded yet, thrown
 *                              as `failed-precondition` with
 *                              `details.reason: "not-seeded"`. Fix: call
 *                              `seedHistory` first.
 *   - `date-out-of-window`  — submitSteps.ts: `failed-precondition` with
 *                              `details.reason: "date-out-of-window"`. The
 *                              submitted date is not the day awaiting close
 *                              or the day after it. Not retryable with the
 *                              same input.
 *   - `day-not-open`        — submitSteps.ts: `failed-precondition` with
 *                              `details.reason: "day-not-open"`. The day
 *                              exists but the engine isn't accepting steps
 *                              for it right now.
 *   - `resource-exhausted`  — submitSteps.ts: server-side rate limit (60
 *                              submissions/day), thrown as the
 *                              `resource-exhausted` FunctionsErrorCode
 *                              itself (not `failed-precondition`), with
 *                              `details.reason: "rate-limited"`.
 *   - `missing-game-state`  — `MissingGameStateError` (services/ledger.ts):
 *                              `users/{uid}/private/game` does not exist.
 *                              Thrown by submitSteps.ts AND joinCompetition.ts
 *                              as a bare `failed-precondition` with message
 *                              "account not created yet - call ensureAccount
 *                              first" and, notably, NO `details.reason` key
 *                              at all - it is detected by message content
 *                              below because the engine gives it none.
 *
 * None of these are thrown by `ensureAccount` itself (it is the fix for
 * `missing-game-state`, not a source of it) - this module is shared
 * groundwork for `submitSteps`/`joinCompetition`, neither of which this
 * ticket wires up to any UI (no `/competitions/new`, no step-sync surface
 * exists yet). It exists now so the FIRST caller of those callables reuses
 * one correct mapping instead of inventing error handling ad hoc.
 */
export type EngineFailureReason =
  | "not-seeded"
  | "date-out-of-window"
  | "day-not-open"
  | "resource-exhausted"
  | "missing-game-state";

export interface EngineFailure {
  reason: EngineFailureReason;
  message: string;
  /** The original FunctionsError, for logging - never swallow it. */
  cause: FunctionsError;
}

function isFunctionsError(error: unknown): error is FunctionsError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    (error as { code: string }).code.startsWith("functions/")
  );
}

/**
 * Maps a thrown callable error to one of the five typed engine failures
 * above, or returns `null` when it is none of them.
 *
 * Callers MUST handle the `null` case explicitly - rethrow it, show a
 * generic error, log it - never treat `null` as "no error" or coerce it
 * into a default success-shaped value. `null` means "this is a REAL error
 * this module does not have a specific mapping for," not "everything is
 * fine."
 */
export function toEngineFailure(error: unknown): EngineFailure | null {
  if (!isFunctionsError(error)) return null;

  const details = error.details as { reason?: string } | undefined;
  const reason = details?.reason;

  if (error.code === "functions/failed-precondition") {
    if (reason === "not-seeded") {
      return { reason: "not-seeded", message: error.message, cause: error };
    }
    if (reason === "date-out-of-window") {
      return { reason: "date-out-of-window", message: error.message, cause: error };
    }
    if (reason === "day-not-open") {
      return { reason: "day-not-open", message: error.message, cause: error };
    }
    // MissingGameStateError: no details.reason exists for this one in the
    // engine (submitSteps.ts / joinCompetition.ts both throw a bare
    // failed-precondition) - message content is the only signal available.
    if (error.message.includes("call ensureAccount first")) {
      return { reason: "missing-game-state", message: error.message, cause: error };
    }
    // A failed-precondition this module does not recognise (e.g. "game
    // config is not seeded", or "competition is not open for joining") is
    // deliberately NOT mapped here - it is a real error, not one of the
    // five typed reasons, and falls through to `return null` below so the
    // caller still sees it rather than mistaking it for one of these five.
  }

  if (error.code === "functions/resource-exhausted") {
    return { reason: "resource-exhausted", message: error.message, cause: error };
  }

  return null;
}
