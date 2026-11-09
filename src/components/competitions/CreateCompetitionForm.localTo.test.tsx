import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateCompetitionForm } from "./CreateCompetitionForm";
import { LOCAL_TO_HELP_TEXT } from "@/lib/localTo";

/**
 * LOCAL-2: the optional "Local to" section of the create form.
 *
 * Mocked at the callable boundary only (`firebase/functions`'s
 * `httpsCallable`, routed by callable NAME so `searchCities` and
 * `createCompetition` can answer differently), same boundary as
 * `CreateCompetitionForm.test.tsx`. The `searchCities` and `createCompetition`
 * wrappers, `CityPicker` and the form all run for real, and assertions are on
 * the payload that actually reaches the `createCompetition` callable.
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
  fireEvent.change(screen.getByLabelText(/competition name/i), { target: { value: "Leeds step-off" } });
  fireEvent.change(screen.getByLabelText(/^starts/i), { target: { value: "2027-06-01T09:00" } });
}

async function pickLeeds() {
  fireEvent.change(screen.getByLabelText("Town"), { target: { value: "lee" } });
  // findByText, not findByRole("option"): the time zone <select> contributes
  // hundreds of role=option nodes and a role query over them is slow under load.
  const option = await screen.findByText(LEEDS.label, undefined, { timeout: 4000 });
  fireEvent.mouseDown(option);
  await screen.findByTestId("city-picker-selected");
}

async function submitAndGetPayload() {
  fireEvent.click(screen.getByRole("button", { name: /create competition/i }));
  await waitFor(() => expect(createCallable).toHaveBeenCalledTimes(1));
  return createCallable.mock.calls[0][0] as Record<string, unknown>;
}

describe("CreateCompetitionForm — Local to (LOCAL-2)", () => {
  it("renders the section with the exact help text", () => {
    render(<CreateCompetitionForm />);
    expect(screen.getByText("Local to (optional)")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Only players whose home town is within this distance will see the competition in the app. Anyone with the invite link can still join. Leave blank to show it to everyone.",
      ),
    ).toBeInTheDocument();
    expect(LOCAL_TO_HELP_TEXT).toContain("Leave blank to show it to everyone.");
  });

  it("offers 10 / 15 / 25 / 40 km and defaults to 25", () => {
    render(<CreateCompetitionForm />);
    const select = screen.getByLabelText("Distance") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["10 km", "15 km", "25 km", "40 km"]);
    expect(select.value).toBe("25 km");
  });

  it("sends neither input when no town is picked, even if the distance was changed", async () => {
    render(<CreateCompetitionForm />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("Distance"), { target: { value: "40 km" } });

    const payload = await submitAndGetPayload();
    expect(payload).not.toHaveProperty("localToCityId");
    expect(payload).not.toHaveProperty("localRadiusKm");
    expect(searchCallable).not.toHaveBeenCalled();
  });

  it("sends both inputs when a town is picked, with the default radius of 25", async () => {
    render(<CreateCompetitionForm />);
    fillRequiredFields();
    await pickLeeds();

    const payload = await submitAndGetPayload();
    expect(payload.localToCityId).toBe(2644688);
    expect(payload.localRadiusKm).toBe(25);
    expect(searchCallable).toHaveBeenCalledWith({ query: "lee" });
  });

  it("sends the chosen distance as an integer", async () => {
    render(<CreateCompetitionForm />);
    fillRequiredFields();
    await pickLeeds();
    fireEvent.change(screen.getByLabelText("Distance"), { target: { value: "10 km" } });

    const payload = await submitAndGetPayload();
    expect(payload.localToCityId).toBe(2644688);
    expect(payload.localRadiusKm).toBe(10);
  });

  it("clearing the town clears both: neither is sent and the distance is back to 25", async () => {
    render(<CreateCompetitionForm />);
    fillRequiredFields();
    await pickLeeds();
    fireEvent.change(screen.getByLabelText("Distance"), { target: { value: "40 km" } });

    fireEvent.click(screen.getByRole("button", { name: /clear town/i }));
    expect(screen.queryByTestId("city-picker-selected")).not.toBeInTheDocument();
    expect((screen.getByLabelText("Distance") as HTMLSelectElement).value).toBe("25 km");

    const payload = await submitAndGetPayload();
    expect(payload).not.toHaveProperty("localToCityId");
    expect(payload).not.toHaveProperty("localRadiusKm");
  });

  it("does not search for a single character, and shows a message when the search fails", async () => {
    searchCallable.mockRejectedValue(new Error("offline"));
    render(<CreateCompetitionForm />);

    fireEvent.change(screen.getByLabelText("Town"), { target: { value: "l" } });
    await new Promise((r) => setTimeout(r, 350));
    expect(searchCallable).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Town"), { target: { value: "le" } });
    expect(await screen.findByText(/couldn.t search towns/i)).toBeInTheDocument();
  });
});
