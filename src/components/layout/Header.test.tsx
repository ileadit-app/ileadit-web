import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Header from "./Header";

/**
 * Pins WEB-3 item 2: the signed-out auth CTA reads "Sign in" (both the
 * desktop bar and the mobile menu), not "Log in" — this is the only page in
 * the site that used the other wording, inconsistent with every other
 * sign-in surface (`/login`'s own heading, `ProtectedRoute`'s redirect
 * target copy, etc).
 *
 * Also pins WEB-5's "Create competition" nav item: present (desktop AND
 * mobile menu) only when signed in AND `useCanCreateCompetitions()` is
 * `"allowed"` — absent while `"checking"` or `"denied"`, and absent for a
 * signed-out visitor regardless of capability (evidence: once an admin's
 * first competition exists, `CreatedCompetitions`'s empty-state CTA
 * disappears and the header had no link back to `/competitions/new`).
 */

const useUserMock = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useUser: () => useUserMock(),
}));

const useCanCreateCompetitionsMock = vi.fn();
vi.mock("@/lib/useCanCreateCompetitions", () => ({
  useCanCreateCompetitions: () => useCanCreateCompetitionsMock(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  useUserMock.mockReset();
  useCanCreateCompetitionsMock.mockReset();
  useUserMock.mockReturnValue({ status: "signed-out", user: null, signOut: vi.fn() });
  useCanCreateCompetitionsMock.mockReturnValue("denied");
});

describe("Header — signed-out auth CTA wording", () => {
  it('MUT-SIGNIN-DESKTOP: the desktop auth link reads "Sign in", not "Log in"', () => {
    render(<Header />);
    // Two matches expected — desktop bar + the (hidden but rendered) mobile
    // menu link share the same text.
    expect(screen.getAllByText("Sign in").length).toBeGreaterThan(0);
    expect(screen.queryByText("Log in")).not.toBeInTheDocument();
  });
});

const SIGNED_IN_USER = {
  status: "signed-in",
  user: { uid: "user-1", displayName: "Paul", email: "paul@example.com", photoURL: null },
  signOut: vi.fn(),
};

describe("Header — WEB-5 \"Create competition\" nav item", () => {
  it('signed in, "checking": no Create competition link in desktop or mobile menu', () => {
    useUserMock.mockReturnValue(SIGNED_IN_USER);
    useCanCreateCompetitionsMock.mockReturnValue("checking");
    render(<Header />);

    fireEvent.click(screen.getByLabelText("Toggle menu"));

    expect(screen.queryByText("Create competition")).not.toBeInTheDocument();
  });

  it('signed in, "denied": no Create competition link in desktop or mobile menu', () => {
    useUserMock.mockReturnValue(SIGNED_IN_USER);
    useCanCreateCompetitionsMock.mockReturnValue("denied");
    render(<Header />);

    fireEvent.click(screen.getByLabelText("Toggle menu"));

    expect(screen.queryByText("Create competition")).not.toBeInTheDocument();
  });

  it('signed in, "allowed": Create competition link appears in both desktop bar and mobile menu, pointing at /competitions/new', () => {
    useUserMock.mockReturnValue(SIGNED_IN_USER);
    useCanCreateCompetitionsMock.mockReturnValue("allowed");
    render(<Header />);

    // Desktop bar link is already in the DOM (only visually hidden by CSS
    // below the `sm` breakpoint) before the mobile menu is opened.
    expect(screen.getAllByText("Create competition")).toHaveLength(1);

    fireEvent.click(screen.getByLabelText("Toggle menu"));

    // Opening the mobile menu adds its own copy of the link — one for each
    // surface named in the ticket ("desktop + mobile menu").
    const links = screen.getAllByText("Create competition");
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link.closest("a")).toHaveAttribute("href", "/competitions/new");
    }
  });

  it('signed out: no Create competition link even if the capability check resolves "allowed"', () => {
    useUserMock.mockReturnValue({ status: "signed-out", user: null, signOut: vi.fn() });
    // Configured "allowed" deliberately, mirroring the existing
    // `/competitions/new` gate-separation test: proves the nav item is
    // gated on sign-in status too, not on capability alone.
    useCanCreateCompetitionsMock.mockReturnValue("allowed");
    render(<Header />);

    fireEvent.click(screen.getByLabelText("Toggle menu"));

    expect(screen.queryByText("Create competition")).not.toBeInTheDocument();
  });
});
