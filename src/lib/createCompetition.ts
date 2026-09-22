import { httpsCallable } from "firebase/functions";
import { getFunctionsClient } from "./functions";
import { toCreateCompetitionFailure, type CreateCompetitionFailure } from "./createCompetitionErrors";

/**
 * Wrapper for the `createCompetition` callable (P1.3, Ivor — branch
 * `engine/p1-create-competition`, **NOT deployed** as of 2026-09-20). Built
 * strictly against the contract given in the P1.4 ticket brief:
 *
 *   createCompetition({ name, startTime, durationDays, timeZone?,
 *     description?, imageUrl?, backgroundImageUrl? })
 *
 * **PC-9 update (2026-09-23):** the callable's input gains a REQUIRED
 * `visibility: "public" | "private"` field (engine branch
 * `engine/pc1-visibility`, also not yet deployed) — strict schema, a missing
 * value is rejected with `functions/invalid-argument`. Unlike every other
 * field below, this one is confirmed by the ticket brief itself (not an
 * agent guess), so it's sent unconditionally rather than spread-in only
 * when present.
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
  /** REQUIRED (PC-9 contract correction) — no server-side default, unlike
   * every optional field below. `CreateCompetitionForm` always sends a real
   * value, pre-selected to `"private"` per Paul's decision; there is no
   * "unset" UI state to guard against. Sent unconditionally in the request
   * body below, not spread-in like the optional fields. */
  visibility: "public" | "private";
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

  const requestBody = {
    name: input.name,
    // See this file's header comment, point 1 — ISO string, unverified.
    startTime: input.startTime.toISOString(),
    durationDays: input.durationDays,
    // Required, sent unconditionally — see this file's header comment and
    // the field's own doc comment on CreateCompetitionInput above.
    visibility: input.visibility,
    ...(input.timeZone ? { timeZone: input.timeZone } : {}),
    ...(input.description ? { description: input.description } : {}),
    ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
    ...(input.backgroundImageUrl ? { backgroundImageUrl: input.backgroundImageUrl } : {}),
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
