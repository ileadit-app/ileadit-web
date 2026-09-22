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
 *     (`functions/src/services/competitions.ts:699,764`). **The two gates
 *     diverged under engine ticket JOIN-1 (commit `7629e40`, 21 Sep 2026)**:
 *     `leaveCompetitionService` is unchanged (`status !== "scheduled"`
 *     always refuses — leave only while scheduled, full stop), but
 *     `joinCompetitionService` now also accepts `status === "active"` on
 *     the competition's own first calendar day (its `startDate`, checked in
 *     its own `timeZone`) — see `isDayOneOfActiveCompetition` in
 *     `src/lib/competitionDates.ts`, the one client-side place that mirrors
 *     this half of the gate. This error code/message pair is identical for
 *     both callables; only the caller's own pre-check (before even
 *     attempting the call) differs.
 *   - `failed-precondition`, message "account not created yet - call
 *     ensureAccount first" — `MissingGameStateError` (join only; leave never
 *     throws this because it doesn't require `gameSnap.exists`)
 *
 * Neither callable ever sets `details.reason` (unlike `submitSteps.ts`,
 * which `engineErrors.ts` maps) — every distinction below comes from `code`
 * plus a message-substring check, same technique `engineErrors.ts` already
 * uses for its own message-only case (`missing-game-state`).
 *
 * **PC-9 contract corrections (2026-09-23, engine branch
 * `engine/pc1-visibility`, NOT deployed — overrides the design doc's own
 * guesses, which flagged these exact strings as unverified):**
 *   - Joining a PRIVATE competition without an invite: `HttpsError` code
 *     **`permission-denied`**, `details.reason === "competition-private"`.
 *     This is the one place either callable DOES set `details.reason` — a
 *     genuinely new shape for this file, not a message-substring case.
 *   - The one-active-competition-at-a-time overlap refusal (engine ticket
 *     in progress): code **`failed-precondition`**,
 *     `details.reason === "overlapping-competition"`. Distinguished from the
 *     existing JOIN-1 "not joinable" `failed-precondition` (which never sets
 *     `details.reason`) by checking `details.reason` FIRST, before falling
 *     through to the message-substring checks below.
 */
export type CompetitionMembershipFailureReason =
  | "not-found"
  | "not-joinable"
  | "missing-game-state"
  | "config-not-seeded"
  | "unauthenticated"
  | "invalid-argument"
  | "competition-private"
  | "overlapping-competition"
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
  if (error.code === "functions/permission-denied") {
    const details = error.details as { reason?: unknown } | undefined;
    if (details?.reason === "competition-private") {
      return { reason: "competition-private", code: error.code, message: error.message, cause: error };
    }
  }
  if (error.code === "functions/failed-precondition") {
    const details = error.details as { reason?: unknown } | undefined;
    if (details?.reason === "overlapping-competition") {
      return { reason: "overlapping-competition", code: error.code, message: error.message, cause: error };
    }
    // TODO(LEAVE-1): once the engine ships a distinguishable signal (a
    // distinct `details.reason`, or a message that names this case
    // specifically) for "this player left this competition while it was
    // active and is blocked from re-joining," split that out into its own
    // `CompetitionMembershipFailureReason` (e.g. "left-cannot-rejoin") with
    // its own copy — Paul's decision names the exact wording:
    // "You left this competition and can't re-join it." Until LEAVE-1
    // lands, `leaveCompetitionService`/`joinCompetitionService` both throw
    // the SAME generic "not open for joining"/"not open for leaving"
    // message for every refusal reason (already-active-past-day-one,
    // finalising, finished, AND — once LEAVE-1 ships — previously left),
    // so there is no message-substring or code to key off yet. Re-read
    // `functions/src/services/competitions.ts` at whatever engine commit
    // is current before assuming this is still true.
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
      // TODO(LEAVE-1): once the engine can distinguish "you left this one
      // while it was active" from the other refusal causes (see the
      // matching TODO in `toCompetitionMembershipFailure` above), split
      // that out to Paul's exact copy: "You left this competition and
      // can't re-join it." Until then this generic wording has to cover
      // that case too, since the callable's own error is indistinguishable
      // from "already under way"/"finalising"/"finished" today.
      return operation === "join"
        ? "You can't join this one any more — it's already under way, wrapping up, finished, or you've already left it."
        : "You can't leave this one any more.";
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
    case "competition-private":
      return "This is a private competition — you'll need an invite link to join it.";
    case "overlapping-competition":
      return operation === "join"
        ? "You're already in another active competition, and ileadit only allows one at a time. Leave that one first if you want to switch."
        : "You're already in another active competition.";
    default:
      return `Couldn't ${operation === "join" ? "join" : "leave"} that competition — try again, or email hello@ileadit.co.uk if it keeps happening.`;
  }
}
