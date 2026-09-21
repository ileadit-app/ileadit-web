import {
  COMPETITION_STATUS_CONFIG,
  type CompetitionStatus,
} from "@/lib/competition-status";
import { isCompetitionStartingToday } from "@/lib/competitionDates";

/**
 * The ONE competition-scoped status chip — ticket W10-STATECHIP. Renders
 * wherever the competition ITSELF is being described (the detail page's
 * hero, the card in `CreatedCompetitions`/`PlayingCompetitions`,
 * `InviteLanding`) — never inside a leaderboard row, which is a
 * player-scoped fact and belongs to `PlayerRowBadge` instead (see that
 * component's own doc comment for the full reasoning this ticket's spec
 * gives for keeping the two separate).
 *
 * `status={null}` (a competition doc that hasn't had its `status` field
 * derived yet by the engine's `onCompetitionWritten` trigger, or a caller
 * that simply doesn't have a resolved value yet) renders the `"unknown"`
 * config — NEVER silently falls back to `"scheduled"` or any other real
 * status. Pinned by `CompetitionStatusChip.test.tsx`'s MUT-UNKNOWN-NOT-SCHEDULED.
 *
 * Icon + label are always both present — every state in
 * `COMPETITION_STATUS_CONFIG` is distinguishable by fill/border/shape AND by
 * a unique label string, so colour is never the only signal (WCAG + this
 * repo's W9 accessibility-audit discipline, carried into this component
 * rather than reapplied around it).
 *
 * WEB-3 item 3: `startDate`/`timeZone` are optional and, when both are
 * provided alongside `status === "scheduled"`, enable a COPY-ONLY "Starting
 * today" label override for the lag window between a competition's real
 * start moment and the engine's own asynchronous status derivation — see
 * `isCompetitionStartingToday`'s doc comment in `competitionDates.ts`. This
 * never changes `config.className`/`config.icon`/`config.pulse` — visually
 * it is still exactly the `scheduled` chip, only the word changes. Callers
 * with no competition to describe yet (`InviteLanding.tsx`'s signed-out,
 * not-found and generic-error states) simply omit both props.
 */
export function CompetitionStatusChip({
  status,
  startDate = null,
  timeZone = null,
  now,
}: {
  status: CompetitionStatus | null;
  startDate?: string | null;
  timeZone?: string | null;
  /** Test-only override for "now" — real call sites never pass this. */
  now?: Date;
}) {
  const config = COMPETITION_STATUS_CONFIG[status ?? "unknown"];
  const Icon = config.icon;
  const label =
    status === "scheduled" && isCompetitionStartingToday(startDate, timeZone, now)
      ? "Starting today"
      : config.label;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${config.className}`}
    >
      {config.pulse ? (
        <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-brand-navy" aria-hidden="true" />
      ) : (
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      )}
      {label}
    </span>
  );
}
