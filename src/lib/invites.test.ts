import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FunctionsError } from "firebase/functions";

/**
 * Two-mock callable-boundary discipline (same as `ensureAccount.test.ts`):
 * `firebase/functions`'s `httpsCallable` IS the boundary under test — none
 * of Ivor's five invite callables are deployed anywhere readable as of this
 * ticket (WEB-INV-1), so every test here drives a mocked resolve/reject
 * through this module's REAL try/catch and failure-mapping code.
 * `./functions`'s `getFunctionsClient` is stubbed only to avoid real
 * Firebase/App Check init in jsdom — never inspected by the mock.
 */

const mockCallable = vi.fn();
vi.mock("firebase/functions", () => ({
  httpsCallable: () => mockCallable,
}));

vi.mock("./functions", () => ({
  getFunctionsClient: () => ({}),
}));

function functionsError(code: FunctionsError["code"], message: string): FunctionsError {
  const error = new Error(message) as unknown as FunctionsError;
  (error as { code: FunctionsError["code"] }).code = code;
  (error as { details?: unknown }).details = undefined;
  return error;
}

/**
 * PC-9 contract corrections (b)/(c): unlike every other case in this file,
 * `competition-private` and `overlapping-competition` are distinguished by
 * `details.reason`, not just `code`+message substring — see
 * `competitionMembershipErrors.ts`. `functionsError` above hardcodes
 * `details: undefined`, so it can't express this; this sibling helper can.
 */
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

beforeEach(() => {
  mockCallable.mockReset();
});

describe("normalizeInviteCodeInput / isEightCharacterInviteCode / formatInviteCodeForDisplay", () => {
  it("MUT-CODE-1: strips separators and uppercases", async () => {
    const { normalizeInviteCodeInput } = await import("./invites");
    expect(normalizeInviteCodeInput("k7m4-pqx2")).toBe("K7M4PQX2");
    expect(normalizeInviteCodeInput("K7M4 PQX2")).toBe("K7M4PQX2");
  });

  it("MUT-CODE-2: an 8-character code routes as the new invite-code path; a 20-character legacy id does not", async () => {
    const { isEightCharacterInviteCode } = await import("./invites");
    expect(isEightCharacterInviteCode("K7M4-PQX2")).toBe(true);
    expect(isEightCharacterInviteCode("aBcDeFgHiJkLmNoPqRsT")).toBe(false);
  });

  it("MUT-CODE-3: formats a normalised 8-character code as XXXX-XXXX", async () => {
    const { formatInviteCodeForDisplay } = await import("./invites");
    expect(formatInviteCodeForDisplay("k7m4pqx2")).toBe("K7M4-PQX2");
  });
});

describe("previewInvite", () => {
  it("MUT-PREVIEW-1: an available, active competition surfaces status/dayNumber/playerCount as returned", async () => {
    mockCallable.mockResolvedValueOnce({
      data: {
        available: true,
        competitionId: "comp1",
        competitionName: "Step Champs",
        description: null,
        startDate: "2026-09-15",
        endDate: "2026-09-22",
        durationDays: 7,
        status: "active",
        dayNumber: 3,
        playerCount: 12,
      },
    });

    const { previewInvite } = await import("./invites");
    const outcome = await previewInvite("K7M4-PQX2");

    expect(outcome.status).toBe("success");
    if (outcome.status === "success") {
      expect(outcome.result).toEqual({
        available: true,
        competitionId: "comp1",
        competitionName: "Step Champs",
        description: null,
        startDate: "2026-09-15",
        endDate: "2026-09-22",
        durationDays: 7,
        status: "active",
        dayNumber: 3,
        playerCount: 12,
      });
    }
  });

  it("MUT-PREVIEW-2: a revoked/expired/exhausted/unknown code collapses to the ONE uniform available:false result", async () => {
    mockCallable.mockResolvedValueOnce({ data: { available: false } });

    const { previewInvite } = await import("./invites");
    const outcome = await previewInvite("ZZZZ-ZZZZ");

    expect(outcome).toEqual({ status: "success", result: { available: false } });
  });

  it("MUT-PREVIEW-3: normalises input before calling the callable", async () => {
    mockCallable.mockResolvedValueOnce({ data: { available: false } });
    const { previewInvite } = await import("./invites");
    await previewInvite("k7m4-pqx2");
    expect(mockCallable).toHaveBeenCalledWith({ code: "K7M4PQX2" });
  });

  it("MUT-PREVIEW-4: a real failure (not a code-shaped rejection) surfaces as status:failure", async () => {
    mockCallable.mockRejectedValueOnce(functionsError("functions/internal", "boom"));
    const { previewInvite } = await import("./invites");
    const outcome = await previewInvite("K7M4-PQX2");
    expect(outcome.status).toBe("failure");
  });
});

describe("acceptInvite", () => {
  it("MUT-ACCEPT-1: success surfaces the real result, including dayNumber for a mid-competition join", async () => {
    mockCallable.mockResolvedValueOnce({
      data: { competitionId: "comp1", joined: true, alreadyMember: false, dayNumber: 4 },
    });
    const { acceptInvite } = await import("./invites");
    const outcome = await acceptInvite("K7M4-PQX2");
    expect(outcome).toEqual({
      status: "success",
      result: { competitionId: "comp1", joined: true, alreadyMember: false, dayNumber: 4 },
    });
  });

  it("MUT-ACCEPT-2: alreadyMember:true is still a success, not an error", async () => {
    mockCallable.mockResolvedValueOnce({
      data: { competitionId: "comp1", joined: false, alreadyMember: true, dayNumber: null },
    });
    const { acceptInvite } = await import("./invites");
    const outcome = await acceptInvite("K7M4-PQX2");
    expect(outcome.status).toBe("success");
    if (outcome.status === "success") {
      expect(outcome.result.alreadyMember).toBe(true);
    }
  });

  it("MUT-ACCEPT-3: a join-refusal message ('is not open for joining') maps to kind:join-refused, with join-specific copy", async () => {
    mockCallable.mockRejectedValueOnce(
      functionsError("functions/failed-precondition", "competition is not open for joining"),
    );
    const { acceptInvite, acceptInviteFailureMessage } = await import("./invites");
    const outcome = await acceptInvite("K7M4-PQX2");
    expect(outcome.status).toBe("failure");
    if (outcome.status === "failure") {
      expect(outcome.failure.kind).toBe("join-refused");
      expect(acceptInviteFailureMessage(outcome.failure)).toMatch(/already under way|finished|left/i);
    }
  });

  it("MUT-ACCEPT-4: an unrecognised failure maps to kind:invite-unavailable with the uniform copy", async () => {
    mockCallable.mockRejectedValueOnce(
      functionsError("functions/failed-precondition", "invite has been revoked"),
    );
    const { acceptInvite, acceptInviteFailureMessage } = await import("./invites");
    const outcome = await acceptInvite("K7M4-PQX2");
    expect(outcome.status).toBe("failure");
    if (outcome.status === "failure") {
      expect(outcome.failure.kind).toBe("invite-unavailable");
      expect(acceptInviteFailureMessage(outcome.failure)).toMatch(/isn't available any more/i);
    }
  });

  it("PC-9-ACCEPT-5: a permission-denied with details.reason:competition-private maps to kind:join-refused, with the private-specific copy", async () => {
    mockCallable.mockRejectedValueOnce(
      functionsErrorWithReason("functions/permission-denied", "not authorized", "competition-private"),
    );
    const { acceptInvite, acceptInviteFailureMessage } = await import("./invites");
    const outcome = await acceptInvite("K7M4-PQX2");
    expect(outcome.status).toBe("failure");
    if (outcome.status === "failure") {
      expect(outcome.failure.kind).toBe("join-refused");
      if (outcome.failure.kind === "join-refused") {
        expect(outcome.failure.failure.reason).toBe("competition-private");
      }
      expect(acceptInviteFailureMessage(outcome.failure)).toBe(
        "This invite can't be used to join — ask the organiser for a new invite link.",
      );
    }
  });

  it("PC-9-ACCEPT-6: a failed-precondition with details.reason:overlapping-competition maps to kind:join-refused, with the overlap-specific copy", async () => {
    mockCallable.mockRejectedValueOnce(
      functionsErrorWithReason(
        "functions/failed-precondition",
        "already in another competition",
        "overlapping-competition",
      ),
    );
    const { acceptInvite, acceptInviteFailureMessage } = await import("./invites");
    const outcome = await acceptInvite("K7M4-PQX2");
    expect(outcome.status).toBe("failure");
    if (outcome.status === "failure") {
      expect(outcome.failure.kind).toBe("join-refused");
      if (outcome.failure.kind === "join-refused") {
        expect(outcome.failure.failure.reason).toBe("overlapping-competition");
      }
      expect(acceptInviteFailureMessage(outcome.failure)).toBe(
        "You're already in a competition that runs at the same time. You can be in one competition at a time. Leave that one first if you want to switch.",
      );
    }
  });

  it("PC-9-ACCEPT-7: the pre-existing JOIN-1 not-joinable failed-precondition (no details.reason) is unaffected by the new reason check", async () => {
    mockCallable.mockRejectedValueOnce(
      functionsError("functions/failed-precondition", "competition is not open for joining"),
    );
    const { acceptInvite, acceptInviteFailureMessage } = await import("./invites");
    const outcome = await acceptInvite("K7M4-PQX2");
    expect(outcome.status).toBe("failure");
    if (outcome.status === "failure") {
      expect(outcome.failure.kind).toBe("join-refused");
      if (outcome.failure.kind === "join-refused") {
        expect(outcome.failure.failure.reason).toBe("not-joinable");
      }
      expect(acceptInviteFailureMessage(outcome.failure)).toMatch(/already under way|finished|left/i);
    }
  });
});

describe("listInvites / createInvite / revokeInvite — organiser callables", () => {
  it("MUT-LIST-1: returns the invites array from the callable as-is", async () => {
    const invites = [
      {
        code: "K7M4PQX2",
        displayCode: "K7M4-PQX2",
        url: "https://ileadit.co.uk/invite/K7M4PQX2",
        label: "Marketing team",
        createdAt: "2026-09-20T10:00:00.000Z",
        expiresAt: null,
        maxUses: null,
        useCount: 3,
        status: "active" as const,
      },
    ];
    mockCallable.mockResolvedValueOnce({ data: { invites } });
    const { listInvites } = await import("./invites");
    const outcome = await listInvites("comp1");
    expect(outcome).toEqual({ status: "success", invites });
  });

  it("MUT-CREATE-1: success returns code/displayCode/url", async () => {
    mockCallable.mockResolvedValueOnce({
      data: { code: "K7M4PQX2", displayCode: "K7M4-PQX2", url: "https://ileadit.co.uk/invite/K7M4PQX2" },
    });
    const { createInvite } = await import("./invites");
    const outcome = await createInvite({ competitionId: "comp1", label: "Marketing team" });
    expect(outcome.status).toBe("success");
  });

  it("MUT-CREATE-2: a resource-exhausted failure gets the 20-link-limit copy", async () => {
    mockCallable.mockRejectedValueOnce(functionsError("functions/resource-exhausted", "too many invites"));
    const { createInvite, inviteCallableFailureMessage } = await import("./invites");
    const outcome = await createInvite({ competitionId: "comp1" });
    expect(outcome.status).toBe("failure");
    if (outcome.status === "failure") {
      expect(inviteCallableFailureMessage(outcome.failure)).toMatch(/20 active links/i);
    }
  });

  it("MUT-CREATE-3: an explicit label:undefined is NOT sent to the callable — regression test for functions/invalid-argument on a blank label", async () => {
    // This is the exact shape of the production bug (commit 7f76770,
    // 2026-09-23): InvitePanel.tsx used to call
    // createInvite({ competitionId, label: undefined }) for a blank label
    // field. The Firebase SDK serializes an `undefined` property as JSON
    // `null`, which the engine's `label: z.string().max(40).optional()`
    // schema rejects. `createInvite` must strip the key via
    // `compactPayload`, not merely forward whatever the caller passed.
    mockCallable.mockResolvedValueOnce({
      data: { code: "K7M4PQX2", displayCode: "K7M4-PQX2", url: "https://ileadit.co.uk/invite/K7M4PQX2" },
    });
    const { createInvite } = await import("./invites");
    await createInvite({ competitionId: "comp1", label: undefined });

    expect(mockCallable).toHaveBeenCalledWith({ competitionId: "comp1" });
    const sentPayload = mockCallable.mock.calls[0][0] as Record<string, unknown>;
    expect("label" in sentPayload).toBe(false);
  });

  it("MUT-CREATE-4: a real label IS sent to the callable", async () => {
    mockCallable.mockResolvedValueOnce({
      data: { code: "K7M4PQX2", displayCode: "K7M4-PQX2", url: "https://ileadit.co.uk/invite/K7M4PQX2" },
    });
    const { createInvite } = await import("./invites");
    await createInvite({ competitionId: "comp1", label: "Marketing team" });

    expect(mockCallable).toHaveBeenCalledWith({ competitionId: "comp1", label: "Marketing team" });
  });

  it("MUT-CREATE-5: explicit expiresAt:undefined and maxUses:undefined are also stripped, not sent as null", async () => {
    mockCallable.mockResolvedValueOnce({
      data: { code: "K7M4PQX2", displayCode: "K7M4-PQX2", url: "https://ileadit.co.uk/invite/K7M4PQX2" },
    });
    const { createInvite } = await import("./invites");
    await createInvite({
      competitionId: "comp1",
      label: "Marketing team",
      expiresAt: undefined,
      maxUses: undefined,
    });

    const sentPayload = mockCallable.mock.calls[0][0] as Record<string, unknown>;
    expect(sentPayload).toEqual({ competitionId: "comp1", label: "Marketing team" });
    expect("expiresAt" in sentPayload).toBe(false);
    expect("maxUses" in sentPayload).toBe(false);
  });

  it("MUT-REVOKE-1: success resolves to status:success with no payload to check", async () => {
    mockCallable.mockResolvedValueOnce({ data: { revoked: true } });
    const { revokeInvite } = await import("./invites");
    const outcome = await revokeInvite("K7M4-PQX2");
    expect(outcome).toEqual({ status: "success" });
  });

  it("MUT-REVOKE-2: a permission-denied failure gets organiser-specific copy", async () => {
    mockCallable.mockRejectedValueOnce(functionsError("functions/permission-denied", "not your invite"));
    const { revokeInvite, inviteCallableFailureMessage } = await import("./invites");
    const outcome = await revokeInvite("K7M4-PQX2");
    expect(outcome.status).toBe("failure");
    if (outcome.status === "failure") {
      expect(inviteCallableFailureMessage(outcome.failure)).toMatch(/don't have permission/i);
    }
  });
});
