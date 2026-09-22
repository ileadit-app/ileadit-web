import { Globe, Lock } from "lucide-react";

export type CompetitionVisibility = "public" | "private";

/**
 * Renders EXPLICITLY for both states — never omitted for "public" and never
 * inferred as "no chip = public" — per Paul's PC-8/PC-9 decision: visibility
 * is never hidden or silently implied anywhere in the portal.
 *
 * `resolveCompetitionVisibility` below is the ONE place a `null` (a
 * competition doc that predates this field entirely — created before this
 * ticket shipped, when every competition was, by construction, the
 * public/discoverable kind) is turned into a real value. This is
 * DELIBERATELY different from `CompetitionStatusChip`'s "unknown" status,
 * which must never be guessed (that null is a transient window on a BRAND
 * NEW doc before an async trigger runs). There is no such trigger for
 * visibility — it is set synchronously at create — so null here can only
 * mean "this doc predates the feature," which safely equals "public"
 * because nothing else was ever possible before this ticket.
 *
 * One exception, deliberately NOT routed through this helper:
 * `InvitePreviewAvailable.visibility` (`src/lib/invites.ts`) is OPTIONAL,
 * not nullable — `previewInvite` may not send it yet (engine ticket in
 * progress as of PC-9). `InviteCodeLanding.tsx` renders the chip there only
 * when the field is actually present, rather than defaulting an absent
 * value to "public" the way every other surface in this file does. Do not
 * "simplify" that call site to use this helper — the two absent-value
 * semantics are different on purpose (see that file's own comment).
 */
export function resolveCompetitionVisibility(
  raw: "public" | "private" | null,
): CompetitionVisibility {
  return raw ?? "public";
}

const VISIBILITY_CONFIG: Record<
  CompetitionVisibility,
  { label: string; className: string; icon: typeof Globe }
> = {
  public: {
    label: "Public",
    icon: Globe,
    // Opaque near-white fill + border, muted-foreground text — same pairing
    // (and same 7.52:1 contrast) as CompetitionStatusChip's "finished" state.
    // Deliberately reused: Public is the calm/unremarkable state here, same
    // as Finished is for competition status, and the codebase's own
    // COMPETITION_STATUS_CONFIG header already establishes that a shared
    // colour pairing across states is fine as long as label+icon differ.
    className: "border border-border bg-card text-muted-foreground",
  },
  private: {
    label: "Private",
    icon: Lock,
    // Solid opaque navy fill, white text — ~12.6:1 contrast. Deliberately
    // NOT coral/destructive (private is a deliberate choice, not a warning)
    // and NOT solid gold (reserved for the "Live" status chip and primary
    // CTAs — reusing it here would visually collide with a Live+Private
    // competition showing two solid-gold pills side by side). Distinct from
    // every existing COMPETITION_STATUS_CONFIG pairing.
    className: "bg-brand-navy text-on-navy-foreground",
  },
};

export function CompetitionVisibilityChip({ visibility }: { visibility: CompetitionVisibility }) {
  const config = VISIBILITY_CONFIG[visibility];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${config.className}`}
      title={
        visibility === "private"
          ? "Private — only people with an invite link can join"
          : "Public — anyone in the app can find and join it"
      }
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {config.label}
    </span>
  );
}
