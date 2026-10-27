"use client";

import { useState } from "react";
import { Gift } from "lucide-react";
import { ErrorBanner } from "@/components/auth/formFields";
import { PrizeSection } from "./PrizeSection";
import {
  EMPTY_PRIZE_FORM_STATE,
  prizeFormHasErrors,
  prizeFormStateFromPrize,
  prizeInputFromFormState,
  validatePrizeForm,
  type Prize,
  type PrizeFieldErrors,
  type PrizeFormState,
} from "@/lib/prize";
import { updateCompetitionPrize, type UpdateCompetitionPrizeOutcome } from "@/lib/updateCompetitionPrize";
import { updateCompetitionPrizeFailureMessage } from "@/lib/prizeErrors";
import type { CompetitionStatus } from "@/lib/competition-status";

/**
 * PRZ-W1 deliverable 2 — organiser-only prize editor for a competition's own
 * page (`CompetitionDetail.tsx`), gated the same way `InvitePanel` already is
 * (caller checks `organiserCapability === "organiser"` before rendering this
 * at all — this component does not re-check that itself).
 *
 * **Edit affordance only exists while `status === "scheduled"`** (spec
 * §4.1: "Prize edits are allowed only while scheduled") — once a competition
 * is `active`/`finalising`, this renders a plain read-only summary (if a
 * prize exists) with no button at all, never a disabled-but-visible edit
 * control (same "a disabled-looking form is a worse signal than a plain
 * summary" reasoning `PrizeSection.tsx`'s own header comment already
 * documents for the started case). The caller (`CompetitionDetail.tsx`)
 * additionally never mounts this at all once `status === "finished"` —
 * `OrganiserPrizePanel.tsx` (W5) takes over entirely at that point, since a
 * finished competition's prize story is about winners/claims, not editing.
 *
 * **No optimistic local prize override.** On a successful save this panel
 * only closes edit mode — it relies entirely on the live `onSnapshot` from
 * `useCompetitionDetail` (the caller re-renders this component with a fresh
 * `prize` prop) to show the saved result. This is a deliberate
 * simplification: the alternative (holding a locally-saved copy until the
 * snapshot catches up) would risk briefly showing two different "truths" if
 * the engine's write and the listener's delivery of it are not perfectly in
 * step. Flagged in the ticket's final report as a known simplification, not
 * an oversight.
 */
export function PrizeEditPanel({
  competitionId,
  status,
  prize,
}: {
  competitionId: string;
  status: CompetitionStatus;
  prize: Prize | null;
}) {
  const [editing, setEditing] = useState(false);
  const [formState, setFormState] = useState<PrizeFormState>(EMPTY_PRIZE_FORM_STATE);
  const [fieldErrors, setFieldErrors] = useState<PrizeFieldErrors>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canEdit = status === "scheduled";

  function startEditing() {
    setFormState(prizeFormStateFromPrize(prize));
    setFieldErrors({});
    setPageError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setFieldErrors({});
    setPageError(null);
  }

  async function handleSave() {
    const validationErrors = validatePrizeForm(formState);
    setFieldErrors(validationErrors);
    if (prizeFormHasErrors(validationErrors)) return;

    setSaving(true);
    setPageError(null);
    const outcome: UpdateCompetitionPrizeOutcome = await updateCompetitionPrize(
      competitionId,
      prizeInputFromFormState(formState) ?? null,
    );
    setSaving(false);

    if (outcome.status === "failure") {
      setPageError(updateCompetitionPrizeFailureMessage(outcome.failure));
      return;
    }

    setEditing(false);
  }

  if (editing) {
    return (
      <div className="mt-4">
        {pageError ? <ErrorBanner message={pageError} /> : null}
        <PrizeSection
          value={formState}
          onChange={setFormState}
          errors={fieldErrors}
          disabled={saving}
          previewTermsHref={`/competitions/${competitionId}/prize-terms`}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-11 items-center justify-center rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold px-5 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed disabled:bg-cta-disabled disabled:text-cta-disabled-foreground"
          >
            {saving ? "Saving…" : "Save prize"}
          </button>
          <button
            type="button"
            onClick={cancelEditing}
            disabled={saving}
            className="inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!prize) {
    // Nothing to show once started and there never was a prize — avoid a
    // placeholder card nobody can act on.
    if (!canEdit) return null;
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/30 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Gift className="size-4 text-brand-gold" aria-hidden="true" />
          No prize set for this competition
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Players always enter for free — a prize is an optional extra incentive.
        </p>
        <button
          type="button"
          onClick={startEditing}
          className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-border px-4 text-sm font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
        >
          Add a prize
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Gift className="size-4 text-brand-gold" aria-hidden="true" />
          {prize.kind === "forfeit" ? "Forfeit" : "Prize"}
        </p>
        {canEdit ? (
          <button
            type="button"
            onClick={startEditing}
            className="inline-flex h-9 items-center justify-center rounded-full border border-border px-4 text-sm font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
          >
            Edit prize
          </button>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">
            This competition has started, so its prize can&apos;t be changed.
          </span>
        )}
      </div>

      <ul role="list" className="mt-3 space-y-2">
        {prize.items.slice(0, prize.places).map((item) => (
          <li key={item.place} className="rounded-xl border border-border bg-background p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {item.place === 1 ? "1st place" : item.place === 2 ? "2nd place" : "3rd place"}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{item.title}</p>
            {item.description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
            ) : null}
          </li>
        ))}
      </ul>

      {prize.adultOnly ? (
        <p className="mt-3 text-xs font-medium text-muted-foreground">Winner must be 18 or over.</p>
      ) : null}
    </div>
  );
}
