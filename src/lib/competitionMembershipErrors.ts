import type { FunctionsError } from "firebase/functions";

/**
 * Shared failure surface for `joinCompetition` and `leaveCompetition`
 * (`src/lib/joinCompetition.ts`, `src/lib/leaveCompetition.ts`). Unlike
 * `createCompetitionErrors.ts` (written against an unmerged callable this
 * agent could not read), both callables here ARE deployed and their source
 * was read directly at the `ileadit` engine repo's current commit
 * (`functions/src/callables/joinCompetition.ts`,
 * `functions/src/callables/leaveCompetition.ts` — `1b8dfda`), so this is a
 * closed, verified enum, not a placeholder pending confirmation. Re-read
 * those two files before extending this enum if the engine moves on.
 *
 * Every throw site in both callables, verbatim:
 *   - `unauthenticated` — "Sign in to call the engine." (no `request.auth`)
 *   - `invalid-argument` — zod validation of `{ competitionId: string }`
 *   - `failed-precondition`, message "game config is not seeded" — `loadConfig()`
 *     threw `ConfigNotFoundError`
 *   - `not-found`, message "competition does not exist" — `CompetitionNotFoundError`
 *   - `failed-precondition`, message "competition is not open for joining"
 *     (join) / "competition is not open for leaving" (leave) —
 *     `CompetitionNotJoinableError`, thrown by
 *     `joinCompetitionService`/`leaveCompetitionService`
 *     (`functions/src/services/competitions.ts:699,764`) whenever
 *     `status !== "scheduled"` — this is THE status gate: join/leave succeed
 *     only while a competition is `scheduled`, full stop.
 *   - `failed-precondition`, message "account not created yet - call
 *     ensureAccount first" — `MissingGameStateError` (join only; leave never
 *     throws this because it doesn't require `gameSnap.exists`)
 *
 * Neither callable ever sets `details.reason` (unlike `submitSteps.ts`,
 * which `engineErrors.ts` maps) — every distinction below comes from `code`
 * plus a message-substring check, same technique `engineErrors.ts` already
 * uses for its own message-only case (`missing-game-state`).
 */
export type CompetitionMembershipFailureReason =
  | "not-found"
  | "not-joinable"
  | "missing-game-state"
  | "config-not-seeded"
  | "unauthenticated"
  | "invalid-argument"
  | "unknown";

export interface CompetitionMembershipFailure {
  reason: CompetitionMembershipFailureReason;
  code: FunctionsError["code"] | null;
  message: string;
  /** The original thrown value, for logging — never swallow it. */
  cause: unknown;
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

export function toCompetitionMembershipFailure(error: unknown): CompetitionMembershipFailure {
  if (!isFunctionsError(error)) {
    return {
      reason: "unknown",
      code: null,
      message: error instanceof Error ? error.message : "Something went wrong.",
      cause: error,
    };
  }

  if (error.code === "functions/not-found") {
    return { reason: "not-found", code: error.code, message: error.message, cause: error };
  }
  if (error.code === "functions/unauthenticated") {
    return { reason: "unauthenticated", code: error.code, message: error.message, cause: error };
  }
  if (error.code === "functions/invalid-argument") {
    return { reason: "invalid-argument", code: error.code, message: error.message, cause: error };
  }
  if (error.code === "functions/failed-precondition") {
    if (error.message.includes("is not open for joining") || error.message.includes("is not open for leaving")) {
      return { reason: "not-joinable", code: error.code, message: error.message, cause: error };
    }
    if (error.message.includes("call ensureAccount first")) {
      return { reason: "missing-game-state", code: error.code, message: error.message, cause: error };
    }
    if (error.message.includes("game config is not seeded")) {
      return { reason: "config-not-seeded", code: error.code, message: error.message, cause: error };
    }
  }

  return { reason: "unknown", code: error.code, message: error.message, cause: error };
}

/**
 * Page-level copy. `operation` only changes wording for the two cases where
 * "join" vs "leave" reads naturally differently — everything else is
 * operation-neutral.
 */
export function competitionMembershipFailureMessage(
  failure: CompetitionMembershipFailure,
  operation: "join" | "leave",
): string {
  switch (failure.reason) {
    case "not-joinable":
      return operation === "join"
        ? "You can't join this one any more — it's already under way, wrapping up, or finished."
        : "You can't leave this one any more — once a competition starts, you're in for the duration.";
    case "missing-game-state":
      return "Your account isn't fully set up yet. Sign out and back in, then try again.";
    case "config-not-seeded":
      return "ileadit isn't ready to accept this right now — try again shortly.";
    case "not-found":
      return "This competition doesn't seem to exist any more.";
    case "unauthenticated":
      return "You've been signed out. Sign in again and try once more.";
    case "invalid-argument":
      return "Something went wrong on our end — try reloading the page.";
    default:
      return `Couldn't ${operation === "join" ? "join" : "leave"} that competition — try again, or email hello@ileadit.app if it keeps happening.`;
  }
}
