import { httpsCallable } from "firebase/functions";
import { getFunctionsClient } from "./functions";
import { toUpdateCompetitionPrizeFailure, type PrizeCallableFailure } from "./prizeErrors";
import type { Prize } from "./prize";

/**
 * Wrapper for the `updateCompetitionPrize` callable (PRZ-E1, spec §4.1 —
 * **not deployed** as of 2026-10-27, built strictly from the spec
 * document's field list, not from readable source). Lets the creator/admin
 * change or remove a competition's prize while it is still `scheduled`
 * (spec §4.1: "Prize edits are allowed only while scheduled" — enforced
 * server-side; `PrizeEditPanel.tsx` also hides the editor once a
 * competition is no longer `scheduled`, but that is a UX nicety, not the
 * real boundary).
 *
 * `prize: null` is a deliberate, distinct request shape from omitting the
 * field — it means "remove the prize this competition currently has",
 * matching `competitions/{cid}.prize` itself being nullable (spec §3.1:
 * "`prize` (null or object...)"). Never send `undefined` to mean removal;
 * always send `null`.
 *
 * NEVER call `httpsCallable(getFunctionsClient(), "updateCompetitionPrize")`
 * directly from a component — go through `updateCompetitionPrize()` here,
 * matching the one-call-site discipline every other callable wrapper in
 * this repo already follows.
 */
export type UpdateCompetitionPrizeOutcome =
  | { status: "success" }
  | { status: "failure"; failure: PrizeCallableFailure };

export async function updateCompetitionPrize(
  competitionId: string,
  prize: Prize | null,
): Promise<UpdateCompetitionPrizeOutcome> {
  const callable = httpsCallable(getFunctionsClient(), "updateCompetitionPrize");

  try {
    await callable({ competitionId, prize });
    return { status: "success" };
  } catch (error) {
    return { status: "failure", failure: toUpdateCompetitionPrizeFailure(error) };
  }
}
