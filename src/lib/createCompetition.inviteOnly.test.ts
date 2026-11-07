import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCompetition } from "./createCompetition";

/** INVITE-2: the wrapper's own payload rules, at the callable boundary. */
const callable = vi.fn();
vi.mock("firebase/functions", () => ({ httpsCallable: () => callable }));
vi.mock("./functions", () => ({ getFunctionsClient: () => ({}) }));

const base = { name: "x", startTime: new Date("2027-06-01T09:00:00Z"), durationDays: 7 };

beforeEach(() => {
  callable.mockReset();
  callable.mockResolvedValue({ data: { competitionId: "c1" } });
});

describe("createCompetition — inviteOnly", () => {
  it("sends inviteOnly: true when true", async () => {
    await createCompetition({ ...base, inviteOnly: true });
    expect(callable.mock.calls[0][0].inviteOnly).toBe(true);
  });

  it("leaves the key out for false and for undefined", async () => {
    await createCompetition({ ...base, inviteOnly: false });
    await createCompetition(base);
    expect(callable.mock.calls[0][0]).not.toHaveProperty("inviteOnly");
    expect(callable.mock.calls[1][0]).not.toHaveProperty("inviteOnly");
  });

  it("never sends inviteOnly together with a Local to town (engine would refuse)", async () => {
    await createCompetition({ ...base, inviteOnly: true, localToCityId: 2644688, localRadiusKm: 25 });
    const body = callable.mock.calls[0][0];
    expect(body.inviteOnly).toBe(true);
    expect(body).not.toHaveProperty("localToCityId");
    expect(body).not.toHaveProperty("localRadiusKm");
  });
});
