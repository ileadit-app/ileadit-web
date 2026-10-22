/**
 * Shared constants/copy for the WEB-CREATE-GUARD interim fix (approved by
 * Paul, 22 Oct 2026), closing audit findings WEB-H5 (every competition
 * created here is PUBLIC — anyone with the app can see and join it; a
 * gated "private competitions" rollout is separate, unbuilt work) and
 * WEB-M6 (past start dates and unbounded durations were being accepted by
 * the form and only caught, inconsistently, by the engine).
 *
 * This is an INTERIM client-side guard, not a redesign: it does not add any
 * new field to the `createCompetition` payload (see `createCompetition.ts`'s
 * strict request body) and does not touch the claim gate
 * (`CreateCompetitionGate.tsx`/`useCanCreateCompetitions.ts`).
 *
 * Centralised here, rather than duplicated inline in both
 * `CreateCompetitionForm.tsx` (client-side validation) and
 * `createCompetitionErrors.ts` (mapping the engine's own re-validation
 * rejection to the same copy), so the two can never silently drift apart —
 * a user who gets past the client check only to have the engine reject the
 * same thing anyway must see the identical sentence either way.
 */

/** Interim cap on competition length. Paul is still confirming 90 as the
 * right number as of this ticket — it may change; this is the ONE place
 * that matters when it does. */
export const MAX_COMPETITION_DAYS = 90;

/** The engine has never accepted anything below this; named here mainly so
 * the "1 to N days" copy below has both ends in one place. */
export const MIN_COMPETITION_DAYS = 1;

export const VISIBILITY_NOTICE =
  "Anyone with the iLeadIt app can see and join this competition. Private competitions aren't available yet.";

export const VISIBILITY_CONFIRM_LABEL =
  "I understand anyone with the app can see and join this competition.";

export const VISIBILITY_CONFIRM_REQUIRED_MESSAGE =
  "Confirm you understand before creating this competition.";

export const START_TIME_IN_PAST_MESSAGE = "Choose a start date and time that isn't in the past.";

export const DURATION_OUT_OF_RANGE_MESSAGE = `A competition can last from ${MIN_COMPETITION_DAYS} to ${MAX_COMPETITION_DAYS} days.`;

/** Shown for any engine `invalid-argument` rejection this module can't
 * confidently attribute to the start-time or duration guard above (see
 * `invalidArgumentFailureMessage` in `createCompetitionErrors.ts`). Never a
 * raw Firebase error code/message. */
export const ENGINE_INVALID_ARGUMENT_FALLBACK_MESSAGE = "We couldn't create the competition. Try again.";

/** `startInstant >= now` is accepted (a start time of exactly "now" isn't
 * worth refusing); only a strictly-past instant is rejected. */
export function isStartTimeInPast(startInstant: Date, now: Date): boolean {
  return startInstant.getTime() < now.getTime();
}

export function isDurationDaysInRange(durationDays: number): boolean {
  return (
    Number.isInteger(durationDays) &&
    durationDays >= MIN_COMPETITION_DAYS &&
    durationDays <= MAX_COMPETITION_DAYS
  );
}
