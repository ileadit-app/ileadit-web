import { httpsCallable } from "firebase/functions";
import { getFunctionsClient } from "./functions";
import {
  toCompetitionMembershipFailure,
  type CompetitionMembershipFailure,
} from "./competitionMembershipErrors";

/**
 * Wrapper for the `leaveCompetition` callable
 * (`functions/src/callables/leaveCompetition.ts`, engine repo commit
 * `1b8dfda` — deployed, source read directly). `leaveCompetitionService`
 * (`services/competitions.ts:764`) throws `CompetitionNotJoinableError`
 * whenever `status !== "scheduled"` — once a competition has started there
 * is no "leave" escape hatch client-side; elimination via the daily close
 * job is the only way out (engine design doc §8.3, referenced in the
 * callable's own header comment).
 *
 * **This gate did NOT change under engine ticket JOIN-1** (commit
 * `7629e40`, 21 Sep 2026) — only `joinCompetitionService` was widened to
 * additionally accept an active competition on its own first calendar day
 * (see `joinCompetition.ts`'s header comment and
 * `isDayOneOfActiveCompetition` in `competitionDates.ts`). Join and leave
 * are deliberately asymmetric as of that ticket: a player can join on day
 * one of an active competition but still cannot leave it once it's active,
 * scheduled being the only status this callable ever accepts.
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
