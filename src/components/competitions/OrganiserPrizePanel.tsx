"use client";

import { useState } from "react";
import { Gift, CheckCircle2 } from "lucide-react";
import { ErrorBanner } from "@/components/auth/formFields";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PlayerAvatar } from "./PlayerAvatar";
import type { Prize, PrizeWinner } from "@/lib/prize";
import type { LeaderboardState } from "@/lib/competitionDetail";
import { findClaimForUid, usePrizeClaims, type PrizeClaim, type PrizeClaimStatus } from "@/lib/prizeClaims";
import { markPrizeGiven } from "@/lib/markPrizeGiven";
import { markPrizeGivenFailureMessage } from "@/lib/prizeErrors";

/**
 * PRZ-W1 deliverable 4 (W5) — organiser-only "hand out the prize" panel,
 * shown on a FINISHED competition's own page. Caller (`CompetitionDetail.tsx`)
 * must only mount this once BOTH `status === "finished"` AND
 * `organiserCapability === "organiser"` are true — an ordinary player, even
 * a winner, never sees this (spec: organiser marks prizes given, not the
 * winner themselves).
 *
 * **The points gap this panel works around**: the engine's `prizeWinners`
 * array (spec §3.1) has NO `points` field — only `place`/`uid`/`displayName`/
 * `method`. The only legal client read of a player's final points is
 * `competitions/{id}/players/{uid}`, and per CLAUDE.md's documented gap
 * (ticket E4-web-2) that collection is readable only by someone who is
 * THEMSELVES a member of the competition (proven via an `exists()` check on
 * the reader's own player doc) — an organiser who never joined their own
 * competition as a player has no read path to it at all. Rather than invent
 * a field or silently show nothing, this panel accepts the SAME
 * `leaderboardState` the page already fetches for its own leaderboard
 * (`useCompetitionPlayers`, only ever populated when the viewer is a member)
 * and looks each winner's points up there when available, falling back to a
 * clearly-labelled "not available" state with a one-line explanation when
 * it isn't — never a fabricated or silently-zeroed number. Never, under any
 * circumstance, does this panel read or display a step count.
 */
export function OrganiserPrizePanel({
  competitionId,
  prize,
  prizeWinners,
  leaderboardState,
}: {
  competitionId: string;
  prize: Prize | null;
  prizeWinners: PrizeWinner[];
  leaderboardState: LeaderboardState;
}) {
  const claimsState = usePrizeClaims(competitionId, true);
  const claims = claimsState.status === "success" ? claimsState.claims : [];

  return (
    <OrganiserPrizePanelView
      competitionId={competitionId}
      prize={prize}
      prizeWinners={prizeWinners}
      leaderboardState={leaderboardState}
      claims={claims}
    />
  );
}

/**
 * Pure, props-only render of the panel — extracted so the dev-only
 * visual-check fixture (`src/app/dev/prizes/page.tsx`, never built in
 * production, see that file's own header comment) can render this exact
 * markup with made-up winners/claims/leaderboard data, without a live
 * `usePrizeClaims` Firestore listener. `OrganiserPrizePanel` above is the
 * only real production caller.
 */
export function OrganiserPrizePanelView({
  competitionId,
  prize,
  prizeWinners,
  leaderboardState,
  claims,
}: {
  competitionId: string;
  prize: Prize | null;
  prizeWinners: PrizeWinner[];
  leaderboardState: LeaderboardState;
  claims: PrizeClaim[];
}) {
  const [confirmingUid, setConfirmingUid] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  if (!prize) return null;

  const pointsByUid =
    leaderboardState.status === "success"
      ? new Map(leaderboardState.players.map((player) => [player.id, player.points]))
      : null;

  async function handleConfirmGiven() {
    if (!confirmingUid) return;
    setPending(true);
    setPageError(null);
    const outcome = await markPrizeGiven(competitionId, confirmingUid);
    setPending(false);

    if (outcome.status === "failure") {
      setPageError(markPrizeGivenFailureMessage(outcome.failure));
      return;
    }
    setConfirmingUid(null);
  }

  const confirmingWinner = prizeWinners.find((winner) => winner.uid === confirmingUid) ?? null;

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Gift className="size-4 text-brand-gold" aria-hidden="true" />
        {prize.kind === "forfeit" ? "Forfeit to carry out" : "Prize to hand out"}
      </p>

      {pageError ? (
        <div className="mt-3">
          <ErrorBanner message={pageError} />
        </div>
      ) : null}

      {prizeWinners.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Winners haven&apos;t been recorded for this competition yet. Check back shortly.
        </p>
      ) : (
        <ul role="list" className="mt-3 space-y-2">
          {prizeWinners.map((winner) => {
            const item = prize.items.find((candidate) => candidate.place === winner.place);
            const claim = findClaimForUid(claims, winner.uid);
            const points = pointsByUid?.get(winner.uid) ?? null;

            return (
              <li key={winner.uid} className="rounded-xl border border-border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <PlayerAvatar displayName={winner.displayName} avatarIndex={null} size={36} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {winner.displayName ?? "A former player"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item ? `${placeLabel(winner.place)} — ${item.title}` : placeLabel(winner.place)}
                        {" · "}
                        {points !== null ? `${points} points` : "points not shown here"}
                      </p>
                    </div>
                  </div>

                  <ClaimStatusAndAction
                    status={claim?.status ?? null}
                    givenAt={claim?.givenAt ?? null}
                    onMarkGiven={() => setConfirmingUid(winner.uid)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pointsByUid === null && prizeWinners.length > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Points aren&apos;t shown here because you&apos;re not a player in this competition yourself.
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmingUid !== null}
        title="Mark this prize as given?"
        description={
          confirmingWinner
            ? `This confirms you've handed over the prize to ${confirmingWinner.displayName ?? "this player"} outside the app. This can't be undone from here.`
            : "This confirms you've handed over the prize outside the app."
        }
        confirmLabel="Yes, mark as given"
        pendingLabel="Saving…"
        pending={pending}
        onCancel={() => setConfirmingUid(null)}
        onConfirm={handleConfirmGiven}
      />
    </div>
  );
}

function placeLabel(place: number): string {
  if (place === 1) return "1st place";
  if (place === 2) return "2nd place";
  if (place === 3) return "3rd place";
  return `Place ${place}`;
}

/** No claim doc at all (`status === null`) is the common case for a
 * forfeit-only prize, which may never grow a `prizeClaims` doc at all (the
 * spec's claim lifecycle — opt-in/reveal/decline — reads as perk-shaped;
 * unverified either way against unreadable engine source). Rendered as a
 * plain "Mark as given" with no status chip rather than inventing a status
 * label for a state that may not be real. */
function ClaimStatusAndAction({
  status,
  givenAt,
  onMarkGiven,
}: {
  status: PrizeClaimStatus | null;
  givenAt: unknown;
  onMarkGiven: () => void;
}) {
  if (status === "given" || status === "sent") {
    const givenDate = formatGivenAt(givenAt);
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-brand-navy">
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
        {givenDate ? `Given ${givenDate}` : "Given"}
      </span>
    );
  }

  if (status === "declined") {
    return <span className="text-xs font-medium text-muted-foreground">Declined by player</span>;
  }

  return (
    <div className="flex items-center gap-2">
      {status ? <span className="text-xs font-medium text-muted-foreground">{claimStatusLabel(status)}</span> : null}
      <button
        type="button"
        onClick={onMarkGiven}
        className="inline-flex h-9 items-center justify-center rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold px-4 text-xs font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
      >
        Mark as given
      </button>
    </div>
  );
}

function claimStatusLabel(status: PrizeClaimStatus): string {
  switch (status) {
    case "waiting":
      return "Waiting";
    case "ready":
      return "Ready to claim";
    case "revealed":
      return "Viewed by winner";
    case "optedIn":
      return "Opted in";
    default:
      return status;
  }
}

/** Defensive, best-effort formatting of a Firestore `Timestamp`-shaped
 * value (`.toDate()`) — the exact wire shape of `prizeClaims/{uid}.givenAt`
 * is unverified against engine source (not deployed as of 2026-10-27), so
 * this never throws on an unexpected shape; it just omits the date. */
function formatGivenAt(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    try {
      const date = (value as { toDate: () => Date }).toDate();
      return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return null;
    }
  }
  return null;
}
