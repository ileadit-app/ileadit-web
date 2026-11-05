import { httpsCallable } from "firebase/functions";
import { getFunctionsClient } from "./functions";
import { toCreateCompetitionFailure, type CreateCompetitionFailure } from "./createCompetitionErrors";

/**
 * Wrapper for the `createCompetition` callable (P1.3, Ivor — branch
 * `engine/p1-create-competition`, **NOT deployed** as of 2026-09-20). Built
 * strictly against the contract given in the P1.4 ticket brief:
 *
 *   createCompetition({ name, startTime, durationDays, timeZone?,
 *     description?, imageUrl?, backgroundImageUrl?, sponsorName? })
 *
 * `sponsorName` (WEB-SPONSOR-NAME, COMP-BRAND-1, 5 Nov 2026) is added to
 * the engine contract in parallel with this change: optional string,
 * trimmed, 1-40 characters, no control characters, and left OUT of the
 * payload entirely when blank. The limits live in `SPONSOR_NAME_MAX_LENGTH`
 * / `validateSponsorName` below so the form and this wrapper cannot
 * disagree about them. The engine re-validates; this is fast feedback.
 *
 * Two things below are genuinely UNVERIFIED, not silently assumed — flagged
 * here rather than buried, because nobody has read (or can read — it isn't
 * merged) the callable's actual source:
 *
 * 1. **`startTime`'s wire format.** The Firestore FIELD this ultimately
 *    populates is a `Timestamp` (`firestore.rules:244`), but a Callable
 *    Function's request body is plain JSON — the client SDK does not
 *    serialize a `firebase/firestore` `Timestamp` object across that wire
 *    on its own, and the ticket brief doesn't specify what the callable
 *    expects instead. This sends an ISO 8601 string
 *    (`Date.prototype.toISOString()`) — the conventional choice for a
 *    datetime value in a callable payload — on the assumption the callable
 *    does `Timestamp.fromDate(new Date(input.startTime))` server-side. If
 *    Ivor's callable expects epoch milliseconds or a `{ seconds,
 *    nanoseconds }` object instead, only the request-building block below
 *    needs to change — every other caller of this module is unaffected.
 * 2. **The success return shape.** Not specified anywhere this agent could
 *    read. `competitionId` below is read defensively (`typeof ===
 *    "string"`, else `null`) rather than assumed present.
 *
 * ENGINE-DERIVED FIELDS — never send these, the engine computes them:
 * `startDate`, `endDate`, `status`, `playerCount`, `configVersion`,
 * `finalisedAt`, `winnerIds`. See `CreateCompetitionInput` below: none of
 * these six exist as accepted input fields on this type, by design.
 *
 * NEVER call `httpsCallable(getFunctionsClient(), "createCompetition")`
 * from a component directly — go through `createCompetition()` here,
 * matching the one-call-site discipline `ensureAccount.ts` already
 * established for its own callable.
 */
/** Engine contract (COMP-BRAND-1): trimmed length 1..40. */
export const SPONSOR_NAME_MAX_LENGTH = 40;

// C0 controls, DEL and C1 controls. Tabs/newlines are included on purpose:
// the contract says "no control characters" and a sponsor name is one line.
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/;

export type SponsorNameProblem = "too-long" | "control-characters";

/**
 * Checks a raw sponsor-name field value against the contract. Blank
 * (empty or whitespace-only) is valid — the field is optional — and is
 * reported as `null` like any other pass. Length is measured on the
 * TRIMMED value, matching what is actually sent.
 */
export function validateSponsorName(raw: string): SponsorNameProblem | null {
  const trimmed = raw.trim();
  if (CONTROL_CHARACTERS.test(trimmed)) return "control-characters";
  if (trimmed.length > SPONSOR_NAME_MAX_LENGTH) return "too-long";
  return null;
}

export interface CreateCompetitionInput {
  /** Required, max 80 chars (`firestore.rules:243`) — the caller
   * (`CreateCompetitionForm`) enforces this client-side, but the callable
   * re-validates; never rely on the client check alone. */
  name: string;
  /** A JS `Date` representing the real instant the competition should
   * start — timezone conversion (if the caller built this from a
   * timezone-naive `<input type="datetime-local">`) must already be done
   * by the time it reaches here; see `src/lib/timeZones.ts`. Converted to
   * the wire format inside this function, not by the caller, so the
   * ISO-string assumption above lives in exactly one place. */
  startTime: Date;
  /** Required, positive integer. */
  durationDays: number;
  /** Optional server-side, but this form always sends a real, user-visible
   * IANA zone (see the P1.4 ticket: the engine currently silently defaults
   * to Europe/London when this is omitted, which is a bug for any
   * non-UK company). */
  timeZone?: string;
  description?: string;
  imageUrl?: string;
  backgroundImageUrl?: string;
  /** Optional. Shown in the app as "Sponsored by …". Trimmed here and
   * omitted from the payload when blank — callers may pass the raw field
   * value. See `validateSponsorName` for the limits. */
  sponsorName?: string;
}

export type CreateCompetitionOutcome =
  | { status: "success"; competitionId: string | null }
  | { status: "failure"; failure: CreateCompetitionFailure };

export async function createCompetition(input: CreateCompetitionInput): Promise<CreateCompetitionOutcome> {
  const callable = httpsCallable(getFunctionsClient(), "createCompetition");

  const sponsorName = input.sponsorName?.trim();

  const requestBody = {
    name: input.name,
    // See this file's header comment, point 1 — ISO string, unverified.
    startTime: input.startTime.toISOString(),
    durationDays: input.durationDays,
    ...(input.timeZone ? { timeZone: input.timeZone } : {}),
    ...(input.description ? { description: input.description } : {}),
    ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
    ...(input.backgroundImageUrl ? { backgroundImageUrl: input.backgroundImageUrl } : {}),
    ...(sponsorName ? { sponsorName } : {}),
    // Deliberately absent: startDate, endDate, status, playerCount,
    // configVersion, finalisedAt, winnerIds — all engine-derived, per this
    // file's header comment. Do not add any of them here.
  };

  try {
    const result = await callable(requestBody);
    const data = result.data as { competitionId?: unknown } | undefined;
    return {
      status: "success",
      competitionId: typeof data?.competitionId === "string" ? data.competitionId : null,
    };
  } catch (error) {
    return { status: "failure", failure: toCreateCompetitionFailure(error) };
  }
}
