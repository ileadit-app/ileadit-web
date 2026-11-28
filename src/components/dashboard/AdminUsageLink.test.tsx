import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AdminUsageLink } from "./AdminUsageLink";

/**
 * The dashboard link to /admin/usage is a convenience, shown to the STRICT
 * admin only. The creator capability claim does not count.
 */

const useUserMock = vi.fn();
vi.mock("@/context/AuthContext", () => ({ useUser: () => useUserMock() }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function withClaims(claims: Record<string, unknown>) {
  const getIdTokenResult = vi.fn(async () => ({ claims }));
  useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1", getIdTokenResult } });
  return getIdTokenResult;
}

beforeEach(() => useUserMock.mockReset());

describe("AdminUsageLink", () => {
  it("shows for claims.admin === true, pointing at /admin/usage, using the cached token", async () => {
    const getIdTokenResult = withClaims({ admin: true });
    render(<AdminUsageLink />);
    const link = await screen.findByRole("link", { name: /usage numbers/i });
    expect(link).toHaveAttribute("href", "/admin/usage");
    expect(getIdTokenResult).toHaveBeenCalledWith();
  });

  it("is hidden for the creator-capability claim alone", async () => {
    const getIdTokenResult = withClaims({ canCreateCompetitions: true });
    render(<AdminUsageLink />);
    await waitFor(() => expect(getIdTokenResult).toHaveBeenCalled());
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("is hidden for a plain player and for a non-true admin value", async () => {
    for (const claims of [{}, { admin: "true" }, { admin: 1 }]) {
      const getIdTokenResult = withClaims(claims);
      const { unmount } = render(<AdminUsageLink />);
      await waitFor(() => expect(getIdTokenResult).toHaveBeenCalled());
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("renders nothing when signed out or when the token cannot be read", async () => {
    useUserMock.mockReturnValue({ status: "signed-out", user: null });
    const { container, unmount } = render(<AdminUsageLink />);
    expect(container).toBeEmptyDOMElement();
    unmount();

    const failing = vi.fn(async () => {
      throw new Error("offline");
    });
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1", getIdTokenResult: failing } });
    const second = render(<AdminUsageLink />);
    await waitFor(() => expect(failing).toHaveBeenCalled());
    expect(second.container).toBeEmptyDOMElement();
  });

  it("tolerates a user object with no getIdTokenResult", () => {
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
    const { container } = render(<AdminUsageLink />);
    expect(container).toBeEmptyDOMElement();
  });
});
