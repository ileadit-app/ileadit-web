import type { LucideIcon } from "lucide-react";
import { Calendar, CircleHelp, Flag, Hourglass, Zap } from "lucide-react";
import type { CompetitionStatus } from "./competitions";

export type { CompetitionStatus } from "./competitions";

/**
 * Single source of truth for how a competition's status is labelled and
 * styled — ticket W10-STATECHIP. Before this file, `STATUS_LABEL` was
 * declared independently in `CompetitionDetail.tsx` and
 * `CreatedCompetitions.tsx` (word-for-word identical), a THIRD copy lived in
 * `PlayingCompetitions.tsx` (not called out by the ticket brief, found while
 * reading the running code — see this file's own module doc in the ticket's
 * findings for the full list), and a `STATUS_BADGE_CLASSNAME` +
 * `StatusBadge` pair lived in `CreatedCompetitions.tsx` only, imported by
 * nothing outside that file. All four are deleted; every consumer imports
 * from here (`competition-status.ts`) via `CompetitionStatusChip.tsx`.
 *
 * Design source: `automation-hub/docs/ileadit-state-chip-spec-20260920.md`.
 * That spec's decision — ONE enum, ONE component, competition-scoped only —
 * is preserved deliberately: `eliminated`/`warm-up` are NOT statuses of a
 * competition, they're modifiers on a PLAYER (see `player-row-state.ts`),
 * and must never become a fifth/sixth value here.
 */

/**
 * `"unknown"` is a first-class member of this config, not a fallback bolted
 * on afterwards — it exists for exactly the case a fresh `competitions/{id}`
 * document has no `status` yet (the engine's `onCompetitionWritten` trigger
 * derives it asynchronously, a moment after `create`) or a read genuinely
 * failed upstream. `CompetitionStatusChip` maps `status: null` to this case.
 * It must never render as `"scheduled"` or any other real status — this is
 * pinned by a mutation-proven test in `CompetitionStatusChip.test.tsx`.
 */
export type CompetitionStatusOrUnknown = CompetitionStatus | "unknown";

export interface CompetitionStatusConfig {
  label: string;
  icon: LucideIcon;
  /** Background + text (+ border, where the state has one) Tailwind
   * classes. Always an OPAQUE fill (never relies on the surrounding page
   * background showing through) so the SAME chip reads correctly whether
   * it's placed on the dark navy hero (`CompetitionDetail`'s `Hero`) or a
   * white card (`CreatedCompetitions`/`PlayingCompetitions`/
   * `InviteLanding`) — see this file's header in the ticket's findings for
   * the one deliberate deviation from the design spec's literal wording
   * ("finished" is spec'd as a literally transparent fill; implemented here
   * as an opaque near-white fill instead, because a truly transparent chip
   * over the navy hero would show low-contrast muted text directly on
   * navy — contrast ratios computed and recorded in the ticket's findings).
   */
  className: string;
  /** Every state must be distinguishable without colour (WCAG + this
   * project's own W9 audit discipline) — an animated dot is one of three
   * non-colour signals for `active` (the others: solid gold fill direction,
   * and the label itself), not a decoration.
   */
  pulse?: boolean;
  /** `finished`/`unknown` are the only two states with a visible border —
   * "closed" and "indeterminate" are the two states the spec calls out as
   * needing a distinct, lower-energy silhouette from the three solid-fill
   * states. */
  dashed?: boolean;
}

export const COMPETITION_STATUS_CONFIG: Record<CompetitionStatusOrUnknown, CompetitionStatusConfig> = {
  scheduled: {
    label: "Scheduled",
    icon: Calendar,
    // navy text (#192f5f) on the existing light "secondary" fill (#eef0f7)
    // — 11.43:1, verified via the WCAG relative-luminance formula (see
    // ticket findings). Same pairing this codebase already used for this
    // exact state before this extraction.
    className: "bg-secondary text-secondary-foreground",
  },
  active: {
    label: "Live",
    icon: Zap,
    // Solid gold fill, navy text — 6.64:1. The spec's deliberate choice of
    // full-strength fill (not a tint) so "Live" reads as the most
    // energetic state; the pulsing dot is a second, non-colour signal for
    // the same state (motion, not just hue).
    className: "bg-brand-gold text-brand-navy",
    pulse: true,
  },
  finalising: {
    label: "Finalising",
    icon: Hourglass,
    // Inverted fill direction on purpose (spec's own reasoning: this state
    // can last up to 30 hours and must read as *categorically* different
    // from "active", not a paler version of it) — solid navy, gold text,
    // 6.64:1 (the same ratio as `active`, just swapped, since WCAG contrast
    // is symmetric in the two colours).
    className: "bg-brand-navy text-brand-gold",
  },
  finished: {
    label: "Finished",
    icon: Flag,
    // Opaque near-white fill + visible border, muted-foreground text —
    // 7.52:1. See the class-level doc comment above for why this is opaque
    // rather than the spec's literal "transparent" — same visual intent
    // (lowest visual weight of the four, outlined not filled) without a
    // contrast failure on the navy hero.
    className: "border border-border bg-card text-muted-foreground",
  },
  unknown: {
    label: "Status unavailable",
    icon: CircleHelp,
    // Distinct dashed border + a label that can never be mistaken for a
    // real status (never "Scheduled") — "fail loud, not fail quiet" is the
    // spec's own framing for this state. 6.32:1.
    className: "border border-dashed border-border bg-muted text-muted-foreground",
    dashed: true,
  },
};
