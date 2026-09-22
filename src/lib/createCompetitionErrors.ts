import type { FunctionsError } from "firebase/functions";

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
 * Page-level copy for a `CreateCompetitionFailure`. `code` drives copy for
 * the handful of outcomes worth explaining specifically (permission,
 * validation, session expiry); everything else falls back to a generic
 * message that still SHOWS `code`/`reason` rather than hiding them, so a
 * refusal this module doesn't have bespoke copy for is still legible and
 * distinct from every other refusal, not folded into one flat sentence.
 */
export function createCompetitionFailureMessage(failure: CreateCompetitionFailure): string {
  const detail = [failure.code, failure.reason].filter(Boolean).join(": ");

  switch (failure.code) {
    case "functions/permission-denied":
      return "You don't have permission to create competitions. If you think this is wrong, email hello@ileadit.co.uk.";
    case "functions/invalid-argument":
      return `Something about this competition isn't valid${detail ? ` (${detail})` : ""}. Check the fields above and try again.`;
    case "functions/unauthenticated":
      return "You've been signed out. Sign in again and try creating this competition once more.";
    case "functions/resource-exhausted":
      return "You've hit a limit on your plan. Contact hello@ileadit.co.uk if you need more room.";
    default:
      return `We couldn't create that competition${detail ? ` (${detail})` : ""}. Please try again, or email hello@ileadit.co.uk if it keeps happening.`;
  }
}
