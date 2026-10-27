import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PrizeTerms } from "./PrizeTerms";

/**
 * PRZ-W1 (W4) — pins the public prize-terms page's four states: loading,
 * not-found ("No prize terms for this competition"), the draft-not-approved
 * notice, and a normal approved-terms render (iframe with `sandbox=""`,
 * never `dangerouslySetInnerHTML`). Mocks `@/lib/competitionTerms` directly
 * (the hook + the `DRAFT-NOT-APPROVED` sentinel check) rather than Firestore
 * itself — same "mock the module boundary the component actually reads"
 * discipline `InviteLanding.test.tsx` already uses.
 */

const useCompetitionTermsMock = vi.fn();
vi.mock("@/lib/competitionTerms", async () => {
  const actual = await vi.importActual<typeof import("@/lib/competitionTerms")>("@/lib/competitionTerms");
  return {
    ...actual,
    useCompetitionTerms: (id: string) => useCompetitionTermsMock(id),
  };
});

beforeEach(() => {
  useCompetitionTermsMock.mockReset();
});

describe("PrizeTerms", () => {
  it("loading: shows a loading status, not a blank page", () => {
    useCompetitionTermsMock.mockReturnValue({ status: "loading" });
    render(<PrizeTerms competitionId="comp-1" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it('not-found: shows "No prize terms for this competition"', () => {
    useCompetitionTermsMock.mockReturnValue({ status: "not-found" });
    render(<PrizeTerms competitionId="comp-1" />);
    expect(screen.getByText(/no prize terms for this competition/i)).toBeInTheDocument();
  });

  it("error: shows a distinct error message, never the not-found copy", () => {
    useCompetitionTermsMock.mockReturnValue({ status: "error", error: new Error("boom") });
    render(<PrizeTerms competitionId="comp-1" />);
    expect(screen.getByText(/we couldn.t load these terms/i)).toBeInTheDocument();
    expect(screen.queryByText(/no prize terms for this competition/i)).not.toBeInTheDocument();
  });

  it('draft, not approved: shows the "not yet approved" notice', () => {
    useCompetitionTermsMock.mockReturnValue({
      status: "success",
      terms: {
        version: "v1",
        html: "<p>Draft text</p>",
        generatedAt: null,
        approvedTemplateVersion: "DRAFT-NOT-APPROVED",
      },
    });
    render(<PrizeTerms competitionId="comp-1" />);
    expect(screen.getByText(/not yet approved/i)).toBeInTheDocument();
  });

  it("approved terms: renders the html inside a sandboxed iframe, no draft notice", () => {
    useCompetitionTermsMock.mockReturnValue({
      status: "success",
      terms: {
        version: "v2",
        html: "<p>Final terms text</p>",
        generatedAt: null,
        approvedTemplateVersion: "v2",
      },
    });
    render(<PrizeTerms competitionId="comp-1" />);
    expect(screen.queryByText(/not yet approved/i)).not.toBeInTheDocument();

    const iframe = screen.getByTitle(/prize terms/i) as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute("sandbox")).toBe("");
    expect(iframe.getAttribute("srcdoc")).toContain("Final terms text");
  });
});
