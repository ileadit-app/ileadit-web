"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Plus, QrCode } from "lucide-react";
import { ErrorBanner } from "@/components/auth/formFields";
import { TextField } from "@/components/forms/fields";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SECONDARY_BUTTON_LIGHT_CLASSNAME } from "@/components/ui/buttonStyles";
import { useQrDataUrl } from "@/lib/qrCode";
import type { CompetitionVisibility } from "@/components/status/CompetitionVisibilityChip";
import {
  createInvite,
  listInvites,
  revokeInvite,
  inviteCallableFailureMessage,
  buildInviteUrl,
  formatInviteCodeForDisplay,
  type InviteSummary,
  type InviteStatus,
} from "@/lib/invites";

/**
 * Organiser-only "Invite people" panel — BUILD item 2 of WEB-INV-1. Mounted
 * by `CompetitionDetail.tsx` only when `useIsCompetitionOrganiser(...)`
 * resolves to `"organiser"` (creator or admin claim) — this component itself
 * assumes it is only ever rendered for someone already known to be allowed
 * to manage invites; it does not re-check that itself.
 *
 * Privacy invariant (INV-1, Paul): organisers see invite STATUS and
 * `useCount` per link only — never a member's name, points, rank, or step
 * data. This file must never import or render anything from
 * `competitionDetail.ts`'s player/leaderboard hooks — that's a structural
 * guarantee, not just a styling choice; don't "helpfully" add a members list
 * here later without re-reading this comment.
 */

const INVITE_LABEL_MAX_LENGTH = 40;

/* ------------------------------------------------------------------ *
 * Invite list — loading/error/success, refreshable after create/revoke.
 * ------------------------------------------------------------------ */

type InviteListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; invites: InviteSummary[] };

/**
 * `listInvites` is a one-shot callable, not an `onSnapshot` subscription —
 * this codebase's usual "start in the correct `useState` initializer, only
 * `setState` from inside an async `.then()`" discipline
 * (`useCanCreateCompetitions.ts`) still applies, but this hook additionally
 * needs an externally-triggerable re-fetch after create/revoke, which none
 * of the existing hooks needed. The mount-time fetch is inlined directly in
 * the effect body (its own `.then`, never calling a referenced function
 * from the effect body) rather than routed through the `refresh` callback
 * below — `react-hooks/set-state-in-effect` flags ANY call to a
 * state-setting callback from inside an effect body, even an async one,
 * once it can trace that the callback eventually calls `setState`. Calling
 * `.then()` inline (not through a named reference) avoids that trace. A
 * small duplication of the two-branch outcome handling is the trade-off;
 * keep both branches in sync if this shape changes.
 */
function useInviteList(competitionId: string) {
  const [state, setState] = useState<InviteListState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    listInvites(competitionId).then((outcome) => {
      if (cancelled) return;
      if (outcome.status === "success") {
        setState({ status: "success", invites: outcome.invites });
      } else {
        setState({ status: "error", message: inviteCallableFailureMessage(outcome.failure) });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [competitionId]);

  const refresh = useCallback(async () => {
    const outcome = await listInvites(competitionId);
    if (outcome.status === "success") {
      setState({ status: "success", invites: outcome.invites });
    } else {
      setState({ status: "error", message: inviteCallableFailureMessage(outcome.failure) });
    }
  }, [competitionId]);

  return { state, refresh };
}

/* ------------------------------------------------------------------ *
 * Create-link form.
 * ------------------------------------------------------------------ */

function CreateInviteForm({
  competitionId,
  onCreated,
}: {
  competitionId: string;
  onCreated: () => void;
}) {
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const trimmedLabel = label.trim();
    // Omit the `label` key entirely when blank, rather than sending
    // `label: undefined` — the Firebase callable serializer turns an
    // `undefined` property value into JSON `null`, which the engine's
    // `label: z.string().max(40).optional()` schema rejects with
    // `functions/invalid-argument` (missing key is fine; `null` is not).
    // This was a real bug, live on production: creating a link WITHOUT a
    // label failed outright. `createInvite` itself also runs every request
    // through `compactPayload` as a second line of defense — see
    // `callablePayload.ts` — but building the request without the key here
    // in the first place is the clearest fix at the call site itself.
    const outcome = await createInvite(
      trimmedLabel.length > 0 ? { competitionId, label: trimmedLabel } : { competitionId },
    );
    setPending(false);
    if (outcome.status === "success") {
      setLabel("");
      onCreated();
    } else {
      setError(inviteCallableFailureMessage(outcome.failure));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      {error ? <ErrorBanner message={error} /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField
            label="Link label (optional)"
            value={label}
            onChange={setLabel}
            placeholder="e.g. Marketing team"
            maxLength={INVITE_LABEL_MAX_LENGTH}
            helperText="Helps you tell links apart later — not shown to anyone who joins."
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-brand-gold px-5 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed disabled:bg-cta-disabled disabled:text-cta-disabled-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          {pending ? "Creating…" : "Create invite link"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Status pill — deliberately LOCAL to this file, not a shared component.
 * This describes an INVITE's lifecycle (active/revoked/expired/exhausted),
 * a different domain from `CompetitionStatusChip`/`PlayerRowBadge`
 * (competition state / player state) — see the "shared status component
 * split: scope determines the component" pattern. Only one caller exists
 * today; if a second one ever needs this exact mapping, promote it then.
 * ------------------------------------------------------------------ */

const INVITE_STATUS_CONFIG: Record<InviteStatus, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-[rgba(25,47,95,0.08)] text-brand-navy",
  },
  revoked: {
    label: "Revoked",
    className: "bg-destructive/10 text-destructive",
  },
  expired: {
    label: "Expired",
    className: "bg-muted text-muted-foreground",
  },
  exhausted: {
    label: "Fully used",
    className: "bg-muted text-muted-foreground",
  },
};

function InviteStatusPill({ status }: { status: InviteStatus }) {
  const config = INVITE_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${config.className}`}
    >
      {config.label}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Copy-link button — brief "Copied!" confirmation, no toast library.
 * ------------------------------------------------------------------ */

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("[CopyLinkButton] clipboard write failed", error);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${SECONDARY_BUTTON_LIGHT_CLASSNAME} h-11 px-4 text-sm`}
    >
      {copied ? (
        <>
          <Check className="size-4" aria-hidden="true" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="size-4" aria-hidden="true" />
          Copy link
        </>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * QR for one row — calls `useQrDataUrl` directly rather than mounting
 * `InviteQrCode` (which also calls the hook) to avoid generating the same
 * QR twice if this row and the public invite page's own QR were ever on
 * screen together in a test/story context. Renders on demand (toggled),
 * not for every row up front, since QR generation isn't free.
 * ------------------------------------------------------------------ */

function InviteRowQr({ code }: { code: string }) {
  const url = buildInviteUrl(code);
  const state = useQrDataUrl(url, 320);

  if (state.status === "loading") {
    return <div className="mt-3 size-32 animate-pulse rounded-xl bg-muted" aria-hidden="true" />;
  }

  if (state.status === "error") {
    return (
      <p role="note" className="mt-3 text-xs text-muted-foreground">
        Couldn&apos;t generate a QR code — use the link instead.
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-col items-start gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- base64 data
          URL, no source next/image can optimise. */}
      <img
        src={state.dataUrl}
        alt={`QR code for invite ${formatInviteCodeForDisplay(code)}`}
        width={128}
        height={128}
        className="rounded-xl border border-border"
      />
      <a
        href={state.dataUrl}
        download={`ileadit-invite-${code}.png`}
        className={`${SECONDARY_BUTTON_LIGHT_CLASSNAME} h-9 px-3 text-xs`}
      >
        <Download className="size-3.5" aria-hidden="true" />
        Download PNG
      </a>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Revoke — destructive, confirmed via `ConfirmDialog`.
 * ------------------------------------------------------------------ */

function RevokeInviteButton({
  code,
  label,
  onRevoked,
}: {
  code: string;
  label: string | null;
  onRevoked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setPending(true);
    setError(null);
    const outcome = await revokeInvite(code);
    setPending(false);
    if (outcome.status === "success") {
      setOpen(false);
      onRevoked();
    } else {
      setError(inviteCallableFailureMessage(outcome.failure));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center justify-center rounded-full border border-destructive/40 px-4 text-sm font-bold text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
      >
        Revoke
      </button>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      <ConfirmDialog
        open={open}
        title="Revoke this invite link?"
        description={`Anyone who hasn't already used ${
          label ? `"${label}"` : "this link"
        } will no longer be able to join with it. This doesn't remove anyone who already joined.`}
        confirmLabel="Revoke link"
        pendingLabel="Revoking…"
        destructive
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * One row.
 * ------------------------------------------------------------------ */

function InviteRow({ invite, onChanged }: { invite: InviteSummary; onChanged: () => void }) {
  const [showQr, setShowQr] = useState(false);

  return (
    <li className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-mono text-base font-bold text-foreground">
          {invite.displayCode}
        </span>
        <InviteStatusPill status={invite.status} />
        {invite.label ? (
          <span className="text-sm text-muted-foreground">{invite.label}</span>
        ) : null}
        <span className="text-sm text-muted-foreground">
          {invite.useCount} {invite.useCount === 1 ? "join" : "joins"}
          {typeof invite.maxUses === "number" ? ` of ${invite.maxUses}` : ""}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CopyLinkButton url={invite.url} />
        <button
          type="button"
          onClick={() => setShowQr((v) => !v)}
          className={`${SECONDARY_BUTTON_LIGHT_CLASSNAME} h-11 px-4 text-sm`}
          aria-expanded={showQr}
        >
          <QrCode className="size-4" aria-hidden="true" />
          {showQr ? "Hide QR code" : "Show QR code"}
        </button>
        {invite.status === "active" ? (
          <RevokeInviteButton code={invite.code} label={invite.label} onRevoked={onChanged} />
        ) : null}
      </div>

      {showQr ? <InviteRowQr code={invite.code} /> : null}
    </li>
  );
}

function InviteListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Top-level panel.
 * ------------------------------------------------------------------ */

export function InvitePanel({
  competitionId,
  visibility,
}: {
  competitionId: string;
  visibility: CompetitionVisibility;
}) {
  const { state, refresh } = useInviteList(competitionId);

  return (
    <section className="rounded-3xl border border-border bg-background p-5 sm:p-6" aria-labelledby="invite-panel-heading">
      <h2 id="invite-panel-heading" className="text-xl font-extrabold text-foreground">
        Invite people
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        {visibility === "private"
          ? "This competition is private — it won't show up in the app for anyone. The only way in is a link from here. You'll only ever see how many people have joined through each link, never who they are or how they're doing."
          : "Share a link to let people join without hunting for this competition. You'll only ever see how many people have joined through each link, never who they are or how they're doing."}
      </p>

      <div className="mt-4">
        <CreateInviteForm competitionId={competitionId} onCreated={() => void refresh()} />
      </div>

      <div className="mt-4">
        {state.status === "loading" ? <InviteListSkeleton /> : null}
        {state.status === "error" ? <ErrorBanner message={state.message} /> : null}
        {state.status === "success" && state.invites.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            {visibility === "private"
              ? "No invite links yet — until you create one, nobody can join this competition. Create a link above to get started."
              : "No invite links yet — create one above to start sharing."}
          </p>
        ) : null}
        {state.status === "success" && state.invites.length > 0 ? (
          <ul role="list" className="space-y-3">
            {state.invites.map((invite) => (
              <InviteRow key={invite.code} invite={invite} onChanged={() => void refresh()} />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
