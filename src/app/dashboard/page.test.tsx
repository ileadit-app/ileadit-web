import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Dashboard from "./page";

/**
 * Pins WEB-5: the "Create competition" button in the "Created by you"
 * section header is present exactly when `useCanCreateCompetitions()` is
 * `"allowed"` — never while `"checking"`, never while `"denied"`. This is
 * the evidence-driven fix (the ticket's own repro: once an admin has
 * created their first competition, `CreatedCompetitions`'s empty-state CTA
 * disappears and there was no other way back to `/competitions/new`).
 *
 * `PlayingCompetitions` and `CreatedCompetitions` are stubbed — their own
 * data-fetching states are pinned by their own callers/tests elsewhere; a
 * failure here must only mean the section-header button's own gate broke.
 */

const useUserMock = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useUser: () => useUserMock(),
}));

const useCanCreateCompetitionsMock = vi.fn();
vi.mock("@/lib/useCanCreateCompetitions", () => ({
  useCanCreateCompetitions: () => useCanCreateCompetitionsMock(),
}));

vi.mock("@/components/dashboard/CreatedCompetitions", () => ({
  CreatedCompetitions: () => <div data-testid="created-competitions-stub" />,
}));

vi.mock("@/components/dashboard/PlayingCompetitions", () => ({
  PlayingCompetitions: () => <div data-testid="playing-competitions-stub" />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/dashboard",
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
  useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "user-1" } });
});

describe("/dashboard — persistent \"Create competition\" button", () => {
  it('"checking": no "Created by you" section, no Create competition button', () => {
    useCanCreateCompetitionsMock.mockReturnValue("checking");
    render(<Dashboard />);

    expect(screen.queryByRole("link", { name: /create competition/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /created by you/i })).not.toBeInTheDocument();
  });

  it('"denied": no "Created by you" section, no Create competition button', () => {
    useCanCreateCompetitionsMock.mockReturnValue("denied");
    render(<Dashboard />);

    expect(screen.queryByRole("link", { name: /create competition/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /created by you/i })).not.toBeInTheDocument();
  });

  it('"allowed": shows the persistent Create competition button pointing at /competitions/new', () => {
    useCanCreateCompetitionsMock.mockReturnValue("allowed");
    render(<Dashboard />);

    const button = screen.getByRole("link", { name: /create competition/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("href", "/competitions/new");
    expect(screen.getByRole("heading", { name: /created by you/i })).toBeInTheDocument();
    expect(screen.getByTestId("created-competitions-stub")).toBeInTheDocument();
  });
});
