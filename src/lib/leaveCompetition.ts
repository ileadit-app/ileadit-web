import { httpsCallable } from "firebase/functions";
import { getFunctionsClient } from "./functions";
import {
  toCompetitionMembershipFailure,
  type CompetitionMembershipFailure,
} from "./competitionMembershipErrors";

/**
 * Wrapper for the `leaveCompetition` callable
 * (`functions/src/callables/leaveCompetition.ts`, engine repo commit
 * `1b8dfda` at time of writing — deployed, source read directly).
 * `leaveCompetitionService` (`services/competitions.ts:764`) throws
 * `CompetitionNotJoinableError` whenever `status !== "scheduled"`, at that
 * commit.
 *
 * **This is changing under engine ticket LEAVE-1 (Paul's decision,
 * 2026-09-21, IN PROGRESS — not yet merged as of this writing):** a player
 * will be able to leave an ACTIVE competition too, not just a scheduled
 * one. Leaving an active competition forfeits that player's points in it
 * AND blocks re-joining the same competition afterwards (re-join then
 * refused — see the LEAVE-1 TODOs in `competitionMembershipErrors.ts` for
 * how that refusal is surfaced, since the engine has no distinguishable
 * signal for it yet). Leaving a SCHEDULED competition is unaffected by
 * LEAVE-1 — free, and immediately re-joinable, exactly as before.
 *
 * This wrapper's own code needs no change for LEAVE-1 (it already just
 * forwards whatever the callable decides), but `CompetitionDetail.tsx`'s
 * `MembershipCta` was updated ahead of the engine merge to show "Leave" for
 * BOTH `scheduled` and `active` members, per Paul's decision — meaning a
 * leave attempt on an active competition will genuinely fail with today's
 * still-`scheduled`-only engine until LEAVE-1 actually ships. Re-verify
 * this file's own claims against `functions/src/services/competitions.ts`
 * at whatever engine commit is current before trusting this comment as
 * still accurate, and remove this whole caveat once LEAVE-1 is confirmed
 * merged and deployed.
 *
 * Idempotent: leaving a competition you're not in returns
 * `{ left: false, notMember: true, playerCount }`, not an error.
 *
 * NEVER call `httpsCallable(getFunctionsClient(), "leaveCompetition")` from
 * a component directly — go through this function.
 */
export interface LeaveCompetitionResult {
  left: boolean;
  notMember: boolean;
  playerCount: number;
}

export type LeaveCompetitionOutcome =
  | { status: "success"; result: LeaveCompetitionResult }
  | { status: "failure"; failure: CompetitionMembershipFailure };

export async function leaveCompetition(competitionId: string): Promise<LeaveCompetitionOutcome> {
  const callable = httpsCallable<{ competitionId: string }, LeaveCompetitionResult>(
    getFunctionsClient(),
    "leaveCompetition",
  );

  try {
    const result = await callable({ competitionId });
    return { status: "success", result: result.data };
  } catch (error) {
    return { status: "failure", failure: toCompetitionMembershipFailure(error) };
  }
}
