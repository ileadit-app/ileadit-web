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
 * **The status gate, updated by engine ticket JOIN-1** (commit `7629e40`,
 * 21 Sep 2026): `joinCompetitionService` (`services/competitions.ts:699`)
 * now throws `CompetitionNotJoinableError` unless the competition is
 * `status === "scheduled"`, OR `status === "active"` AND today (in the
 * competition's own `timeZone`) is exactly its `startDate` — i.e. the
 * competition's own first calendar day. Finalising and finished always
 * refuse; an active competition past day one also still refuses. This is
 * the fact `CompetitionDetail`'s and `InviteLanding`'s CTA state machines
 * are built against — see `isDayOneOfActiveCompetition` in
 * `competitionDates.ts`, the one place that day-one check is implemented.
 * Do not render a "Join" button for any other status/day combination.
 *
 * **A second, separate refusal case, from engine ticket LEAVE-1** (Paul's
 * decision, 2026-09-21, in progress — see `leaveCompetition.ts`'s header
 * comment): once shipped, a player who left this SAME competition while it
 * was active will have their re-join refused too, indistinguishably (at
 * the error-message level) from the day-one-already-passed case above. See
 * the LEAVE-1 TODOs in `competitionMembershipErrors.ts`.
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
