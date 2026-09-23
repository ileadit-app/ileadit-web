import { describe, expect, it } from "vitest";
import type { FunctionsError } from "firebase/functions";
import {
  toCompetitionMembershipFailure,
  competitionMembershipFailureMessage,
} from "./competitionMembershipErrors";

/**
 * PC-9 review item 4: the detail-page join-refusal tests
 * (`CompetitionDetail.test.tsx`'s PC-9-DETAIL-JOIN-*) mocked `joinCompetition`
 * with an ALREADY-MAPPED `reason`, so they only ever exercised the copy
 * switch in `competitionMembershipFailureMessage` — never the actual mapping
 * function, `toCompetitionMembershipFailure`, which is the piece that reads
 * `error.code`/`error.details.reason` off a real thrown `FirebaseError`. This
 * file drives that function directly, including the two negative cases the
 * review specifically called out: a `permission-denied` with no
 * `details.reason` must NOT be treated as `competition-private`, and a
 * `failed-precondition` with no `details.reason` must fall through to the
 * pre-existing JOIN-1 "not open for joining" message, not `overlapping-
 * competition`.
 *
 * Same `functionsError`/`functionsErrorWithReason` construction as
 * `invites.test.ts` — a real `Error` with a `code`/`details` pair grafted on,
 * shaped exactly like the `FunctionsError` the Firebase Functions SDK throws.
 */

function functionsError(code: FunctionsError["code"], message: string): FunctionsError {
  const error = new Error(message) as unknown as FunctionsError;
  (error as { code: FunctionsError["code"] }).code = code;
  (error as { details?: unknown }).details = undefined;
  return error;
}

function functionsErrorWithReason(
  code: FunctionsError["code"],
  message: string,
  reason: string,
): FunctionsError {
  const error = new Error(message) as unknown as FunctionsError;
  (error as { code: FunctionsError["code"] }).code = code;
  (error as { details?: unknown }).details = { reason };
  return error;
}

describe("toCompetitionMembershipFailure — PC-9 competition-private / overlapping-competition", () => {
  it("PC-9-MAP-1: permission-denied with details.reason:competition-private maps to reason:competition-private", () => {
    const failure = toCompetitionMembershipFailure(
      functionsErrorWithReason("functions/permission-denied", "not authorized", "competition-private"),
    );
    expect(failure.reason).toBe("competition-private");
    expect(competitionMembershipFailureMessage(failure, "join")).toBe(
      "This is a private competition — you'll need an invite link to join it.",
    );
  });

  it("PC-9-MAP-2 (negative): permission-denied WITHOUT details.reason must NOT map to competition-private", () => {
    const failure = toCompetitionMembershipFailure(
      functionsError("functions/permission-denied", "not authorized"),
    );
    expect(failure.reason).not.toBe("competition-private");
    expect(failure.reason).toBe("unknown");
  });

  it("PC-9-MAP-3: failed-precondition with details.reason:overlapping-competition maps to reason:overlapping-competition", () => {
    const failure = toCompetitionMembershipFailure(
      functionsErrorWithReason(
        "functions/failed-precondition",
        "already in another competition",
        "overlapping-competition",
      ),
    );
    expect(failure.reason).toBe("overlapping-competition");
    expect(competitionMembershipFailureMessage(failure, "join")).toBe(
      "You're already in another active competition, and ileadit only allows one at a time. Leave that one first if you want to switch.",
    );
  });

  it("PC-9-MAP-4 (negative): failed-precondition WITHOUT details.reason stays the pre-existing JOIN-1 'not open for joining' message, not overlapping-competition", () => {
    const failure = toCompetitionMembershipFailure(
      functionsError("functions/failed-precondition", "competition is not open for joining"),
    );
    expect(failure.reason).not.toBe("overlapping-competition");
    expect(failure.reason).toBe("not-joinable");
    expect(competitionMembershipFailureMessage(failure, "join")).toMatch(/already under way|finished|left/i);
  });

  it("PC-9-MAP-5 (negative): failed-precondition with an UNRELATED details.reason still falls through to message-substring matching, not overlapping-competition", () => {
    const failure = toCompetitionMembershipFailure(
      functionsErrorWithReason(
        "functions/failed-precondition",
        "competition is not open for leaving",
        "something-else",
      ),
    );
    expect(failure.reason).toBe("not-joinable");
  });
});
