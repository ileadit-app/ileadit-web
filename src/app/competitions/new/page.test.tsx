import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import NewCompetitionPage from "./page";

/**
 * Pins the thing `/competitions/new`'s own header comment calls load-bearing
 * (ticket W1-TESTS, item 4): `ProtectedRoute` (signed in at all) and
 * `CreateCompetitionGate` (may create) are two INDEPENDENT gates, stacked,
 * not one merged check. `ProtectedRoute.test.tsx` and
 * `CreateCompetitionGate.test.tsx` already pin each gate's own three states
 * in isolation — this file pins the SEPARATION itself, at the point they're
 * actually composed.
 *
 * The key assertion a merge would break: while signed out, the capability
 * hook (`useCanCreateCompetitions`) is never even called, because
 * `CreateCompetitionGate` never mounts — `ProtectedRoute` returns before
 * reaching its children. A merged implementation that decided "signed in"
 * from the capability claim instead of (or in addition to) `useUser()`
 * would call that hook while signed out, and/or show the capability
 * refusal copy instead of the sign-in redirect state. Both are checked
 * below.
 */

const useUserMock = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useUser: () => useUserMock(),
}));

const useCanCreateCompetitionsMock = vi.fn();
vi.mock("@/lib/useCanCreateCompetitions", () => ({
  useCanCreateCompetitions: () => useCanCreateCompetitionsMock(),
}));

vi.mock("@/components/competitions/CreateCompetitionForm", () => ({
  CreateCompetitionForm: () => <div data-testid="create-competition-form-stub" />,
}));

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/competitions/new",
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
  useCanCreateCompetitionsMock.mockReset();
  replaceMock.mockReset();
});

describe("/competitions/new — the two gates stay separate", () => {
  it("signed out: shows ProtectedRoute's own refusal state, never mounts the capability gate at all", () => {
    useUserMock.mockReturnValue({ status: "signed-out" });
    // Real useCanCreateCompetitions would also resolve "denied" while
    // signed out (see its own header comment) — configured identically
    // here so a false pass can't be blamed on this mock disagreeing with
    // reality; the point is it must never even be CALLED.
    useCanCreateCompetitionsMock.mockReturnValue("denied");

    render(<NewCompetitionPage />);

    expect(replaceMock).toHaveBeenCalledWith("/login?redirect=%2Fcompetitions%2Fnew");
    expect(useCanCreateCompetitionsMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/you don't have permission to create competitions/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("create-competition-form-stub")).not.toBeInTheDocument();
  });

  it("signed in, capability denied: shows the capability refusal, not the sign-in redirect state", () => {
    useUserMock.mockReturnValue({ status: "signed-in" });
    useCanCreateCompetitionsMock.mockReturnValue("denied");

    render(<NewCompetitionPage />);

    expect(
      screen.getByRole("heading", { name: /you don't have permission to create competitions/i }),
    ).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("create-competition-form-stub")).not.toBeInTheDocument();
  });

  it("signed in, capability allowed: mounts the create-competition form", () => {
    useUserMock.mockReturnValue({ status: "signed-in" });
    useCanCreateCompetitionsMock.mockReturnValue("allowed");

    render(<NewCompetitionPage />);

    expect(screen.getByTestId("create-competition-form-stub")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
