import type { FunctionsError } from "firebase/functions";
import {
  DURATION_OUT_OF_RANGE_MESSAGE,
  ENGINE_INVALID_ARGUMENT_FALLBACK_MESSAGE,
  START_TIME_IN_PAST_MESSAGE,
} from "./createCompetitionGuard";

/**
 * Failure surface for the `createCompetition` callable (P1.3, Ivor, branch
 * `engine/p1-create-competition` as of 2026-09-20 — **not deployed**, and
 * this module was written against the P1.4 ticket's description of the
 * contract, not by reading the callable's source, because that source
 * isn't merged anywhere this agent can read it).
 *
 * Unlike `engineErrors.ts` / `authErrors.ts`, this module deliberately does
 * NOT enumerate a closed set of real `details.reason` strings — nobody has
 * confirmed what they are yet. What it does instead, per the P1.4 ticket's
 * explicit instruction ("surface them distinctly... do not collapse them
 * to one message"), is keep `code` (the standard `FunctionsErrorCode` —
 * `invalid-argument`, `permission-denied`, `failed-precondition`, etc.) and
 * `reason` (whatever `details.reason` says, verbatim, never guessed) as
 * SEPARATE fields, so a caller can branch on `code` today and gains
 * `reason` for free the moment the callable starts sending one.
 *
 * When Ivor's callable ships and its source is readable, re-derive the real
 * reason strings from it (the same way `engineErrors.ts`'s header comment
 * cites exact source lines) and consider upgrading this to a closed enum
 * matching that pattern.
 */
export interface CreateCompetitionFailure {
  /** The Functions SDK's own error code, e.g. `"functions/invalid-argument"`.
   * `null` when the thrown value wasn't a `FunctionsError` at all (a plain
   * network exception, for instance). */
  code: FunctionsError["code"] | null;
  /** Verbatim `details.reason`, if the callable sent one. Never guessed. */
  reason: string | null;
  message: string;
  /** The original error, for logging — never swallow it. */
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

export function toCreateCompetitionFailure(error: unknown): CreateCompetitionFailure {
  if (!isFunctionsError(error)) {
    return {
      code: null,
      reason: null,
      message: error instanceof Error ? error.message : "Something went wrong creating that competition.",
      cause: error,
    };
  }

  const details = error.details as { reason?: unknown } | undefined;
  return {
    code: error.code,
    reason: typeof details?.reason === "string" ? details.reason : null,
    message: error.message,
    cause: error,
  };
}

/**
 * Maps an engine `invalid-argument` rejection to ONE of the same two
 * friendly, inline messages `CreateCompetitionForm`'s own client-side
 * `validate()` already shows for a past start time / an out-of-range
 * duration (WEB-CREATE-GUARD, WEB-M6) — never the raw `code`/`reason`/
 * `message` the Functions SDK attaches to the thrown error.
 *
 * Nobody has read (or can read — it isn't merged, see this file's own
 * header comment) the callable's actual `details.reason` strings, so this
 * matches defensively on substrings of whatever `reason`/`message` IS
 * present rather than assuming a closed enum. Anything that doesn't match
 * either known shape — including a bare `invalid-argument` with no
 * identifying detail at all — gets the neutral fallback, never a guess.
 */
function invalidArgumentFailureMessage(failure: CreateCompetitionFailure): string {
  const haystack = `${failure.reason ?? ""} ${failure.message}`.toLowerCase();
  if (haystack.includes("start") || haystack.includes("past")) {
    return START_TIME_IN_PAST_MESSAGE;
  }
  if (haystack.includes("duration") || haystack.includes("days")) {
    return DURATION_OUT_OF_RANGE_MESSAGE;
  }
  return ENGINE_INVALID_ARGUMENT_FALLBACK_MESSAGE;
}

/**
 * Page-level copy for a `CreateCompetitionFailure`. `code` drives copy for
 * the handful of outcomes worth explaining specifically (permission,
 * validation, session expiry); everything else falls back to a generic,
 * fixed message. Per WEB-CREATE-GUARD: never interpolate the raw
 * `code`/`reason` string into anything shown on screen — that's real
 * Firebase/Functions SDK text (e.g. literally `"functions/invalid-
 * argument"`), not a message written for a user.
 */
export function createCompetitionFailureMessage(failure: CreateCompetitionFailure): string {
  switch (failure.code) {
    case "functions/permission-denied":
      return "You don't have permission to create competitions. If you think this is wrong, email hello@ileadit.co.uk.";
    case "functions/invalid-argument":
      return invalidArgumentFailureMessage(failure);
    case "functions/unauthenticated":
      return "You've been signed out. Sign in again and try creating this competition once more.";
    case "functions/resource-exhausted":
      return "You've hit a limit on your plan. Contact hello@ileadit.co.uk if you need more room.";
    default:
      return "We couldn't create that competition. Please try again, or email hello@ileadit.co.uk if it keeps happening.";
  }
}
