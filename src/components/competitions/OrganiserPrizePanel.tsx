"use client";

import { useId, useState } from "react";
import { Check, CheckCircle2, Smile, Sun, type LucideIcon } from "lucide-react";
import { ErrorBanner } from "@/components/auth/formFields";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PlayerAvatar } from "./PlayerAvatar";
import type { Prize, PrizeWinner } from "@/lib/prize";
import type { LeaderboardState } from "@/lib/competitionDetail";
import { findClaimForUid, usePrizeClaims, type PrizeClaim, type PrizeClaimStatus } from "@/lib/prizeClaims";
import { markPrizeGiven } from "@/lib/markPrizeGiven";
import { markPrizeGivenFailureMessage } from "@/lib/prizeErrors";

/**
 * PRZ-W1-FIX1 deliverable 4 (W5) — organiser-only "hand out the prize"
 * panel, shown on a FINISHED competition's own page. Caller
 * (`CompetitionDetail.tsx`) must only mount this once BOTH
 * `status === "finished"` AND `organiserCapability === "organiser"` are
 * true — an ordinary player, even a winner, never sees this (spec:
 * organiser marks prizes given, not the winner themselves).
 *
 * **Card chrome ported from the approved v0 design's `PerkPrizePanel`**
 * (`.ticket-refs/prizes/v0-web/components/competitions/PrizePanel.tsx`):
 * `rounded-3xl` card, coral uppercase "Prize" kicker + bold title + a
 * `KindChip`, a 3-step `Steps` progress row, then a winner block + status
 * pill + action per winner. **Two deliberate, flagged deviations from that
 * source**, both because the mockup only ever shows ONE winner while this
 * ticket's real engine contract supports up to three (`PrizePlaces = 1|3`):
 * (1) the winner/status/action block is looped per `prizeWinners` entry
 * instead of rendered once; (2) `Steps`' three dates ("Sun 29 Nov" etc.) are
 * the mockup's own hardcoded placeholder strings — this ticket has no real
 * per-competition "when did it end / when was it checked" timestamp wired
 * in yet, so `Steps` here renders generically ("done"/"done"/"current",
 * hardcoded) rather than inventing specific dates. Revisit once a real
 * finalisation-timestamp field is confirmed against engine source.
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
  // Must run before the `!prize` early return below — React hooks can never
  // be called conditionally (rules-of-hooks). Pre-existing bug, caught by
  // `npm run lint` while verifying this ticket's other changes, unrelated to
  // the `@container` fix above.
  const headingId = useId();

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
  const kindIcon: LucideIcon = prize.kind === "forfeit" ? Smile : Sun;
  const kindLabel = prize.kind === "forfeit" ? "Bragging rights" : "A perk";
  const title = prize.items.find((item) => item.place === 1)?.title ?? "Prize";

  return (
    <section
      aria-labelledby={headingId}
      // `@container`: the `@min-[Npx]:` classes below (and throughout this
      // component) are Tailwind v4 CONTAINER query variants, ported
      // verbatim from the v0 source — but v0's own preview frame
      // (`FrameCanvas.tsx`) is itself wrapped in `@container`, which this
      // app has no equivalent of. Without an explicit `@container`
      // ancestor, a `@min-*` variant has no containment context to query
      // against and silently never matches, at any real browser width —
      // caught via PRZ-W1-FIX1's screenshot verification (the 3-step
      // progress row rendered as a single column at 1280px instead of the
      // intended `@min-[640px]:grid-cols-3`). Establishing containment
      // here, scoped to just this card, is what makes those variants
      // actually activate against the card's own real rendered width.
      className="@container mt-4 rounded-3xl border border-border bg-card p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">Prize</p>
          <h2 id={headingId} className="mt-1 text-xl font-extrabold text-foreground">
            {title}
          </h2>
        </div>
        <KindChip icon={kindIcon} label={kindLabel} />
      </div>

      <div className="mt-5">
        <Steps />
      </div>

      {pageError ? (
        <div className="mt-6">
          <ErrorBanner message={pageError} />
        </div>
      ) : null}

      {prizeWinners.length === 0 ? (
        <p className="mt-6 border-t border-border pt-6 text-sm text-muted-foreground">
          Winners haven&apos;t been recorded for this competition yet. Check back shortly.
        </p>
      ) : (
        <ul role="list" className="mt-6 space-y-6 border-t border-border pt-6">
          {prizeWinners.map((winner) => {
            const item = prize.items.find((candidate) => candidate.place === winner.place);
            const claim = findClaimForUid(claims, winner.uid);
            const points = pointsByUid?.get(winner.uid) ?? null;

            return (
              <li
                key={winner.uid}
                className="grid gap-4 @min-[768px]:grid-cols-[1fr_auto] @min-[768px]:items-center"
              >
                <div className="flex items-center gap-3">
                  <PlayerAvatar displayName={winner.displayName} avatarIndex={null} size={44} />
                  <div>
                    <p className="text-sm text-muted-foreground">{winnerRoleLabel(winner.place)}</p>
                    <p className="text-base font-bold text-foreground">
                      {winner.displayName ?? "A former player"}
                    </p>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      {item?.title ? `${placeLabel(winner.place)} — ${item.title} · ` : `${placeLabel(winner.place)} · `}
                      {points !== null ? `${points} points` : "points not shown here"}
                    </p>
                  </div>
                </div>

                <ClaimStatusAndAction
                  status={claim?.status ?? null}
                  givenAt={claim?.givenAt ?? null}
                  onMarkGiven={() => setConfirmingUid(winner.uid)}
                />
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
    </section>
  );
}

/** Ported verbatim from the v0 design's own `Steps` component (static
 * labels/dates — see this file's header comment on why the dates are
 * generic rather than wired to a real timestamp). */
function Steps() {
  const steps: { label: string; detail: string; state: "done" | "current" }[] = [
    { label: "Competition ended", detail: "Result is in", state: "done" },
    { label: "Result checked", detail: "Winners confirmed", state: "done" },
    { label: "Ready", detail: "Prize can be handed out", state: "current" },
  ];
  return (
    <ol className="grid gap-4 @min-[640px]:grid-cols-3" role="list" aria-label="Prize progress">
      {steps.map((step, index) => (
        <li
          key={step.label}
          aria-current={step.state === "current" ? "step" : undefined}
          className="flex items-start gap-3"
        >
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              step.state === "done"
                ? "bg-brand-navy text-on-navy-foreground"
                : "bg-brand-gold text-brand-navy ring-4 ring-brand-gold/25"
            }`}
          >
            {step.state === "done" ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <span aria-hidden="true">{index + 1}</span>
            )}
          </span>
          <span>
            <span className="block text-sm font-bold text-foreground">{step.label}</span>
            <span className="block text-xs text-muted-foreground">{step.detail}</span>
            <span className="sr-only">{step.state === "done" ? "Complete" : "Current step"}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function KindChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-bold text-secondary-foreground">
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

function winnerRoleLabel(place: number): string {
  if (place === 1) return "Winner";
  if (place === 2) return "Runner-up";
  return "Third place";
}

function placeLabel(place: number): string {
  if (place === 1) return "1st";
  if (place === 2) return "2nd";
  if (place === 3) return "3rd";
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
    <div className="flex flex-col items-start gap-2 @min-[768px]:items-end">
      {/* Dot-and-text pill, ported from the v0 design's `StatusPill`. */}
      <span className="inline-flex h-7 items-center gap-2 rounded-full bg-muted px-3 text-xs font-bold text-muted-foreground">
        <span className="size-2 rounded-full bg-brand-coral" aria-hidden="true" />
        {status ? claimStatusLabel(status) : "Not given yet"}
      </span>
      <button
        type="button"
        onClick={onMarkGiven}
        className="inline-flex h-10 items-center justify-center rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold px-5 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
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
