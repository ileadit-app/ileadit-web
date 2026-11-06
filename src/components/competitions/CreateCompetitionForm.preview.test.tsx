import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CreateCompetitionForm } from "./CreateCompetitionForm";

/**
 * COMP-BRAND-1 / WEB-SPONSOR-NAME r4: the live preview must not render an
 * over-long "Sponsored by …" line while the sponsor name is invalid (over
 * 40 characters). It shows the preview as if the name were blank until the
 * value is valid again.
 *
 * `ArtworkUploadField` is stubbed to a button that "uploads" a logo, because
 * the preview only appears once there is artwork and the real field needs
 * the Storage upload path. Everything else — the form, the real
 * `validateSponsorName`, and the real `CompetitionHero` — runs unmocked.
 */

vi.mock("./ArtworkUploadField", () => ({
  ArtworkUploadField: ({
    label,
    onChange,
  }: {
    label: string;
    onChange: (url: string | null) => void;
  }) => (
    <button type="button" onClick={() => onChange(`https://storage.example/${label}.png`)}>
      stub upload {label}
    </button>
  ),
}));

vi.mock("@/lib/functions", () => ({ getFunctionsClient: () => ({}) }));
vi.mock("firebase/functions", () => ({ httpsCallable: () => vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function setSponsor(value: string) {
  fireEvent.change(screen.getByLabelText(/sponsor name/i), { target: { value } });
}

function renderWithLogo() {
  const view = render(<CreateCompetitionForm />);
  fireEvent.click(screen.getAllByRole("button", { name: /stub upload/i })[0]);
  return view;
}

// The previews are aria-hidden, so query the DOM text directly.
function sponsorLines(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("p"))
    .map((p) => p.textContent ?? "")
    .filter((t) => /^Sponsored by /.test(t));
}

describe("CreateCompetitionForm — preview sponsor line", () => {
  it("shows 'Sponsored by …' in both previews while the name is valid", () => {
    const { container } = renderWithLogo();
    setSponsor("Acme Ltd");
    expect(sponsorLines(container)).toEqual(["Sponsored by Acme Ltd", "Sponsored by Acme Ltd"]);
  });

  it("shows exactly 40 characters (boundary is still valid)", () => {
    const { container } = renderWithLogo();
    setSponsor("x".repeat(40));
    expect(sponsorLines(container)).toHaveLength(2);
  });

  it("renders no sponsor line while the name is over 40 characters, and restores it once valid", () => {
    const { container } = renderWithLogo();
    setSponsor("x".repeat(41));
    expect(sponsorLines(container)).toEqual([]);
    expect(container.textContent).not.toContain("x".repeat(41));

    setSponsor("x".repeat(40));
    expect(sponsorLines(container)).toHaveLength(2);
  });

  it("renders no sponsor line for a name with control characters", () => {
    const { container } = renderWithLogo();
    setSponsor("Acme\tLtd");
    expect(sponsorLines(container)).toEqual([]);
  });
});
