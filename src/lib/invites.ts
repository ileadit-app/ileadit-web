import { httpsCallable } from "firebase/functions";
import type { FunctionsError } from "firebase/functions";
import { getFunctionsClient } from "./functions";
import { compactPayload } from "./callablePayload";
import type { CompetitionStatus } from "./competitionDetail";
import {
  toCompetitionMembershipFailure,
  competitionMembershipFailureMessage,
  type CompetitionMembershipFailure,
} from "./competitionMembershipErrors";

/**
 * Wraps ALL FIVE invite callables (`createInvite`, `previewInvite`,
 * `acceptInvite`, `listInvites`, `revokeInvite`) in one module, deliberately
 * breaking this repo's usual one-callable-per-file convention
 * (`joinCompetition.ts`, `leaveCompetition.ts`, `ensureAccount.ts`, …). They
 * share one Firestore document shape (`invites/{CODE}`) and one code-format
 * contract, and are being built as one ticket (WEB-INV-1) against one engine
 * ticket (INV-1, Ivor) — five near-empty files would just fragment a single
 * cohesive contract. If a future ticket meaningfully diverges one of these
 * (e.g. `acceptInvite` growing enough bespoke logic to be its own concern),
 * splitting it back out then is fine — this is a deliberate choice for now,
 * not an accident.
 *
 * **NONE of Ivor's five callables are deployed or merged anywhere readable
 * as of 2026-09-21.** This module is written entirely against the INV-1
 * ticket's documented contract (exact callable names, request/response
 * shapes, and status derivation rules), NOT against callable source — same
 * undeployed-callable discipline as `createCompetition.ts`/
 * `createCompetitionErrors.ts`: no invented closed enum of failure reasons,
 * `code`/raw `reason` kept as separate fields, and an explicit,
 * documented wire-format assumption for every `Timestamp`-typed field
 * crossing the callable boundary (Callable Functions carry plain JSON —
 * a client `Timestamp` never survives that wire unmodified). **Assumption:
 * `expiresAt`/`createdAt` are ISO-8601 strings on the wire**, both directions
 * — re-verify against Ivor's real callable source the moment it's readable,
 * and fix in this one place if wrong.
 *
 * NEVER call `httpsCallable(getFunctionsClient(), "createInvite" | ...)`
 * from a component directly — go through the functions in this file.
 */

/* ------------------------------------------------------------------ *
 * Code format — 8 chars from Crockford-ish alphabet (no 0/1/I/L/O),
 * displayed as `XXXX-XXXX`. The web portal never GENERATES a code (only
 * `createInvite` does, server-side) — these helpers only normalise
 * user/URL input and format a known code for display.
 * ------------------------------------------------------------------ */

/** Documented for completeness (matches the INV-1 contract's doc-id
 * alphabet) — NOT used to validate input client-side. `previewInvite`'s own
 * uniform `{available:false}` already covers "not a real code" for any
 * string of the right length; re-deriving alphabet validation here would
 * just be a second, possibly-drifting copy of a rule the engine owns. */
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;

/** Strips anything that isn't a letter or digit and uppercases — turns
 * `"k7m4-pqx2"`, `"K7M4 PQX2"`, or a pasted `"K7M4-PQX2"` all into the same
 * `"K7M4PQX2"` the engine actually stores as the doc id. */
export function normalizeInviteCodeInput(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/** The one check `/invite/[code]` uses to route between the new 8-character
 * invite-code path and the legacy 20-character Firestore competition-ID
 * path (`InviteLanding.tsx`) — see that page's own comment for why length
 * alone is a reliable, sufficient discriminator (Firestore auto-IDs are
 * always 20 alphanumeric characters; stripping non-alphanumerics never
 * changes that length). */
export function isEightCharacterInviteCode(raw: string): boolean {
  return normalizeInviteCodeInput(raw).length === INVITE_CODE_LENGTH;
}

/** `"K7M4PQX2"` -> `"K7M4-PQX2"`. Anything not exactly 8 normalised
 * characters is returned normalised-but-unformatted rather than guessed at
 * — callers only ever pass a code they already know is 8 characters
 * (fresh from `createInvite`/`listInvites`, or already routed through
 * `isEightCharacterInviteCode`). */
export function formatInviteCodeForDisplay(code: string): string {
  const normalized = normalizeInviteCodeInput(code);
  if (normalized.length !== INVITE_CODE_LENGTH) return normalized;
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

/**
 * The invite link host, per Paul's INV-1 decision: "Link host:
 * `https://ileadit-portal.web.app/invite/{CODE}` as ONE swappable constant
 * (ileadit.app not registered yet)." This is that one constant — every
 * invite URL in the codebase (the create-form's live preview, the
 * organiser panel's copy/QR actions, any future email/share text) must be
 * built through `buildInviteUrl` below, never string-concatenated ad hoc,
 * so a future domain swap is a one-line change.
 */
export const INVITE_BASE_URL = "https://ileadit.co.uk/invite"; // ileadit.co.uk registered 22 Sep 2026; must match the engine INVITE_LINK_BASE_URL

export function buildInviteUrl(code: string): string {
  return `${INVITE_BASE_URL}/${normalizeInviteCodeInput(code)}`;
}

/* ------------------------------------------------------------------ *
 * Shared failure surface for createInvite / listInvites / revokeInvite —
 * organiser-facing callables. `previewInvite`/`acceptInvite` have their own
 * shapes below (preview never throws for "invalid code"; accept overlaps
 * with the existing join-refusal surface).
 * ------------------------------------------------------------------ */

export interface InviteCallableFailure {
  code: FunctionsError["code"] | null;
  /** Verbatim `details.reason`, if the callable sends one. Never guessed. */
  reason: string | null;
  message: string;
  cause: unknown;
}

function isFunctionsError(error: unknown): error is FunctionsError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    (error as { code: string }).code.startsWith("functions/")
  );
}

function toInviteCallableFailure(error: unknown, fallbackMessage: string): InviteCallableFailure {
  if (!isFunctionsError(error)) {
    return {
      code: null,
      reason: null,
      message: error instanceof Error ? error.message : fallbackMessage,
      cause: error,
    };
  }
  const details = error.details as { reason?: unknown } | undefined;
  return {
    code: error.code,
    reason: typeof details?.reason === "string" ? details.reason : null,
    message: error.message,
    cause: error,
  };
}

export function inviteCallableFailureMessage(failure: InviteCallableFailure): string {
  const detail = [failure.code, failure.reason].filter(Boolean).join(": ");
  switch (failure.code) {
    case "functions/permission-denied":
      return "You don't have permission to manage invites for this competition.";
    case "functions/unauthenticated":
      return "You've been signed out. Sign in again and try once more.";
    case "functions/invalid-argument":
      return `Something about that wasn't valid${detail ? ` (${detail})` : ""}. Check the details and try again.`;
    case "functions/resource-exhausted":
      return "This competition has hit its invite-link limit (20 active links) — revoke one before creating another.";
    case "functions/not-found":
      return "This invite link doesn't exist any more.";
    default:
      return `Something went wrong${detail ? ` (${detail})` : ""} — try again, or email hello@ileadit.co.uk if it keeps happening.`;
  }
}

/* ------------------------------------------------------------------ *
 * createInvite — organiser only (creator, org owner/admin, or ileadit
 * admin claim; enforced server-side, mirrored client-side by
 * `useIsCompetitionOrganiser`).
 * ------------------------------------------------------------------ */

export interface CreateInviteInput {
  competitionId: string;
  /** <=40 chars per the INV-1 data model. Not enforced here beyond the
   * `<input maxLength>` on the form — the callable is the real boundary.
   * Optional per the engine's zod schema (`.optional()` — MISSING key only,
   * never `null`). A caller building this input from an empty/blank form
   * field must either omit the key entirely or pass `undefined` and rely on
   * `compactPayload` below (see BUG note in `callablePayload.ts`) — never
   * pass an empty string through as a stand-in for "no label". */
  label?: string;
  /** ISO-8601 string — see this file's header comment on the Timestamp
   * wire-format assumption. Not exposed by the BUILD-1 form (label only,
   * per the ticket's explicit scope) — present for a future form that adds
   * it without needing a new wrapper. Same undefined-vs-null caveat as
   * `label` above applies here too. */
  expiresAt?: string;
  /** Same undefined-vs-null caveat as `label` above. */
  maxUses?: number;
}

export interface CreateInviteResult {
  code: string;
  displayCode: string;
  url: string;
}

export type CreateInviteOutcome =
  | { status: "success"; result: CreateInviteResult }
  | { status: "failure"; failure: InviteCallableFailure };

export async function createInvite(input: CreateInviteInput): Promise<CreateInviteOutcome> {
  const callable = httpsCallable<CreateInviteInput, CreateInviteResult>(
    getFunctionsClient(),
    "createInvite",
  );
  try {
    // compactPayload strips any of label/expiresAt/maxUses a caller passed
    // as `undefined` (e.g. an empty label field) — sending the key at all
    // with an `undefined` value would serialize to JSON `null` on the wire
    // and be rejected by the engine's `.optional()` zod schema. Defense in
    // depth: `InvitePanel.tsx`'s form also builds its own request without
    // an explicit `label: undefined`, but this wrapper must be correct on
    // its own for any future caller too. See `callablePayload.ts`.
    const result = await callable(compactPayload(input));
    return { status: "success", result: result.data };
  } catch (error) {
    return {
      status: "failure",
      failure: toInviteCallableFailure(error, "Couldn't create that invite link."),
    };
  }
}

/* ------------------------------------------------------------------ *
 * previewInvite — UNAUTHENTICATED. Every "this code doesn't lead anywhere
 * good" case (revoked, expired, exhausted, unknown code, or the
 * competition itself is finalising/finished) collapses to ONE uniform
 * `{available:false}` RESULT, not a thrown error — per the contract and
 * per BUILD item 1's "ONE uniform 'This invite isn't available' state" —
 * so a genuinely invalid/expired/revoked code is not distinguishable from
 * this result alone, by design (the contract deliberately doesn't leak
 * "which specific reason" to an unauthenticated visitor).
 * ------------------------------------------------------------------ */

export interface InvitePreviewAvailable {
  available: true;
  competitionId: string;
  competitionName: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  durationDays: number | null;
  /** Only ever "scheduled" or "active" here — finalising/finished
   * competitions fold into the uniform `available:false` case instead. */
  status: CompetitionStatus;
  /** Set only when `status === "active"` — "you're joining on day N". */
  dayNumber: number | null;
  playerCount: number | null;
  /** PC-9 contract correction (d) — engine ticket in progress, NOT yet
   * confirmed shipped on `previewInvite`. Deliberately OPTIONAL, not
   * nullable like every other visibility field in this codebase
   * (`CompetitionDetailDoc.visibility` etc, which are always-present-but-
   * possibly-null). `InviteCodeLanding.tsx` renders the visibility chip
   * ONLY when this key is actually present on the response — never
   * defaults an absent value to "public" the way `resolveCompetitionVisibility`
   * does for every other surface. Do not route this field through that
   * helper; the two absent-value semantics are different on purpose. */
  visibility?: "public" | "private";
}

export interface InvitePreviewUnavailable {
  available: false;
}

export type InvitePreviewResult = InvitePreviewAvailable | InvitePreviewUnavailable;

export type PreviewInviteOutcome =
  | { status: "success"; result: InvitePreviewResult }
  | { status: "failure"; failure: InviteCallableFailure };

export async function previewInvite(code: string): Promise<PreviewInviteOutcome> {
  const callable = httpsCallable<{ code: string }, InvitePreviewResult>(
    getFunctionsClient(),
    "previewInvite",
  );
  try {
    const result = await callable({ code: normalizeInviteCodeInput(code) });
    return { status: "success", result: result.data };
  } catch (error) {
    // A genuinely invalid code is NOT expected to reach this branch (it
    // resolves as `{available:false}` above) — this catches real failures
    // (network, malformed input rejected by zod, etc). The UI folds both
    // into the same "unavailable" card per the ticket's uniform-state
    // instruction, but keeps them distinct internally so only a real
    // failure gets logged.
    return {
      status: "failure",
      failure: toInviteCallableFailure(error, "Couldn't load this invite."),
    };
  }
}

/* ------------------------------------------------------------------ *
 * acceptInvite — signed in only. Deliberately reuses
 * `competitionMembershipErrors.ts`'s existing join-refusal surface for the
 * "the invite is fine but the join itself is refused" case, per the
 * contract's "join refusals map to the existing join error codes."
 * ------------------------------------------------------------------ */

export interface AcceptInviteResult {
  competitionId: string;
  joined: boolean;
  alreadyMember: boolean;
  dayNumber: number | null;
}

/**
 * Two distinct failure shapes collapsed under one type: an invite-level
 * refusal (bad/expired/revoked/exhausted code — the contract says this
 * shares the SAME `failed-precondition` code class `previewInvite`'s
 * uniform failure would represent, with no further distinguishing
 * information) vs. a join-level refusal (the invite itself is fine, but
 * `joinCompetitionService` refuses the join for one of its own existing
 * reasons — already-active-past-window, LEAVE-1's no-rejoin guard,
 * finalising/finished, missing game state, config not seeded). Both throw
 * `failed-precondition` from the callable; there is no `details.reason` or
 * message substring documented yet that reliably tells them apart from the
 * client side, so this module makes its best-effort split using the SAME
 * message substrings `competitionMembershipErrors.ts` already keys off for
 * `joinCompetition`/`leaveCompetition` ("is not open for joining", "call
 * ensureAccount first", "game config is not seeded") — a message matching
 * one of those is treated as `join-refused`; anything else, including a
 * message this module doesn't recognise, is treated as `invite-unavailable`
 * (the safer default: it doesn't invent copy about the join gate for a
 * failure that might actually be about the invite itself). Re-verify this
 * split against Ivor's real callable source the moment it's readable.
 *
 * **PC-9 contract corrections (b)/(c)** add two further, CONFIRMED (not
 * best-effort) `join-refused` triggers, checked before the substring
 * fallback above: `permission-denied` with `details.reason ===
 * "competition-private"`, and `failed-precondition` with `details.reason
 * === "overlapping-competition"`. Both apply here too (not just to
 * `joinCompetition` directly) — accepting an invite still ultimately calls
 * the same join gate.
 */
export type AcceptInviteFailure =
  | { kind: "invite-unavailable"; failure: InviteCallableFailure }
  | { kind: "join-refused"; failure: CompetitionMembershipFailure };

export type AcceptInviteOutcome =
  | { status: "success"; result: AcceptInviteResult }
  | { status: "failure"; failure: AcceptInviteFailure };

const JOIN_REFUSAL_MESSAGE_SUBSTRINGS = [
  "is not open for joining",
  "call ensureAccount first",
  "game config is not seeded",
];

export async function acceptInvite(code: string): Promise<AcceptInviteOutcome> {
  const callable = httpsCallable<{ code: string }, AcceptInviteResult>(
    getFunctionsClient(),
    "acceptInvite",
  );
  try {
    const result = await callable({ code: normalizeInviteCodeInput(code) });
    return { status: "success", result: result.data };
  } catch (error) {
    const wireReason = isFunctionsError(error)
      ? (error.details as { reason?: unknown } | undefined)?.reason
      : undefined;
    const isJoinRefusal =
      isFunctionsError(error) &&
      ((error.code === "functions/permission-denied" && wireReason === "competition-private") ||
        (error.code === "functions/failed-precondition" && wireReason === "overlapping-competition") ||
        (error.code === "functions/failed-precondition" &&
          JOIN_REFUSAL_MESSAGE_SUBSTRINGS.some((substring) => error.message.includes(substring))));
    if (isJoinRefusal) {
      return {
        status: "failure",
        failure: { kind: "join-refused", failure: toCompetitionMembershipFailure(error) },
      };
    }
    return {
      status: "failure",
      failure: {
        kind: "invite-unavailable",
        failure: toInviteCallableFailure(error, "Couldn't accept that invite."),
      },
    };
  }
}

export function acceptInviteFailureMessage(failure: AcceptInviteFailure): string {
  if (failure.kind === "join-refused") {
    // PC-9 review item 3: `competitionMembershipFailureMessage`'s generic
    // "competition-private" copy ("you'll need an invite link to join it")
    // is written for `joinCompetition`'s OTHER caller — a non-member who
    // reached a private competition's own page WITHOUT an invite. Here, on
    // `/invite/[code]`, the visitor is by definition already holding an
    // invite link; telling them they need one makes no sense. A
    // `competition-private` refusal from `acceptInvite` means the specific
    // invite they used no longer grants access (its competition has since
    // gone private-and-invite-required in a way this particular link
    // doesn't cover, or the link itself doesn't carry an active grant) — so
    // the fix is a NEW link, not "find an invite link" as if they had none.
    if (failure.failure.reason === "competition-private") {
      return "This invite can't be used to join — ask the organiser for a new invite link.";
    }
    return competitionMembershipFailureMessage(failure.failure, "join");
  }
  return "This invite isn't available any more — it may have been revoked, expired, run out of uses, or point to a competition that's no longer open to new joins.";
}

/* ------------------------------------------------------------------ *
 * listInvites / revokeInvite — organiser only.
 * ------------------------------------------------------------------ */

export type InviteStatus = "active" | "revoked" | "expired" | "exhausted";

export interface InviteSummary {
  code: string;
  displayCode: string;
  url: string;
  label: string | null;
  /** ISO-8601 string — see this file's header comment. */
  createdAt: string | null;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  status: InviteStatus;
}

export type ListInvitesOutcome =
  | { status: "success"; invites: InviteSummary[] }
  | { status: "failure"; failure: InviteCallableFailure };

export async function listInvites(competitionId: string): Promise<ListInvitesOutcome> {
  const callable = httpsCallable<{ competitionId: string }, { invites: InviteSummary[] }>(
    getFunctionsClient(),
    "listInvites",
  );
  try {
    const result = await callable({ competitionId });
    return { status: "success", invites: result.data.invites };
  } catch (error) {
    return {
      status: "failure",
      failure: toInviteCallableFailure(error, "Couldn't load invite links."),
    };
  }
}

export type RevokeInviteOutcome =
  | { status: "success" }
  | { status: "failure"; failure: InviteCallableFailure };

export async function revokeInvite(code: string): Promise<RevokeInviteOutcome> {
  const callable = httpsCallable<{ code: string }, { revoked: boolean }>(
    getFunctionsClient(),
    "revokeInvite",
  );
  try {
    await callable({ code: normalizeInviteCodeInput(code) });
    return { status: "success" };
  } catch (error) {
    return {
      status: "failure",
      failure: toInviteCallableFailure(error, "Couldn't revoke that invite link."),
    };
  }
}
