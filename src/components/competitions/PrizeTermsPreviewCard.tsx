"use client";

import { ArrowLeft, FileText, Info } from "lucide-react";
import { PrizeTermsView } from "./PrizeTerms";
import type { CompetitionTermsDoc } from "@/lib/competitionTerms";

/**
 * PRZ-W1-FIX2 — the create-competition form's inline "Preview prize terms"
 * card and the full preview it swaps in. This is a DIFFERENT mechanism from
 * `PrizeSection.tsx`'s own `previewTermsHref` link (used by `PrizeEditPanel`):
 * the create form has no competition id yet, so there is nothing to link to
 * — instead this calls the `previewPrizeTerms` callable (`@/lib/
 * previewPrizeTerms`) with the form's own in-progress values and renders the
 * result inline, reusing `PrizeTermsView` (the same sanitised renderer the
 * real public `/competitions/[id]/prize-terms` page uses) so a preview can
 * never drift from how the real page would actually render the same HTML.
 *
 * Ported verbatim (markup + classes) from the approved v0 design's
 * `PreviewTermsLink` (trigger) and `PrizeTerms`'s top bar
 * (`.ticket-refs/prizes/v0-web/components/competitions/{PrizeSection,
 * PrizeTerms}.tsx`) — the trigger becomes a `<button>` instead of an `<a>`
 * since it triggers a callable call and a local view swap, not navigation.
 *
 * PRZ-W1-FIX3 — the trigger's two lines (the button itself, then the muted
 * "Written for you..." helper line) are forced onto separate lines with a
 * fixed `flex-col`, not `flex flex-wrap` (the FIX2 shape, which only wrapped
 * once the viewport got narrow — the design always shows two lines, even at
 * 1280px, so wrapping must not be conditional on available width here).
 */
export function PrizeTermsPreviewTrigger({
  onPreview,
  disabled,
  pending,
}: {
  onPreview: () => void;
  /** True once the form doesn't yet have enough to preview (name, start,
   * duration, time zone, and a valid enabled prize) OR a preview request is
   * already in flight. Uses the established "disabled style, never opacity"
   * convention (`disabled:text-muted-foreground`, see `CompetitionDetail.tsx`'s
   * own text-link-style buttons) rather than `disabled:opacity-*`. */
  disabled: boolean;
  pending: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card px-4 py-3">
      <button
        type="button"
        onClick={onPreview}
        disabled={disabled}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-navy underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:no-underline"
      >
        <FileText className="size-4" aria-hidden="true" />
        {pending ? "Loading preview…" : "Preview prize terms"}
      </button>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Info className="size-3.5 shrink-0" aria-hidden="true" />
        Written for you from this form. Check them before you publish.
      </span>
    </div>
  );
}

/**
 * The "you're looking at a preview" bar + the actual rendered terms, shown
 * in place of the create form while a preview is active. `terms` is built
 * by the caller from the callable's `{ html, approvedTemplateVersion }`
 * response (see `CreateCompetitionForm.tsx`) — `PrizeTermsView` itself
 * already shows the draft-not-approved notice whenever
 * `approvedTemplateVersion === "DRAFT-NOT-APPROVED"`, so that case needs no
 * handling here.
 */
export function PrizeTermsPreviewPane({
  terms,
  onBack,
}: {
  terms: CompetitionTermsDoc;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="flex flex-col gap-3 rounded-2xl border border-brand-gold/40 bg-brand-gold/15 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm font-semibold text-foreground">
          <FileText className="mt-0.5 size-4 shrink-0 text-brand-navy" aria-hidden="true" />
          Preview only. These terms are written from your form and go live when you publish.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-secondary px-5 text-sm font-bold text-secondary-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the form
        </button>
      </div>

      <PrizeTermsView terms={terms} />
    </div>
  );
}
