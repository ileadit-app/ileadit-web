import { httpsCallable } from "firebase/functions";
import { getFunctionsClient } from "./functions";
import {
  toCompetitionMembershipFailure,
  type CompetitionMembershipFailure,
} from "./competitionMembershipErrors";

/**
 * Wrapper for the `joinCompetition` callable
 * (`functions/src/callables/joinCompetition.ts`, engine repo commit
 * `1b8dfda` — deployed, source read directly, unlike `createCompetition.ts`'s
 * unverified contract). Only accepts `competitionId` — the callable derives
 * everything else (`displayName`, `avatarIndex` from the caller's own
 * `users/{uid}` doc; `STARTING_LIVES` from a server constant) server-side,
 * inside one transaction with the player-doc create and the `playerCount`
 * bump (`joinCompetitionService`, `services/competitions.ts:674-731`).
 *
 * **The status gate, verified**: `joinCompetitionService`
 * (`services/competitions.ts:699`) throws `CompetitionNotJoinableError`
 * whenever the competition's `status !== "scheduled"` — active, finalising
 * and finished competitions all refuse a join with the same error. This is
 * the fact `CompetitionDetail`'s CTA state machine is built against; do not
 * render a "Join" button for any status other than `scheduled`.
 *
 * Idempotent: joining a competition you're already in returns
 * `{ joined: false, alreadyMember: true, playerCount }` rather than an
 * error — this wrapper does not need its own "already a member" guard
 * client-side, but the UI should still primarily prevent the click (once
 * membership is known) rather than relying on this idempotency as the UX.
 *
 * NEVER call `httpsCallable(getFunctionsClient(), "joinCompetition")` from a
 * component directly — go through this function.
 */
export interface JoinCompetitionResult {
  joined: boolean;
  alreadyMember: boolean;
  playerCount: number;
}

export type JoinCompetitionOutcome =
  | { status: "success"; result: JoinCompetitionResult }
  | { status: "failure"; failure: CompetitionMembershipFailure };

export async function joinCompetition(competitionId: string): Promise<JoinCompetitionOutcome> {
  const callable = httpsCallable<{ competitionId: string }, JoinCompetitionResult>(
    getFunctionsClient(),
    "joinCompetition",
  );

  try {
    const result = await callable({ competitionId });
    return { status: "success", result: result.data };
  } catch (error) {
    return { status: "failure", failure: toCompetitionMembershipFailure(error) };
  }
}
