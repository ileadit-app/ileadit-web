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
