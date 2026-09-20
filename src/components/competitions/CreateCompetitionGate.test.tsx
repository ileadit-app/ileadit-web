import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreateCompetitionGate } from "./CreateCompetitionGate";

/**
 * Pins `CreateCompetitionGate`'s three capability states in isolation
 * (ticket W1-TESTS). `CreateCompetitionForm` is stubbed out — it has its
 * own dedicated test file for the createCompetition-wrapper outcomes — so a
 * failure here can only mean the CAPABILITY gate's own three-state render
 * broke, never something inside the form.
 *
 * `next/link`'s app-router `<Link>` needs routing context this test never
 * sets up; it isn't the thing under test here (the "Back to dashboard"
 * link's destination is not part of the capability-gate contract this
 * ticket pins), so it's stubbed to a plain anchor.
 */

const useCanCreateCompetitionsMock = vi.fn();
vi.mock("@/lib/useCanCreateCompetitions", () => ({
  useCanCreateCompetitions: () => useCanCreateCompetitionsMock(),
}));

vi.mock("./CreateCompetitionForm", () => ({
  CreateCompetitionForm: () => <div data-testid="create-competition-form-stub" />,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  useCanCreateCompetitionsMock.mockReset();
});

describe("CreateCompetitionGate", () => {
  it('"checking": shows a loading/status placeholder, never the form and never the refusal copy', () => {
    useCanCreateCompetitionsMock.mockReturnValue("checking");
    render(<CreateCompetitionGate />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByTestId("create-competition-form-stub")).not.toBeInTheDocument();
    expect(screen.queryByText(/you don't have permission/i)).not.toBeInTheDocument();
  });

  it('"denied": shows the permission-refusal screen, never the form', () => {
    useCanCreateCompetitionsMock.mockReturnValue("denied");
    render(<CreateCompetitionGate />);

    expect(
      screen.getByRole("heading", { name: /you don't have permission to create competitions/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("create-competition-form-stub")).not.toBeInTheDocument();
  });

  it('"allowed": mounts the create-competition form, never the refusal screen', () => {
    useCanCreateCompetitionsMock.mockReturnValue("allowed");
    render(<CreateCompetitionGate />);

    expect(screen.getByTestId("create-competition-form-stub")).toBeInTheDocument();
    expect(screen.queryByText(/you don't have permission/i)).not.toBeInTheDocument();
  });
});
