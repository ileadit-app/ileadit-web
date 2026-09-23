import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Two-mock callable-boundary discipline (same as `ensureAccount.test.ts` /
 * `invites.test.ts`): `firebase/functions`'s `httpsCallable` IS the boundary
 * under test — `createCompetition` isn't deployed/merged anywhere readable
 * (see this module's own header comment), so every test here drives a
 * mocked resolve/reject through this wrapper's REAL request-building and
 * try/catch code. `./functions`'s `getFunctionsClient` is stubbed only to
 * avoid real Firebase/App Check init in jsdom — never inspected directly.
 *
 * This file exists specifically to pin the payload shape for
 * `createCompetition`'s four optional fields (`timeZone`, `description`,
 * `imageUrl`, `backgroundImageUrl`) — the same undefined-vs-omitted class of
 * bug fixed for `createInvite` (see `callablePayload.ts` / `invites.test.ts`
 * MUT-CREATE-3). `createCompetition.ts` already avoided ever sending an
 * explicit `undefined` (its request body used a per-field conditional
 * spread before this ticket), but it's now routed through the shared
 * `compactPayload` helper for consistency — these tests protect that
 * refactor from silently regressing the omission behaviour.
 *
 * `visibility` (PC-9 contract correction) is REQUIRED and sent
 * unconditionally — every call below includes it, matching
 * `CreateCompetitionInput`'s real shape on this branch.
 */

const mockCallable = vi.fn();
vi.mock("firebase/functions", () => ({
  httpsCallable: () => mockCallable,
}));

vi.mock("./functions", () => ({
  getFunctionsClient: () => ({}),
}));

const START_TIME = new Date("2026-10-01T09:00:00.000Z");

beforeEach(() => {
  mockCallable.mockReset();
});

describe("createCompetition — optional field payload shape", () => {
  it("MUT-CC-1: omits timeZone/description/imageUrl/backgroundImageUrl entirely when none are provided", async () => {
    mockCallable.mockResolvedValueOnce({ data: { competitionId: "comp1" } });
    const { createCompetition } = await import("./createCompetition");

    await createCompetition({
      name: "Step Champs",
      startTime: START_TIME,
      durationDays: 7,
      visibility: "private",
    });

    expect(mockCallable).toHaveBeenCalledWith({
      name: "Step Champs",
      startTime: START_TIME.toISOString(),
      durationDays: 7,
      visibility: "private",
    });
    const sentPayload = mockCallable.mock.calls[0][0] as Record<string, unknown>;
    expect("timeZone" in sentPayload).toBe(false);
    expect("description" in sentPayload).toBe(false);
    expect("imageUrl" in sentPayload).toBe(false);
    expect("backgroundImageUrl" in sentPayload).toBe(false);
  });

  it("MUT-CC-2: includes timeZone/description/imageUrl/backgroundImageUrl when all are provided", async () => {
    mockCallable.mockResolvedValueOnce({ data: { competitionId: "comp1" } });
    const { createCompetition } = await import("./createCompetition");

    await createCompetition({
      name: "Step Champs",
      startTime: START_TIME,
      durationDays: 7,
      visibility: "public",
      timeZone: "Europe/London",
      description: "A friendly step-off",
      imageUrl: "https://example.com/a.png",
      backgroundImageUrl: "https://example.com/b.png",
    });

    expect(mockCallable).toHaveBeenCalledWith({
      name: "Step Champs",
      startTime: START_TIME.toISOString(),
      durationDays: 7,
      visibility: "public",
      timeZone: "Europe/London",
      description: "A friendly step-off",
      imageUrl: "https://example.com/a.png",
      backgroundImageUrl: "https://example.com/b.png",
    });
  });

  it("MUT-CC-3: an empty-string description is treated the same as absent (existing behaviour, preserved through compactPayload)", async () => {
    mockCallable.mockResolvedValueOnce({ data: { competitionId: "comp1" } });
    const { createCompetition } = await import("./createCompetition");

    await createCompetition({
      name: "Step Champs",
      startTime: START_TIME,
      durationDays: 7,
      visibility: "private",
      description: "",
    });

    const sentPayload = mockCallable.mock.calls[0][0] as Record<string, unknown>;
    expect("description" in sentPayload).toBe(false);
  });

  it("MUT-CC-4: never sends the engine-derived fields (status, playerCount, etc.)", async () => {
    mockCallable.mockResolvedValueOnce({ data: { competitionId: "comp1" } });
    const { createCompetition } = await import("./createCompetition");

    await createCompetition({
      name: "Step Champs",
      startTime: START_TIME,
      durationDays: 7,
      visibility: "private",
    });

    const sentPayload = mockCallable.mock.calls[0][0] as Record<string, unknown>;
    for (const forbidden of ["status", "playerCount", "startDate", "endDate", "configVersion", "finalisedAt", "winnerIds"]) {
      expect(forbidden in sentPayload).toBe(false);
    }
  });

  it("MUT-CC-5: visibility is always sent, even when every optional field is absent", async () => {
    mockCallable.mockResolvedValueOnce({ data: { competitionId: "comp1" } });
    const { createCompetition } = await import("./createCompetition");

    await createCompetition({
      name: "Step Champs",
      startTime: START_TIME,
      durationDays: 7,
      visibility: "public",
    });

    const sentPayload = mockCallable.mock.calls[0][0] as Record<string, unknown>;
    expect(sentPayload.visibility).toBe("public");
  });
});
