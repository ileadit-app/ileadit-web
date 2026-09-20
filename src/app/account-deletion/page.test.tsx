import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AccountDeletion from "./page";

/**
 * Pins the W3-DELETION-AUDIT fixes to `/account-deletion`, against
 * `automation-hub/docs/ileadit-account-deletion-spec-20260920.md`. Each test
 * below corresponds to one row of the audit's fix list — see the ticket
 * report for the full spec-requirement -> page-behaviour mapping. MUT-*
 * ids are referenced in the findings report as the mutation each test was
 * proven against (mutate source, RED, revert, GREEN).
 *
 * `next/link` is stubbed to a plain anchor — routing context isn't under
 * test here. `@/context/AuthContext`'s `useUser` and `@/lib/auth`'s
 * `isMicrosoftSignInEnabled` are the two things this page actually reads
 * that need controlling per-test.
 */

const useUserMock = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useUser: () => useUserMock(),
}));

const isMicrosoftSignInEnabledMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  isMicrosoftSignInEnabled: () => isMicrosoftSignInEnabledMock(),
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
  isMicrosoftSignInEnabledMock.mockReset();
  isMicrosoftSignInEnabledMock.mockReturnValue(false);
});

describe("/account-deletion — W3-DELETION-AUDIT fixes", () => {
  // MUT-D1: reverted the "finished competition" bullet's anonymisation
  // clause back to a bare "Payment and invoice records..." bullet (i.e.
  // deleted the added list item) -> RED, restored -> GREEN.
  it("promises anonymised retention (\"Deleted Player\") for FINISHED competitions, not removal", () => {
    render(<AccountDeletion />);

    expect(screen.getByText(/shown to other players as "Deleted Player"/i)).toBeInTheDocument();
  });

  // MUT-D2: changed "any competition that hasn't finished yet" back to the
  // old unqualified "any competitions you're currently playing... removed
  // from every leaderboard" wording -> RED (the un-scoped claim reappears
  // alongside the scoped one, so the two get inconsistent), restored -> GREEN.
  it("scopes full row removal to competitions that HAVEN'T finished yet, not every leaderboard", () => {
    render(<AccountDeletion />);

    expect(
      screen.getByText(/your place in any competition that hasn't finished yet/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/removed from every leaderboard/i)).not.toBeInTheDocument();
  });

  // MUT-D3: deleted the welcome-grant retention bullet entirely -> RED,
  // restored -> GREEN.
  it("discloses the welcome-grant retention record by name, not just a generic fraud-record bullet", () => {
    render(<AccountDeletion />);

    expect(
      screen.getByText(/stops the same email from claiming a second welcome bonus/i),
    ).toBeInTheDocument();
  });

  // MUT-D4: removed "profile photo" from the "what gets deleted" bullet ->
  // RED, restored -> GREEN.
  it("names the profile photo explicitly among what gets deleted, not just \"avatar\"", () => {
    render(<AccountDeletion />);

    expect(screen.getByText(/display name, avatar, profile photo, city/i)).toBeInTheDocument();
  });

  // MUT-D5: deleted the entire "What can't be undone" <Section> -> RED,
  // restored -> GREEN.
  it('has an explicit, standalone "what can\'t be undone" irreversibility statement', () => {
    render(<AccountDeletion />);

    expect(
      screen.getByRole("heading", { name: /what can't be undone/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/game progress, coins, and competition\s+history can.t be recovered/i),
    ).toBeInTheDocument();
  });

  // MUT-D6: hard-coded signInDeletionBullet() to always return the
  // Microsoft-inclusive string (ignoring isMicrosoftSignInEnabled()) -> RED
  // (this test's "false" case then sees "Microsoft" and fails), restored ->
  // GREEN.
  it("does not claim Microsoft sign-in is deleted when Microsoft sign-in isn't switched on", () => {
    isMicrosoftSignInEnabledMock.mockReturnValue(false);
    render(<AccountDeletion />);

    expect(screen.getByText(/email\/password, plus Google if you've linked it/i)).toBeInTheDocument();
    expect(screen.queryByText(/across email, Google and Microsoft/i)).not.toBeInTheDocument();
  });

  it("names Microsoft once Microsoft sign-in IS switched on", () => {
    isMicrosoftSignInEnabledMock.mockReturnValue(true);
    render(<AccountDeletion />);

    expect(screen.getByText(/across email, Google and Microsoft/i)).toBeInTheDocument();
  });
});
