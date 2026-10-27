import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PrizeTerms } from "./PrizeTerms";

/**
 * PRZ-W1-FIX1 (W4) — pins the public prize-terms page's four states:
 * loading, not-found ("No prize terms for this competition"), the
 * draft-not-approved notice, and a normal approved-terms render (sanitised
 * inline HTML in the site's own typography — see `PrizeTerms.tsx`'s header
 * comment for why this replaced the original sandboxed-iframe approach).
 * Mocks `@/lib/competitionTerms` directly (the hook + the
 * `DRAFT-NOT-APPROVED` sentinel check) rather than Firestore itself — same
 * "mock the module boundary the component actually reads" discipline
 * `InviteLanding.test.tsx` already uses. DOMPurify itself is NOT mocked —
 * the sanitisation tests below exercise the real library, since that's the
 * actual thing this file needs proven.
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

  it("approved terms: renders the html as real page content, no draft notice", () => {
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
    expect(screen.getByText("Final terms text")).toBeInTheDocument();
  });

  it("sanitisation: a <script> tag and an onerror= attribute are stripped", () => {
    useCompetitionTermsMock.mockReturnValue({
      status: "success",
      terms: {
        version: "v2",
        html:
          '<p>Safe text</p><script>window.hacked = true;</script>' +
          '<img src="x" onerror="window.hacked = true" />',
        generatedAt: null,
        approvedTemplateVersion: "v2",
      },
    });
    const { container } = render(<PrizeTerms competitionId="comp-1" />);
    expect(screen.getByText("Safe text")).toBeInTheDocument();
    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain("onerror");
    expect(container.innerHTML).not.toContain("hacked");
  });

  it("sanitisation: allowed tags (headings, lists, strong, em, a[href]) survive", () => {
    useCompetitionTermsMock.mockReturnValue({
      status: "success",
      terms: {
        version: "v2",
        html:
          "<h2>Eligibility</h2>" +
          "<p>Open to <strong>UK</strong> residents only, see <em>below</em>.</p>" +
          "<ul><li>One</li><li>Two</li></ul>" +
          '<a href="https://ileadit.app/terms">full terms</a>',
        generatedAt: null,
        approvedTemplateVersion: "v2",
      },
    });
    render(<PrizeTerms competitionId="comp-1" />);
    expect(screen.getByRole("heading", { level: 2, name: "Eligibility" })).toBeInTheDocument();
    expect(screen.getByText("UK").tagName).toBe("STRONG");
    expect(screen.getByText("below").tagName).toBe("EM");
    expect(screen.getByRole("list")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "full terms" });
    expect(link).toHaveAttribute("href", "https://ileadit.app/terms");
  });

  it("sanitisation: a javascript: link href is stripped (no href survives)", () => {
    useCompetitionTermsMock.mockReturnValue({
      status: "success",
      terms: {
        version: "v2",
        html: '<a href="javascript:alert(1)">click me</a>',
        generatedAt: null,
        approvedTemplateVersion: "v2",
      },
    });
    render(<PrizeTerms competitionId="comp-1" />);
    const link = screen.getByText("click me");
    expect(link).not.toHaveAttribute("href");
  });
});
