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
});

describe("JOIN-CODE-W helpers and age-not-confirmed", () => {
  it("formatInviteCodeSpaced groups 4+4 with a space; the hyphen form is unchanged", async () => {
    const { formatInviteCodeSpaced, formatInviteCodeForDisplay } = await import("./invites");
    expect(formatInviteCodeSpaced("k7m4-pqx2")).toBe("K7M4 PQX2");
    expect(formatInviteCodeForDisplay("k7m4pqx2")).toBe("K7M4-PQX2");
    expect(formatInviteCodeSpaced("BEAN26")).toBe("BEAN26");
  });

  it("buildAppInviteUrl is ileadit://invite/ plus the plain 8-character code", async () => {
    const { buildAppInviteUrl } = await import("./invites");
    expect(buildAppInviteUrl("k7m4 pqx2")).toBe("ileadit://invite/K7M4PQX2");
  });

  it("MUT-AGE-1: details.reason age-not-confirmed maps to its own kind with the app message", async () => {
    mockCallable.mockRejectedValueOnce(
      functionsError("functions/failed-precondition", "age not confirmed", {
        reason: "age-not-confirmed",
      }),
    );
    const { acceptInvite, acceptInviteFailureMessage } = await import("./invites");
    const outcome = await acceptInvite("K7M4-PQX2");
    expect(outcome.status).toBe("failure");
    if (outcome.status === "failure") {
      expect(outcome.failure.kind).toBe("age-not-confirmed");
      expect(acceptInviteFailureMessage(outcome.failure, "K7M4 PQX2")).toBe(
        "Finish setting up your account in the ileadit app first, then join with code K7M4 PQX2 in the app or here.",
      );
      expect(acceptInviteFailureMessage(outcome.failure)).toMatch(/finish setting up your account/i);
    }
  });

  it("a different details.reason does not become age-not-confirmed", async () => {
    mockCallable.mockRejectedValueOnce(
      functionsError("functions/failed-precondition", "competition is not open for joining", {
        reason: "something-else",
      }),
    );
    const { acceptInvite } = await import("./invites");
    const outcome = await acceptInvite("K7M4-PQX2");
    expect(outcome.status === "failure" && outcome.failure.kind).toBe("join-refused");
  });
});

describe("acceptInvite — engine refusal reasons (WEB-INVITE-FIXES-1)", () => {
  it("MUT-REASON-OVERLAP-A: details.reason overlap shows the already-in-a-competition copy, not 'isn't available'", async () => {
    mockCallable.mockRejectedValueOnce(
      functionsError("functions/failed-precondition", "You're already in a competition on those dates.", {
        reason: "overlap",
      }),
    );
    const { acceptInvite, acceptInviteFailureMessage } = await import("./invites");
    const outcome = await acceptInvite("K7M4-PQX2");
    expect(outcome.status).toBe("failure");
    if (outcome.status === "failure") {
      expect(acceptInviteFailureMessage(outcome.failure)).toBe(
        "You're already in a competition on those dates.",
      );
    }
  });

  it("MUT-REASON-OVERLAP-B: matches on details.reason, not message text", async () => {
    mockCallable.mockRejectedValueOnce(
      functionsError("functions/failed-precondition", "some other wording entirely", {
        reason: "overlap",
      }),
    );
    const { acceptInvite, acceptInviteFailureMessage } = await import("./invites");
    const outcome = await acceptInvite("K7M4-PQX2");
    expect(outcome.status === "failure" && acceptInviteFailureMessage(outcome.failure)).toBe(
      "You're already in a competition on those dates.",
    );
  });

  it("MUT-REASON-INVITEONLY-A: details.reason invite-only shows the invite-only copy", async () => {
    mockCallable.mockRejectedValueOnce(
      functionsError("functions/failed-precondition", "This competition is invite only.", {
        reason: "invite-only",
      }),
    );
    const { acceptInvite, acceptInviteFailureMessage } = await import("./invites");
    const outcome = await acceptInvite("K7M4-PQX2");
    expect(outcome.status === "failure" && acceptInviteFailureMessage(outcome.failure)).toBe(
      "This competition is invite only. Ask the organiser for an invite code.",
    );
  });

  it("MUT-REASON-UNCHANGED: a revoked/expired code with no reason keeps the generic 'isn't available' copy", async () => {
    mockCallable.mockRejectedValueOnce(
      functionsError("functions/failed-precondition", "invite has expired", { reason: "invite-expired" }),
    );
    const { acceptInvite, acceptInviteFailureMessage } = await import("./invites");
    const outcome = await acceptInvite("K7M4-PQX2");
    expect(outcome.status === "failure" && acceptInviteFailureMessage(outcome.failure)).toMatch(
      /isn't available any more/i,
    );
  });
});

describe("createInvite — optional fields are left out, never sent as null (WEB-INVITE-FIXES-1)", () => {
  const okResult = {
    data: { code: "K7M4PQX2", displayCode: "K7M4-PQX2", url: "https://ileadit.co.uk/invite/K7M4PQX2" },
  };

  it("MUT-PAYLOAD-LABEL: an undefined label leaves the label key out of the payload", async () => {
    mockCallable.mockResolvedValueOnce(okResult);
    const { createInvite } = await import("./invites");
    await createInvite({ competitionId: "comp1", label: undefined });
    const payload = mockCallable.mock.calls[0][0];
    expect(payload).toEqual({ competitionId: "comp1" });
    expect("label" in payload).toBe(false);
  });

  it("MUT-PAYLOAD-BLANK: a blank or whitespace label, and null/undefined expiresAt/maxUses, are all left out", async () => {
    mockCallable.mockResolvedValueOnce(okResult);
    const { createInvite } = await import("./invites");
    await createInvite({
      competitionId: "comp1",
      label: "   ",
      expiresAt: undefined,
      maxUses: null as unknown as undefined,
    });
    expect(Object.keys(mockCallable.mock.calls[0][0])).toEqual(["competitionId"]);
  });

  it("MUT-PAYLOAD-KEPT: real values are still sent (label trimmed)", async () => {
    mockCallable.mockResolvedValueOnce(okResult);
    const { createInvite } = await import("./invites");
    await createInvite({
      competitionId: "comp1",
      label: " Marketing ",
      expiresAt: "2026-12-01T00:00:00.000Z",
      maxUses: 5,
    });
    expect(mockCallable.mock.calls[0][0]).toEqual({
      competitionId: "comp1",
      label: "Marketing",
      expiresAt: "2026-12-01T00:00:00.000Z",
      maxUses: 5,
    });
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
