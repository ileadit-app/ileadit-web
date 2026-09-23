import { httpsCallable } from "firebase/functions";
import { getFunctionsClient } from "./functions";
import { compactPayload } from "./callablePayload";
import { toCreateCompetitionFailure, type CreateCompetitionFailure } from "./createCompetitionErrors";

/**
 * Wrapper for the `createCompetition` callable (P1.3, Ivor — branch
 * `engine/p1-create-competition`, **NOT deployed** as of 2026-09-20). Built
 * strictly against the contract given in the P1.4 ticket brief:
 *
 *   createCompetition({ name, startTime, durationDays, timeZone?,
 *     description?, imageUrl?, backgroundImageUrl? })
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
}

export type CreateCompetitionOutcome =
  | { status: "success"; competitionId: string | null }
  | { status: "failure"; failure: CreateCompetitionFailure };

export async function createCompetition(input: CreateCompetitionInput): Promise<CreateCompetitionOutcome> {
  const callable = httpsCallable(getFunctionsClient(), "createCompetition");

  // compactPayload (see callablePayload.ts) strips any key whose value is
  // `undefined` before this reaches `httpsCallable` — an `undefined`-valued
  // key serializes to JSON `null` on the wire, which the engine's
  // `.optional()` zod schema rejects (it only accepts the key being
  // MISSING). The `|| undefined` normalisation below preserves this
  // function's existing behaviour of treating an empty string the same as
  // "not provided" for these four fields, while routing the actual
  // omission through the one shared helper instead of a local
  // conditional-spread per field.
  const requestBody = compactPayload({
    name: input.name,
    // See this file's header comment, point 1 — ISO string, unverified.
    startTime: input.startTime.toISOString(),
    durationDays: input.durationDays,
    timeZone: input.timeZone || undefined,
    description: input.description || undefined,
    imageUrl: input.imageUrl || undefined,
    backgroundImageUrl: input.backgroundImageUrl || undefined,
    // Deliberately absent: startDate, endDate, status, playerCount,
    // configVersion, finalisedAt, winnerIds — all engine-derived, per this
    // file's header comment. Do not add any of them here.
  });

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
