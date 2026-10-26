import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AccountDeletion from "./page";

/**
 * WEB-LEGAL-1. Pins the approved copy
 * (.ticket-refs/account-deletion-APPROVED-20261026.md, Paul, 26 Oct 2026)
 * now live on `/account-deletion`. Supersedes the previous W3-DELETION-AUDIT
 * test file, which pinned an earlier draft of this page's wording (e.g.
 * "Deleted Player" instead of the now-approved "A former player", and a
 * Microsoft-sign-in hedge that the approved copy deliberately drops).
 *
 * `next/link` is stubbed to a plain anchor — routing context isn't under
 * test here. `@/context/AuthContext`'s `useUser` is the one thing the page
 * actually reads that needs controlling per-test.
 */

const useUserMock = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useUser: () => useUserMock(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  useUserMock.mockReset();
  useUserMock.mockReturnValue({ status: "signed-out", user: null });
});

describe("/account-deletion — approved copy (WEB-LEGAL-1)", () => {
  // MUT: reverted the "in the app" section's heading text -> RED, restored
  // -> GREEN.
  it("explains the quickest way is in the app, via Settings", () => {
    render(<AccountDeletion />);

    const heading = screen.getByRole("heading", { name: /the quickest way: in the app/i });
    const section = heading.closest("div");
    expect(section).not.toBeNull();
    expect(section).toHaveTextContent(/settings/i);
  });

  // MUT: deleted "within one month" and restored the old "30 days"/
  // "provisional" wording -> RED, restored -> GREEN. Also proves the old
  // "best-effort... needs sign-off from Paul and legal counsel" hedge and
  // the standalone "How long it takes" section are gone.
  it("states the without-app deletion timing as \"within one month\", with no provisional/SLA hedging", () => {
    render(<AccountDeletion />);

    expect(screen.getByText(/delete the account within one month/i)).toBeInTheDocument();
    expect(screen.queryByText(/30 days/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/provisional/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/legal counsel/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/official sla/i)).not.toBeInTheDocument();
  });

  // MUT: reverted "and you appear as \"A former player\"" back to the
  // earlier draft's "Deleted Player" wording -> RED, restored -> GREEN.
  it('promises anonymised retention ("A former player") for FINISHED competitions, not removal', () => {
    render(<AccountDeletion />);

    expect(screen.getByText(/appear as "A former player"/i)).toBeInTheDocument();
    expect(screen.queryByText(/deleted player/i)).not.toBeInTheDocument();
  });

  // MUT: deleted the welcome-bonus retention bullet entirely -> RED,
  // restored -> GREEN.
  it("discloses the welcome-bonus retention record by name", () => {
    render(<AccountDeletion />);

    expect(screen.getByText(/can't claim the welcome coins twice/i)).toBeInTheDocument();
  });

  // MUT: deleted "Competitions you organised carry on for the players in
  // them." -> RED, restored -> GREEN.
  it("says a deleted organiser's competitions carry on for their players", () => {
    render(<AccountDeletion />);

    expect(document.body).toHaveTextContent(/competitions you organised.*carry on for the players in them/i);
  });

  // MUT: deleted "Never kept: your step counts..." -> RED, restored -> GREEN.
  it("states step counts are never kept", () => {
    render(<AccountDeletion />);

    expect(screen.getByText(/never kept: your step counts/i)).toBeInTheDocument();
  });

  // MUT: restored "display name, avatar, profile photo, city" (dropping
  // "town or city" and the Oxford "and") -> RED, restored -> GREEN.
  it("names the profile photo and town-or-city explicitly among what gets deleted", () => {
    render(<AccountDeletion />);

    expect(screen.getByText(/display name, avatar, profile photo, and town or city/i)).toBeInTheDocument();
  });

  // Carried over from the earlier audit: still no date of birth, gender or
  // country anywhere (product rule confirmed neither field is collected).
  it("does not mention date of birth, gender or country anywhere on the page", () => {
    render(<AccountDeletion />);

    expect(screen.queryByText(/date of birth/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/gender/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/country/i)).not.toBeInTheDocument();
    expect(screen.getByText(/your first name and surname/i)).toBeInTheDocument();
  });

  // No more Stripe/payments/invoices anywhere on this page (ileadit takes no
  // payments via this account-deletion flow and the approved copy removes
  // every mention).
  it("never mentions Stripe, payments or invoices", () => {
    render(<AccountDeletion />);

    expect(screen.queryByText(/stripe/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/invoice/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/payment/i)).not.toBeInTheDocument();
  });

  // The old "If you created a competition... We'll email you first" section
  // is gone — organiser handling is now covered only by the one-line "carry
  // on for the players in them" bullet above.
  it("does not have the old 'we'll email you first' organiser section", () => {
    render(<AccountDeletion />);

    expect(screen.queryByText(/we'll email you first/i)).not.toBeInTheDocument();
  });

  // The approved copy drops the Microsoft-sign-in hedge entirely — the
  // sign-in bullet is now a flat, unconditional sentence regardless of the
  // isMicrosoftSignInEnabled() flag (which this view no longer reads at
  // all).
  it("names the sign-in bullet as email/password or Google, unconditionally", () => {
    render(<AccountDeletion />);

    expect(screen.getByText(/your ileadit sign-in \(email and password, or google\)/i)).toBeInTheDocument();
  });

  it("has an explicit, standalone \"what can't be undone\" irreversibility statement", () => {
    render(<AccountDeletion />);

    expect(screen.getByRole("heading", { name: /what can't be undone/i })).toBeInTheDocument();
    expect(
      screen.getByText(/your game progress, coins and competition history can't be recovered/i),
    ).toBeInTheDocument();
  });

  it("keeps the mailto request box, defaulting to a fill-in placeholder with no email typed yet", () => {
    render(<AccountDeletion />);

    screen.getByLabelText(/your account email/i);
    const link = screen.getByRole("link", { name: /email us to request deletion/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("mailto:hello@ileadit.co.uk"));
    const href = link.getAttribute("href") ?? "";
    expect(decodeURIComponent(href)).toContain("(please fill in)");
  });

  it("builds the mailto from the typed email once one is entered", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(<AccountDeletion />);

    const emailInput = screen.getByLabelText(/your account email/i);
    fireEvent.change(emailInput, { target: { value: "player@example.com" } });

    const link = screen.getByRole("link", { name: /email us to request deletion/i });
    expect(link).toHaveAttribute("href", expect.stringContaining(encodeURIComponent("player@example.com")));
  });

  it("links to the privacy policy in the footer line", () => {
    render(<AccountDeletion />);

    const link = screen.getByRole("link", { name: /privacy policy/i });
    expect(link).toHaveAttribute("href", "/privacy");
  });

  it("writes Kranthews Ltd's postal address instead of a plain-text email repeat", () => {
    render(<AccountDeletion />);

    expect(
      screen.getByText(/write to us at kranthews ltd, 1 westbrook avenue, hampton, england, tw12 2re/i),
    ).toBeInTheDocument();
  });

  /**
   * W9-A11Y. Tailwind preflight's `list-style: none` strips native list
   * semantics from `<ul>`s in REAL browsers unless `role="list"` is
   * explicitly restored. jsdom does NOT model this CSS-driven demotion, so
   * `getByRole("list")` would pass whether or not the attribute is present;
   * this asserts the attribute directly instead, the only way to actually
   * pin the fix.
   */
  it("MUT-A11Y-BULLET-LIST-ROLE: bullet lists carry an explicit role=\"list\" attribute", () => {
    const { container } = render(<AccountDeletion />);

    const lists = container.querySelectorAll("ul");
    expect(lists.length).toBeGreaterThan(0);
    lists.forEach((list) => {
      expect(list).toHaveAttribute("role", "list");
    });
  });

  it("has no placeholder/legal-review disclaimer language anywhere", () => {
    render(<AccountDeletion />);

    const bodyText = document.body.textContent ?? "";
    expect(bodyText.toLowerCase()).not.toContain("placeholder");
    expect(bodyText.toLowerCase()).not.toContain("not for production");
    expect(bodyText.toLowerCase()).not.toContain("legal counsel");
  });
});
