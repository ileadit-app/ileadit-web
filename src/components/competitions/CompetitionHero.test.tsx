import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompetitionHero, type CompetitionHeroCompetition } from "./CompetitionHero";

const base: CompetitionHeroCompetition = {
  name: "Marketing team step-off",
  imageUrl: null,
  backgroundImageUrl: null,
  status: "scheduled",
  startDate: "2027-06-01",
  endDate: "2027-06-07",
  durationDays: 7,
  timeZone: "Europe/London",
};

describe("CompetitionHero — sponsor line (WEB-SPONSOR-NAME)", () => {
  it("shows 'Sponsored by {name}' under the competition name when set", () => {
    render(<CompetitionHero competition={{ ...base, sponsorName: "Acme Ltd" }} />);
    expect(screen.getByText("Sponsored by Acme Ltd")).toBeInTheDocument();
  });

  it("shows nothing when sponsorName is absent, null or blank", () => {
    const { rerender } = render(<CompetitionHero competition={base} />);
    expect(screen.queryByText(/sponsored by/i)).not.toBeInTheDocument();
    rerender(<CompetitionHero competition={{ ...base, sponsorName: null }} />);
    expect(screen.queryByText(/sponsored by/i)).not.toBeInTheDocument();
    rerender(<CompetitionHero competition={{ ...base, sponsorName: "   " }} />);
    expect(screen.queryByText(/sponsored by/i)).not.toBeInTheDocument();
  });
});

describe("CompetitionHero — banner shown at 3:1 (COMP-BRAND-1)", () => {
  const withBanner = {
    ...base,
    backgroundImageUrl: "https://storage.example/banner.jpg",
    imageUrl: "https://storage.example/logo.png",
  };

  it("renders the banner image in a 3:1 frame", () => {
    render(<CompetitionHero competition={withBanner} />);
    const frame = screen.getByTestId("hero-banner");
    expect(frame.className).toContain("aspect-[3/1]");
    expect(frame.querySelector("img")).toHaveAttribute("src", withBanner.backgroundImageUrl);
  });

  it("keeps the 3:1 frame in both preview sizes", () => {
    for (const size of ["phone", "desktop"] as const) {
      const { unmount } = render(<CompetitionHero competition={withBanner} size={size} />);
      expect(screen.getByTestId("hero-banner").className).toContain("aspect-[3/1]");
      unmount();
    }
  });

  it("shows no banner frame when there is no banner image", () => {
    render(<CompetitionHero competition={base} />);
    expect(screen.queryByTestId("hero-banner")).not.toBeInTheDocument();
  });

  it("still shows the logo, exactly once, when there is a banner", () => {
    const { container } = render(<CompetitionHero competition={withBanner} />);
    expect(container.querySelectorAll(`img[src="${withBanner.imageUrl}"]`)).toHaveLength(1);
  });
});
