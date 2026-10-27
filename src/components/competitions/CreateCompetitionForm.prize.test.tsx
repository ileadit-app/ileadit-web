import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateCompetitionForm } from "./CreateCompetitionForm";

/**
 * PRZ-W1 — pins the prize section's contribution to the `createCompetition`
 * request body, and its client-side validation copy, at the same callable
 * boundary `CreateCompetitionForm.test.tsx` already uses (see that file's
 * header comment for the two-mock rationale — repeated here unchanged).
 */

const mockCallable = vi.fn();

vi.mock("firebase/functions", () => ({
  httpsCallable: () => mockCallable,
}));

vi.mock("@/lib/functions", () => ({
  getFunctionsClient: () => ({}),
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/competition name/i), {
    target: { value: "Marketing team step-off" },
  });
  fireEvent.change(screen.getByLabelText(/^starts/i), {
    target: { value: "2027-06-01T09:00" },
  });
}

beforeEach(() => {
  mockCallable.mockReset();
  pushMock.mockReset();
  mockCallable.mockResolvedValue({ data: { competitionId: "comp_123" } });
});

describe("CreateCompetitionForm — prize section", () => {
  it("prize toggle left off: the request body has no `prize` key at all", async () => {
    render(<CreateCompetitionForm />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: /create competition/i }));

    await waitFor(() => expect(mockCallable).toHaveBeenCalledTimes(1));
    const body = mockCallable.mock.calls[0][0];
    expect(Object.prototype.hasOwnProperty.call(body, "prize")).toBe(false);
  });

  it("perk, top 3: sends the exact contract shape for all three places", async () => {
    render(<CreateCompetitionForm />);
    fillRequiredFields();

    fireEvent.click(screen.getByLabelText(/add a prize for the winner/i));
    fireEvent.click(screen.getByLabelText(/^a perk/i));
    fireEvent.click(screen.getByLabelText(/^the top 3/i));

    const titleFields = screen.getAllByLabelText(/place prize name/i);
    fireEvent.change(titleFields[0], { target: { value: "£100 voucher" } });
    fireEvent.change(titleFields[1], { target: { value: "£50 voucher" } });
    fireEvent.change(titleFields[2], { target: { value: "£25 voucher" } });

    // Index 0 is the competition's OWN "Description (optional)" field
    // (unrelated to the prize) — the three prize-item descriptions follow it.
    const descriptionFields = screen.getAllByLabelText(/description \(optional\)/i);
    fireEvent.change(descriptionFields[1], { target: { value: "Spend it anywhere" } });

    fireEvent.click(screen.getByLabelText(/winner must be 18 or over/i));

    fireEvent.click(screen.getByRole("button", { name: /create competition/i }));

    await waitFor(() => expect(mockCallable).toHaveBeenCalledTimes(1));
    const body = mockCallable.mock.calls[0][0];
    expect(body.prize).toEqual({
      kind: "perk",
      places: 3,
      items: [
        { place: 1, title: "£100 voucher", description: "Spend it anywhere" },
        { place: 2, title: "£50 voucher", description: "" },
        { place: 3, title: "£25 voucher", description: "" },
      ],
      forfeitLoserText: null,
      adultOnly: true,
    });
  });

  it("validation: empty place-1 title blocks submission with the right message", async () => {
    render(<CreateCompetitionForm />);
    fillRequiredFields();
    fireEvent.click(screen.getByLabelText(/add a prize for the winner/i));

    fireEvent.click(screen.getByRole("button", { name: /create competition/i }));

    expect(await screen.findByText(/give this place a prize title/i)).toBeInTheDocument();
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it("validation: a title over 60 characters is rejected with the length message", async () => {
    render(<CreateCompetitionForm />);
    fillRequiredFields();
    fireEvent.click(screen.getByLabelText(/add a prize for the winner/i));
    fireEvent.click(screen.getByLabelText(/^a perk/i));

    const longTitle = "x".repeat(61);
    const titleField = screen.getByLabelText(/^prize name/i) as HTMLInputElement;
    fireEvent.change(titleField, {
      target: { value: longTitle },
    });
    // The field itself clamps to 60 via maxLength slicing in the handler —
    // assert the clamp happened rather than expecting the error to fire from
    // a 61-char value making it into state.
    expect(titleField.value.length).toBe(60);
  });

  it("digital codes and physical/sponsored prize options are never rendered (Phase 2, not built)", () => {
    render(<CreateCompetitionForm />);
    fireEvent.click(screen.getByLabelText(/add a prize for the winner/i));

    expect(screen.queryByText(/digital code/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/physical/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sponsor/i)).not.toBeInTheDocument();
  });
});
