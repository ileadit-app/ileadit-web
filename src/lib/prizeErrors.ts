import type { FunctionsError } from "firebase/functions";

/**
 * Failure surface for the `updateCompetitionPrize` and `markPrizeGiven`
 * callables (PRZ-E1/E2, spec §4.1/§4.4 — **not deployed** as of 2026-10-27,
 * source unreadable). Same discipline as `createCompetitionErrors.ts`: keep
 * `code` (the real `FunctionsErrorCode`) and `reason` (`details.reason`,
 * verbatim, possibly `null`) as separate fields rather than inventing a
 * closed enum of reason strings nobody has confirmed. Re-derive real
 * reason strings from source the moment either callable is readable.
 *
 * One shared failure shape, two separate message functions — the shape is
 * identical between the two callables (nothing here is specific to either),
 * but the right COPY for a failed prize edit ("we couldn't save your prize
 * changes") is not the right copy for a failed "mark as given" action
 * ("we couldn't mark this prize as given"), so each gets its own
 * `<x>FailureMessage` function rather than a shared generic one that would
 * blur the two actions together.
 */
export interface PrizeCallableFailure {
  code: FunctionsError["code"] | null;
  reason: string | null;
  message: string;
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

function toPrizeCallableFailure(error: unknown, fallbackMessage: string): PrizeCallableFailure {
  if (!isFunctionsError(error)) {
    return {
      code: null,
      reason: null,
      message: error instanceof Error ? error.message : fallbackMessage,
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

export function toUpdateCompetitionPrizeFailure(error: unknown): PrizeCallableFailure {
  return toPrizeCallableFailure(error, "Something went wrong saving your prize changes.");
}

export function toMarkPrizeGivenFailure(error: unknown): PrizeCallableFailure {
  return toPrizeCallableFailure(error, "Something went wrong marking this prize as given.");
}

/** PRZ-W1-FIX2 — the `previewPrizeTerms` callable (built in parallel by the
 * engine side, source unreadable at the time this was written; same
 * "unverified, flagged not hidden" discipline as every other callable
 * wrapper in this file). Shares `PrizeCallableFailure`'s shape — nothing
 * about this failure surface is specific to preview vs. save. */
export function toPreviewPrizeTermsFailure(error: unknown): PrizeCallableFailure {
  return toPrizeCallableFailure(error, "Something went wrong generating a preview of these terms.");
}

/**
 * Page-level copy for a failed `updateCompetitionPrize` call. Includes a
 * bespoke `failed-precondition` case for the one rejection the spec names
 * explicitly (§4.1: "Prize edits are allowed only while scheduled") —
 * matched via substring on `reason`/`message` (same technique
 * `createCompetitionGuard.ts`'s error-mapping side already uses for an
 * unverified callable: match on substance, never interpolate the raw
 * Firebase text into user-facing copy).
 */
export function updateCompetitionPrizeFailureMessage(failure: PrizeCallableFailure): string {
  const detail = [failure.code, failure.reason].filter(Boolean).join(": ");
  const haystack = `${failure.reason ?? ""} ${failure.message}`.toLowerCase();

  switch (failure.code) {
    case "functions/permission-denied":
      return "You don't have permission to change this competition's prize. If you think this is wrong, email hello@ileadit.co.uk.";
    case "functions/failed-precondition":
      if (haystack.includes("scheduled") || haystack.includes("start")) {
        return "This competition has already started, so its prize can no longer be changed.";
      }
      return `We couldn't save your prize changes${detail ? ` (${detail})` : ""}. Please try again.`;
    case "functions/invalid-argument":
      return `Something about this prize isn't valid${detail ? ` (${detail})` : ""}. Check the fields above and try again.`;
    case "functions/unauthenticated":
      return "You've been signed out. Sign in again and try saving your prize changes once more.";
    default:
      return `We couldn't save your prize changes${detail ? ` (${detail})` : ""}. Please try again, or email hello@ileadit.co.uk if it keeps happening.`;
  }
}

/** Page-level copy for a failed `previewPrizeTerms` call. Shown next to the
 * "Preview prize terms" trigger, not the page-level `pageError` banner used
 * for a failed competition submission — the two failures are unrelated
 * actions and must never share one message slot. */
export function previewPrizeTermsFailureMessage(failure: PrizeCallableFailure): string {
  const detail = [failure.code, failure.reason].filter(Boolean).join(": ");

  switch (failure.code) {
    case "functions/permission-denied":
      return "You don't have permission to preview these terms. If you think this is wrong, email hello@ileadit.co.uk.";
    case "functions/invalid-argument":
      return `Something about this prize isn't valid${detail ? ` (${detail})` : ""}. Check the fields above and try again.`;
    case "functions/unauthenticated":
      return "You've been signed out. Sign in again and try previewing the terms once more.";
    default:
      return `We couldn't generate a preview of these terms${detail ? ` (${detail})` : ""}. Please try again, or email hello@ileadit.co.uk if it keeps happening.`;
  }
}

/** Page-level copy for a failed `markPrizeGiven` call. */
export function markPrizeGivenFailureMessage(failure: PrizeCallableFailure): string {
  const detail = [failure.code, failure.reason].filter(Boolean).join(": ");

  switch (failure.code) {
    case "functions/permission-denied":
      return "You don't have permission to mark this prize as given. If you think this is wrong, email hello@ileadit.co.uk.";
    case "functions/failed-precondition":
      return `This prize can't be marked as given right now${detail ? ` (${detail})` : ""}.`;
    case "functions/unauthenticated":
      return "You've been signed out. Sign in again and try again.";
    default:
      return `We couldn't mark this prize as given${detail ? ` (${detail})` : ""}. Please try again, or email hello@ileadit.co.uk if it keeps happening.`;
  }
}
