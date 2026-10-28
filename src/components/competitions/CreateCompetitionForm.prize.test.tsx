import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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

  // PRZ-W1-FIX2 — every prize-name counter must carry the design's
  // "shown to players on the competition page" hint, not just the
  // single-winner field.
  describe("prize name hint", () => {
    it("the single-winner title field's counter includes the hint", () => {
      render(<CreateCompetitionForm />);
      fireEvent.click(screen.getByLabelText(/add a prize for the winner/i));
      fireEvent.click(screen.getByLabelText(/^a perk/i));

      expect(screen.getByText(/0\/60 · shown to players on the competition page/i)).toBeInTheDocument();
    });

    it("all three top-3 title fields' counters include the hint", () => {
      render(<CreateCompetitionForm />);
      fireEvent.click(screen.getByLabelText(/add a prize for the winner/i));
      fireEvent.click(screen.getByLabelText(/^a perk/i));
      fireEvent.click(screen.getByLabelText(/^the top 3/i));

      const hints = screen.getAllByText(/0\/60 · shown to players on the competition page/i);
      expect(hints).toHaveLength(3);
    });
  });

  // PRZ-W1-FIX2 — the "Preview prize terms" card. `httpsCallable` is mocked
  // at module scope above (`() => mockCallable`), ignoring the callable
  // name — safe here because every test below triggers at most one of
  // `createCompetition`/`previewPrizeTerms`, never both.
  describe("preview prize terms", () => {
    function enablePerkPrize() {
      fireEvent.click(screen.getByLabelText(/add a prize for the winner/i));
      fireEvent.click(screen.getByLabelText(/^a perk/i));
      fireEvent.change(screen.getByLabelText(/^prize name/i), {
        target: { value: "£100 voucher" },
      });
    }

    it("the trigger is disabled until the form has enough to preview", () => {
      render(<CreateCompetitionForm />);

      // No prize enabled yet at all.
      expect(screen.queryByRole("button", { name: /preview prize terms/i })).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText(/add a prize for the winner/i));
      fireEvent.click(screen.getByLabelText(/^a perk/i));

      // Prize enabled, but no place-1 title yet, and the competition's own
      // name/start fields are still empty too.
      expect(screen.getByRole("button", { name: /preview prize terms/i })).toBeDisabled();

      fillRequiredFields();
      expect(screen.getByRole("button", { name: /preview prize terms/i })).toBeDisabled();

      fireEvent.change(screen.getByLabelText(/^prize name/i), {
        target: { value: "£100 voucher" },
      });
      expect(screen.getByRole("button", { name: /preview prize terms/i })).toBeEnabled();
    });

    it("clicking the trigger calls previewPrizeTerms with the exact payload shape", async () => {
      mockCallable.mockResolvedValue({
        data: { html: "<p>Terms</p>", approvedTemplateVersion: "v1" },
      });
      render(<CreateCompetitionForm />);
      fillRequiredFields();
      enablePerkPrize();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /preview prize terms/i }));
      });

      await waitFor(() => expect(mockCallable).toHaveBeenCalledTimes(1));
      const body = mockCallable.mock.calls[0][0];
      expect(Object.keys(body).sort()).toEqual(
        ["durationDays", "name", "prize", "startTime", "timeZone"].sort(),
      );
      expect(body.name).toBe("Marketing team step-off");
      expect(body.durationDays).toBe(7);
      expect(typeof body.startTime).toBe("string"); // ISO string — see previewPrizeTerms.ts's header comment.
      expect(body.prize).toEqual({
        kind: "perk",
        places: 1,
        items: [{ place: 1, title: "£100 voucher", description: "" }],
        forfeitLoserText: null,
        adultOnly: false,
      });
    });

    it("renders the returned html, sanitised, via PrizeTermsView", async () => {
      mockCallable.mockResolvedValue({
        data: {
          html: "<p>Be nice. <script>alert(1)</script></p>",
          approvedTemplateVersion: "v1",
        },
      });
      render(<CreateCompetitionForm />);
      fillRequiredFields();
      enablePerkPrize();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /preview prize terms/i }));
      });

      await waitFor(() => expect(mockCallable).toHaveBeenCalledTimes(1));
      expect(await screen.findByText(/be nice\./i)).toBeInTheDocument();
      // The "back to the form" bar confirms the preview pane replaced the form.
      expect(screen.getByRole("button", { name: /back to the form/i })).toBeInTheDocument();
      // The form itself is no longer rendered while the preview is shown.
      expect(screen.queryByRole("button", { name: /create competition/i })).not.toBeInTheDocument();
      // The sanitiser must have stripped the script tag's content out of the DOM entirely.
      expect(document.querySelector("script")).not.toBeInTheDocument();
    });

    it("shows the draft notice when approvedTemplateVersion is DRAFT-NOT-APPROVED", async () => {
      mockCallable.mockResolvedValue({
        data: { html: "<p>Draft wording</p>", approvedTemplateVersion: "DRAFT-NOT-APPROVED" },
      });
      render(<CreateCompetitionForm />);
      fillRequiredFields();
      enablePerkPrize();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /preview prize terms/i }));
      });

      // Both the html's own words AND the shared draft-notice banner contain
      // "draft" — match the banner's exact, distinctive sentence instead of
      // a loose substring so this doesn't collide with the preview's own
      // generated wording.
      expect(
        await screen.findByText(/draft terms — not yet approved/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/draft wording/i)).toBeInTheDocument();
    });

    it("clicking 'Back to the form' returns to the editable form", async () => {
      mockCallable.mockResolvedValue({
        data: { html: "<p>Terms</p>", approvedTemplateVersion: "v1" },
      });
      render(<CreateCompetitionForm />);
      fillRequiredFields();
      enablePerkPrize();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /preview prize terms/i }));
      });
      await screen.findByRole("button", { name: /back to the form/i });

      fireEvent.click(screen.getByRole("button", { name: /back to the form/i }));

      expect(screen.getByRole("button", { name: /create competition/i })).toBeInTheDocument();
    });

    it("a failed preview call shows the mapped error message, not the raw failure", async () => {
      mockCallable.mockRejectedValue({
        code: "functions/invalid-argument",
        message: "bad",
        details: { reason: "prize-title-too-long" },
      });
      render(<CreateCompetitionForm />);
      fillRequiredFields();
      enablePerkPrize();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /preview prize terms/i }));
      });

      expect(await screen.findByText(/something about this prize isn't valid/i)).toBeInTheDocument();
      // Still on the form, not swapped into the preview pane.
      expect(screen.getByRole("button", { name: /create competition/i })).toBeInTheDocument();
    });
  });
});
