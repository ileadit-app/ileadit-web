import type { LucideIcon } from "lucide-react";
import { Flag, Shield } from "lucide-react";

/**
 * Player-scoped modifiers — deliberately NOT competition status. Ticket
 * W10-STATECHIP's spec (`automation-hub/docs/ileadit-state-chip-spec-
 * 20260920.md`) draws this line on purpose: `eliminated` is an outcome
 * scoped to one player IN one competition; `warm-up` is a protection scoped
 * to one player's ACCOUNT, independent of any competition. They're
 * different in cause but identical in *shape* — both are "something true
 * about this specific player that isn't the competition's status" — which
 * is why they share ONE component (`PlayerRowBadge`, variant prop) instead
 * of either becoming a fifth/sixth value of `CompetitionStatusOrUnknown`
 * (`competition-status.ts`). Collapsing them into that enum would force a
 * leaderboard row to pass a competition-scoped value down into what is
 * actually a per-player fact — the re-decision this ticket exists to stop.
 *
 * `warm-up` has NO live call site among the five components this ticket
 * touches, and is not wired up anywhere new by this ticket. Per the
 * project's own accumulated finding on `src/lib/leaderboardRank.ts`:
 * `competitions/{cid}/players/{uid}` (the one doc a fellow member can read)
 * has no warm-up field at all, and the only warm-up field that exists
 * (`users/{uid}/private/game.warmupEndsOn`) is owner-read only — there is no
 * rules-legal way to show warm-up on anyone's row but the viewer's OWN.
 * `TodayCard.tsx` already renders an own-row warm-up indicator (with a
 * "Day N of M" count `PlayerRowBadge`'s static label doesn't carry) — that
 * is a different, richer, already-correct piece of UI and is intentionally
 * NOT replaced by this component; this variant exists so a future
 * leaderboard-row-shaped warm-up indicator (if one ever becomes legal to
 * build) has a home without re-deriving this component from scratch.
 */
export type PlayerRowState = "eliminated" | "warm-up";

export interface PlayerRowStateConfig {
  label: string;
  icon: LucideIcon;
  /** Background + text + border Tailwind classes for the badge shell
   * (the label text inherits its colour from here). */
  className: string;
  /** Icon-only colour override — only needed when the icon's colour must
   * differ from the label text colour (see `warm-up` below). Omitted means
   * the icon inherits the badge's own text colour via `currentColor`. */
  iconClassName?: string;
}

export const PLAYER_ROW_STATE_CONFIG: Record<PlayerRowState, PlayerRowStateConfig> = {
  eliminated: {
    label: "Out — final score locked in",
    icon: Flag,
    // Full-strength coral fill, white text — 4.51:1 (WCAG-computed, see
    // ticket findings), NOT muted/greyed. Carries through the W5 leaderboard
    // design decision verbatim: this reads as a STATE, not a penalty — no
    // strikethrough, no left-border stripe, same font-weight as an
    // unbadged row, and the player's points stay fully visible next to it
    // (enforced by the callers, `CompetitionLeaderboard.tsx`, never by this
    // component hiding anything).
    className: "bg-brand-coral text-primary-foreground",
  },
  "warm-up": {
    label: "Protected",
    icon: Shield,
    // Outline-only, never filled — deliberately the one collision point
    // with gold shared with `CompetitionStatusChip`'s `active` state,
    // resolved by shape (rounded-md outline here vs. that chip's
    // rounded-full solid fill), a distinct icon, and an always-visible
    // label. Text is navy, not gold, on purpose: gold text at this badge's
    // small size measures 1.96:1 against a white/card background (WCAG-
    // computed, see ticket findings) — well under the 4.5:1 text minimum.
    // Navy carries the actual meaning at 13:1; gold stays as the accent
    // colour on the border and icon only, both explicitly non-load-bearing
    // per the spec's own "icon is never load-bearing alone" rule.
    className: "border border-brand-gold text-brand-navy",
    iconClassName: "text-brand-gold",
  },
};
