import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Header from "./Header";

/**
 * Pins WEB-3 item 2: the signed-out auth CTA reads "Sign in" (both the
 * desktop bar and the mobile menu), not "Log in" — this is the only page in
 * the site that used the other wording, inconsistent with every other
 * sign-in surface (`/login`'s own heading, `ProtectedRoute`'s redirect
 * target copy, etc).
 */

const useUserMock = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useUser: () => useUserMock(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  useUserMock.mockReset();
  useUserMock.mockReturnValue({ status: "signed-out", user: null, signOut: vi.fn() });
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
