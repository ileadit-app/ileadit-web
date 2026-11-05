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
