import { httpsCallable } from "firebase/functions";
import { getFunctionsClient } from "./functions";
import { toMarkPrizeGivenFailure, type PrizeCallableFailure } from "./prizeErrors";

/**
 * Wrapper for the `markPrizeGiven` callable (PRZ-E2, spec §4.4: "organiser
 * (creator) for perk" — **not deployed** as of 2026-10-27). Takes the
 * winning player's `uid` because a top-3 prize can have up to three
 * separate winners, each marked given independently (spec §3.2's
 * `prizeClaims/{uid}` — one claim document per winner, not one per
 * competition).
 *
 * The spec's own split (§4.4: `markPrizeGiven` for perk, `markPrizeSent`
 * for sponsored physical, ileadit-admin only) is Phase-2-shaped —
 * `markPrizeSent` is deliberately NOT built here, since PRZ-W1 only covers
 * forfeit/perk (Phase 1, no sponsors). This wrapper is used for BOTH
 * forfeit and perk wins in `OrganiserPrizePanel.tsx` — the spec doesn't
 * name a forfeit-specific claim callable, and "mark as given" reads
 * naturally for a forfeit too (the organiser confirms the loser actually
 * did the thing). If the engine ships a forfeit-specific callable instead,
 * this is the one file that needs to change.
 */
export type MarkPrizeGivenOutcome =
  | { status: "success" }
  | { status: "failure"; failure: PrizeCallableFailure };

export async function markPrizeGiven(
  competitionId: string,
  uid: string,
): Promise<MarkPrizeGivenOutcome> {
  const callable = httpsCallable(getFunctionsClient(), "markPrizeGiven");

  try {
    await callable({ competitionId, uid });
    return { status: "success" };
  } catch (error) {
    return { status: "failure", failure: toMarkPrizeGivenFailure(error) };
  }
}
