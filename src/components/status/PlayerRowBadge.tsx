import { PLAYER_ROW_STATE_CONFIG, type PlayerRowState } from "@/lib/player-row-state";

/**
 * The player-scoped modifier badge — `eliminated` or `warm-up`. See
 * `player-row-state.ts` for why these two share ONE component instead of
 * being folded into `CompetitionStatusChip`'s competition-scoped enum.
 *
 * Deliberately `rounded-md`, never `rounded-full` — a different silhouette
 * from `CompetitionStatusChip` on purpose, so the two component families
 * are never mistaken for each other even at a glance, colourblind or not
 * (the spec's own colourblind/no-colour check).
 *
 * `state={null}` renders nothing. Per the spec: "absence of a badge is
 * itself meaningful: still competing, nothing to report" — an empty/ghost
 * badge for the no-state case would just be a sixth state pretending to be
 * a non-state, so callers should conditionally render this component
 * itself (or pass `null`) rather than this component inventing a blank
 * placeholder visual.
 */
export function PlayerRowBadge({ state }: { state: PlayerRowState | null }) {
  if (state === null) {
    return null;
  }

  const config = PLAYER_ROW_STATE_CONFIG[state];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${config.className}`}
    >
      <Icon className={`size-3 shrink-0 ${config.iconClassName ?? ""}`} aria-hidden="true" />
      {config.label}
    </span>
  );
}
