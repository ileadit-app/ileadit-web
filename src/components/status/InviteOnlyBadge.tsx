import { Link2 } from "lucide-react";

/**
 * "Invite only" badge (INVITE-2). Describes the COMPETITION itself (who can
 * join), so it sits beside `CompetitionStatusChip` in the hero, not in a
 * leaderboard row. Same silhouette as the status chip (`rounded-full`,
 * small bold uppercase label, leading icon) and an OPAQUE fill, so it reads
 * on the navy hero and on white cards alike. The label and icon both carry
 * the meaning; colour is never the only signal.
 *
 * Renders only for the boolean `true`. The engine writes `inviteOnly: true`
 * or nothing, and anything else (absent, `false`, the string `"true"`) is a
 * public competition, so the check is `=== true`, never truthiness.
 */
export const INVITE_ONLY_LABEL = "Invite only";

export function InviteOnlyBadge({ inviteOnly }: { inviteOnly: boolean | null | undefined }) {
  if (inviteOnly !== true) return null;
  return (
    <span
      data-testid="invite-only-badge"
      className="inline-flex items-center gap-1.5 rounded-full bg-brand-cream px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-navy"
    >
      <Link2 className="size-3.5 shrink-0" aria-hidden="true" />
      {INVITE_ONLY_LABEL}
    </span>
  );
}
