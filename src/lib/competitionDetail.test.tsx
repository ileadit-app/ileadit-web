import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCompetitionDetail } from "./competitionDetail";

/**
 * WEB-SPONSOR-NAME r2 — the competition document read. Only the Firestore
 * SDK and the lazy `getFirebaseDb` are mocked (neither can run without a
 * real project); the hook's own field parsing runs for real.
 */

const snapshotData = vi.fn<() => Record<string, unknown>>();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(() => ({})),
  orderBy: vi.fn(),
  query: vi.fn(),
  onSnapshot: (_ref: unknown, onNext: (snapshot: unknown) => void) => {
    onNext({ exists: () => true, id: "comp-1", data: () => snapshotData() });
    return () => {};
  },
}));
vi.mock("./firebase", () => ({ getFirebaseDb: () => ({}) }));

function sponsorNameFor(data: Record<string, unknown>): string | null {
  snapshotData.mockReturnValue(data);
  const { result } = renderHook(() => useCompetitionDetail("comp-1"));
  if (result.current.status !== "success") throw new Error("expected success");
  return result.current.competition.sponsorName;
}

beforeEach(() => snapshotData.mockReset());

describe("useCompetitionDetail — sponsorName", () => {
  it("reads sponsorName from the field of exactly that name", () => {
    expect(sponsorNameFor({ name: "x", sponsorName: "Acme Ltd" })).toBe("Acme Ltd");
  });

  it("trims it", () => {
    expect(sponsorNameFor({ sponsorName: "  Acme Ltd  " })).toBe("Acme Ltd");
  });

  it("is null when absent, blank, or not a string", () => {
    expect(sponsorNameFor({ name: "x" })).toBeNull();
    expect(sponsorNameFor({ sponsorName: "   " })).toBeNull();
    expect(sponsorNameFor({ sponsorName: 42 })).toBeNull();
    expect(sponsorNameFor({ sponsorName: null })).toBeNull();
  });
});

describe("useCompetitionDetail — inviteOnly (INVITE-2)", () => {
  function inviteOnlyFor(data: Record<string, unknown>): boolean {
    snapshotData.mockReturnValue(data);
    const { result } = renderHook(() => useCompetitionDetail("comp-1"));
    if (result.current.status !== "success") throw new Error("expected success");
    return result.current.competition.inviteOnly;
  }

  it("is true only for the boolean true", () => {
    expect(inviteOnlyFor({ inviteOnly: true })).toBe(true);
  });

  it("is false when absent, false, the string 'true', 1, or null", () => {
    expect(inviteOnlyFor({ name: "x" })).toBe(false);
    expect(inviteOnlyFor({ inviteOnly: false })).toBe(false);
    expect(inviteOnlyFor({ inviteOnly: "true" })).toBe(false);
    expect(inviteOnlyFor({ inviteOnly: 1 })).toBe(false);
    expect(inviteOnlyFor({ inviteOnly: null })).toBe(false);
  });
});
