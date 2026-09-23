import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FunctionsError } from "firebase/functions";

/**
 * PC-9 review item 4: the detail-page tests mock `joinCompetition` with an
 * already-mapped failure, so nothing proved this wrapper actually runs a
 * thrown `FunctionsError` through `toCompetitionMembershipFailure`. Same
 * two-mock callable-boundary discipline as `invites.test.ts`: the mocked
 * `httpsCallable` rejects, and this module's REAL try/catch and mapping run.
 */

const mockCallable = vi.fn();
vi.mock("firebase/functions", () => ({
  httpsCallable: () => mockCallable,
}));

vi.mock("./functions", () => ({
  getFunctionsClient: () => ({}),
}));

import { joinCompetition } from "./joinCompetition";

function functionsError(
  code: FunctionsError["code"],
  message: string,
  details?: unknown,
): FunctionsError {
  const error = new Error(message) as unknown as FunctionsError;
  (error as { code: FunctionsError["code"] }).code = code;
  (error as { details?: unknown }).details = details;
  return error;
}

describe("joinCompetition — PC-9 refusal mapping through the real wrapper", () => {
  beforeEach(() => {
    mockCallable.mockReset();
  });

  it("PC-9-JOIN-1: permission-denied with details.reason competition-private maps to competition-private", async () => {
    mockCallable.mockRejectedValueOnce(
      functionsError("functions/permission-denied", "this competition is private", { reason: "competition-private" }),
    );
    const outcome = await joinCompetition("c1");
    expect(outcome.status).toBe("failure");
    if (outcome.status !== "failure") return;
    expect(outcome.failure.reason).toBe("competition-private");
  });

  it("PC-9-JOIN-2: failed-precondition with details.reason overlapping-competition maps to overlapping-competition", async () => {
    mockCallable.mockRejectedValueOnce(
      functionsError("functions/failed-precondition", "already in an overlapping competition", {
        reason: "overlapping-competition",
      }),
    );
    const outcome = await joinCompetition("c1");
    expect(outcome.status).toBe("failure");
    if (outcome.status !== "failure") return;
    expect(outcome.failure.reason).toBe("overlapping-competition");
  });

  it("PC-9-JOIN-3 (negative): failed-precondition without details.reason is not overlapping-competition", async () => {
    mockCallable.mockRejectedValueOnce(
      functionsError("functions/failed-precondition", "competition is not open for joining"),
    );
    const outcome = await joinCompetition("c1");
    expect(outcome.status).toBe("failure");
    if (outcome.status !== "failure") return;
    expect(outcome.failure.reason).not.toBe("overlapping-competition");
    expect(outcome.failure.reason).not.toBe("competition-private");
  });

  it("PC-9-JOIN-4: success passes the callable result through unchanged", async () => {
    mockCallable.mockResolvedValueOnce({ data: { joined: true, alreadyMember: false, playerCount: 3 } });
    const outcome = await joinCompetition("c1");
    expect(outcome).toEqual({
      status: "success",
      result: { joined: true, alreadyMember: false, playerCount: 3 },
    });
    expect(mockCallable).toHaveBeenCalledWith({ competitionId: "c1" });
  });
});
