import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateCompetitionForm } from "./CreateCompetitionForm";

/**
 * INVITE-2: the "Invite only" tick box on the create form, and its mutual
 * exclusion with "Local to". Same boundary as
 * `CreateCompetitionForm.localTo.test.tsx`: only `firebase/functions`'s
 * `httpsCallable` is mocked (routed by callable name); the wrappers,
 * `CityPicker` and the form run for real, and assertions are on the payload
 * that actually reaches the `createCompetition` callable.
 */

const searchCallable = vi.fn();
const createCallable = vi.fn();

vi.mock("firebase/functions", () => ({
  httpsCallable: (_client: unknown, name: string) =>
    name === "searchCities" ? searchCallable : createCallable,
}));
vi.mock("@/lib/functions", () => ({ getFunctionsClient: () => ({}) }));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

const LEEDS = {
  cityId: 2644688,
  name: "Leeds",
  regionName: "England",
  countryIso2: "GB",
  countryName: "United Kingdom",
  label: "Leeds, England, United Kingdom",
};

beforeEach(() => {
  searchCallable.mockReset();
  createCallable.mockReset();
  pushMock.mockReset();
  createCallable.mockResolvedValue({ data: { competitionId: "comp_1" } });
  searchCallable.mockResolvedValue({ data: { results: [LEEDS] } });
});

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/competition name/i), { target: { value: "Acme step-off" } });
  fireEvent.change(screen.getByLabelText(/^starts/i), { target: { value: "2027-06-01T09:00" } });
}

function tickBox() {
  return screen.getByRole("checkbox", { name: /invite only/i }) as HTMLInputElement;
}

async function pickLeeds() {
  fireEvent.change(screen.getByLabelText("Town"), { target: { value: "lee" } });
  const option = await screen.findByText(LEEDS.label, undefined, { timeout: 4000 });
  fireEvent.mouseDown(option);
  await screen.findByTestId("city-picker-selected");
}

async function submitAndGetPayload() {
  fireEvent.click(screen.getByRole("button", { name: /create competition/i }));
  await waitFor(() => expect(createCallable).toHaveBeenCalledTimes(1));
  return createCallable.mock.calls[0][0] as Record<string, unknown>;
}

describe("CreateCompetitionForm — Invite only (INVITE-2)", () => {
  it("shows the tick box unticked, with the exact helper text", () => {
    render(<CreateCompetitionForm />);
    expect(tickBox().checked).toBe(false);
    expect(
      screen.getByText(
        "Only people you send an invite link to can join. It won't appear in the app's list of competitions.",
      ),
    ).toBeInTheDocument();
  });

  it("unticked: the payload has no inviteOnly key at all", async () => {
    render(<CreateCompetitionForm />);
    fillRequiredFields();
    const payload = await submitAndGetPayload();
    expect(payload).not.toHaveProperty("inviteOnly");
  });

  it("ticked then unticked: still no inviteOnly key (never sends false)", async () => {
    render(<CreateCompetitionForm />);
    fillRequiredFields();
    fireEvent.click(tickBox());
    fireEvent.click(tickBox());
    const payload = await submitAndGetPayload();
    expect(payload).not.toHaveProperty("inviteOnly");
  });

  it("ticked: the payload has inviteOnly: true and no Local to keys", async () => {
    render(<CreateCompetitionForm />);
    fillRequiredFields();
    fireEvent.click(tickBox());
    const payload = await submitAndGetPayload();
    expect(payload.inviteOnly).toBe(true);
    expect(payload).not.toHaveProperty("localToCityId");
    expect(payload).not.toHaveProperty("localRadiusKm");
  });

  it("ticking disables the Local to fields and says why; unticking re-enables them", () => {
    render(<CreateCompetitionForm />);
    expect(screen.getByLabelText("Town")).toBeEnabled();
    expect(screen.getByLabelText("Distance")).toBeEnabled();

    fireEvent.click(tickBox());

    expect(screen.getByLabelText("Town")).toBeDisabled();
    expect(screen.getByLabelText("Distance")).toBeDisabled();
    expect(screen.getByText("Invite-only competitions aren't shown to local players.")).toBeInTheDocument();

    fireEvent.click(tickBox());
    expect(screen.getByLabelText("Town")).toBeEnabled();
    expect(screen.getByLabelText("Distance")).toBeEnabled();
  });

  it("ticking resets a changed distance to 25 km and clears half-typed town search text", () => {
    render(<CreateCompetitionForm />);
    fireEvent.change(screen.getByLabelText("Distance"), { target: { value: "40 km" } });
    fireEvent.change(screen.getByLabelText("Town"), { target: { value: "lee" } });

    fireEvent.click(tickBox());
    fireEvent.click(tickBox());

    expect((screen.getByLabelText("Distance") as HTMLSelectElement).value).toBe("25 km");
    expect((screen.getByLabelText("Town") as HTMLInputElement).value).toBe("");
  });

  it("picking a town disables the tick box and says why; clearing it re-enables", async () => {
    render(<CreateCompetitionForm />);
    await pickLeeds();

    expect(tickBox()).toBeDisabled();
    expect(screen.getByText(/local competitions can't be invite only/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /clear town/i }));
    expect(tickBox()).toBeEnabled();
    expect(screen.queryByText(/local competitions can't be invite only/i)).not.toBeInTheDocument();
  });

  it("with a town picked the payload carries the town and no inviteOnly", async () => {
    render(<CreateCompetitionForm />);
    fillRequiredFields();
    await pickLeeds();
    const payload = await submitAndGetPayload();
    expect(payload.localToCityId).toBe(2644688);
    expect(payload).not.toHaveProperty("inviteOnly");
  });

  it("goes to the new competition's page when invite-only, so the invite link is next", async () => {
    render(<CreateCompetitionForm />);
    fillRequiredFields();
    fireEvent.click(tickBox());
    await submitAndGetPayload();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/competitions/comp_1"));
  });

  it("still goes to the dashboard for an ordinary competition", async () => {
    render(<CreateCompetitionForm />);
    fillRequiredFields();
    await submitAndGetPayload();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("falls back to the dashboard if the callable returns no id", async () => {
    createCallable.mockResolvedValue({ data: {} });
    render(<CreateCompetitionForm />);
    fillRequiredFields();
    fireEvent.click(tickBox());
    await submitAndGetPayload();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });
});
