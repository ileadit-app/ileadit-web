import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProtectedRoute } from "./ProtectedRoute";

/**
 * Pins `ProtectedRoute`'s sign-in gate in isolation (ticket W1-TESTS). Mocks
 * only `@/context/AuthContext`'s `useUser` and `next/navigation` — the two
 * things this component actually reads — so the "loading" vs "signed-out"
 * distinction the component's header comment calls load-bearing (gate on
 * `status`, never on `user`) is exercised directly, not inferred.
 */

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/competitions/new",
}));

const useUserMock = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useUser: () => useUserMock(),
}));

beforeEach(() => {
  replaceMock.mockReset();
  useUserMock.mockReset();
});

describe("ProtectedRoute", () => {
  it('status "loading": renders the checking-session placeholder, does not redirect, does not render children', () => {
    useUserMock.mockReturnValue({ status: "loading" });
    render(
      <ProtectedRoute>
        <div data-testid="protected-content">secret</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText(/checking your session/i)).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('status "signed-out": redirects to /login with the current path, and never renders children', () => {
    useUserMock.mockReturnValue({ status: "signed-out" });
    render(
      <ProtectedRoute>
        <div data-testid="protected-content">secret</div>
      </ProtectedRoute>,
    );

    expect(replaceMock).toHaveBeenCalledWith("/login?redirect=%2Fcompetitions%2Fnew");
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it('status "signed-in": renders children and never redirects', () => {
    useUserMock.mockReturnValue({ status: "signed-in" });
    render(
      <ProtectedRoute>
        <div data-testid="protected-content">secret</div>
      </ProtectedRoute>,
    );

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
