import { httpsCallable } from "firebase/functions";
import { getFunctionsClient } from "./functions";
import { toPreviewPrizeTermsFailure, type PrizeCallableFailure } from "./prizeErrors";
import type { Prize } from "./prize";

/**
 * Wrapper for the `previewPrizeTerms` callable (PRZ-W1-FIX2, 2026-10-27 —
 * built in parallel by the engine side; **not deployed**, source unreadable
 * at the time this was written). Lets the create-competition form show the
 * organiser exactly what their prize's official terms will read like
 * BEFORE the competition exists — the create form has no competition id yet,
 * so unlike `PrizeEditPanel.tsx` (which links to the real, already-generated
 * `/competitions/[id]/prize-terms` page), this generates a one-off preview
 * from the form's own in-progress values.
 *
 * Same "ISO-string startTime, unverified wire format" assumption
 * `createCompetition.ts` already documents and makes for the same reason —
 * re-derive the moment the callable's real source is readable.
 *
 * NEVER call `httpsCallable(getFunctionsClient(), "previewPrizeTerms")`
 * directly from a component — go through `previewPrizeTerms()` here,
 * matching the one-call-site discipline every other callable wrapper in
 * this repo follows.
 */
export interface PreviewPrizeTermsInput {
  name: string;
  startTime: Date;
  durationDays: number;
  timeZone: string;
  prize: Prize;
}

export type PreviewPrizeTermsOutcome =
  | { status: "success"; html: string; approvedTemplateVersion: string | null }
  | { status: "failure"; failure: PrizeCallableFailure };

export async function previewPrizeTerms(input: PreviewPrizeTermsInput): Promise<PreviewPrizeTermsOutcome> {
  const callable = httpsCallable(getFunctionsClient(), "previewPrizeTerms");

  const requestBody = {
    name: input.name,
    // See this file's header comment — ISO string, unverified.
    startTime: input.startTime.toISOString(),
    durationDays: input.durationDays,
    timeZone: input.timeZone,
    prize: input.prize,
  };

  try {
    const result = await callable(requestBody);
    const data = result.data as { html?: unknown; approvedTemplateVersion?: unknown } | undefined;
    return {
      status: "success",
      html: typeof data?.html === "string" ? data.html : "",
      approvedTemplateVersion:
        typeof data?.approvedTemplateVersion === "string" ? data.approvedTemplateVersion : null,
    };
  } catch (error) {
    return { status: "failure", failure: toPreviewPrizeTermsFailure(error) };
  }
}
