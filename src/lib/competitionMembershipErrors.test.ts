import { describe, it, expect } from "vitest";
import type { FunctionsError } from "firebase/functions";
import {
  competitionMembershipFailureMessage,
  toCompetitionMembershipFailure,
} from "./competitionMembershipErrors";

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

describe("joinCompetition refusal reasons (WEB-INVITE-FIXES-1)", () => {
  it("MUT-MEM-OVERLAP: details.reason overlap maps to the apps' wording", () => {
    const failure = toCompetitionMembershipFailure(
      functionsError("functions/failed-precondition", "anything", { reason: "overlap" }),
    );
    expect(failure.reason).toBe("overlap");
    expect(competitionMembershipFailureMessage(failure, "join")).toBe(
      "You're already in a competition on those dates.",
    );
  });

  it("MUT-MEM-INVITEONLY: details.reason invite-only maps to the invite-only line", () => {
    const failure = toCompetitionMembershipFailure(
      functionsError("functions/failed-precondition", "This competition is invite only.", {
        reason: "invite-only",
      }),
    );
    expect(failure.reason).toBe("invite-only");
    expect(competitionMembershipFailureMessage(failure, "join")).toBe(
      "This competition is invite only. Ask the organiser for an invite code.",
    );
  });

  it("MUT-MEM-NOT-TEXT: the message text alone does not trigger either reason", () => {
    const failure = toCompetitionMembershipFailure(
      functionsError("functions/failed-precondition", "This competition is invite only."),
    );
    expect(failure.reason).toBe("unknown");
  });

  it("MUT-MEM-EXISTING: existing refusals are unchanged", () => {
    const notJoinable = toCompetitionMembershipFailure(
      functionsError("functions/failed-precondition", "competition is not open for joining"),
    );
    expect(notJoinable.reason).toBe("not-joinable");
    expect(competitionMembershipFailureMessage(notJoinable, "join")).toMatch(/can't join this one any more/);
  });
});
