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

describe("CompetitionHero — logo fills the round badge (WEB-LOGO-FILL-1)", () => {
  it("is a 64 px round badge and the logo fills it (cover, full size, no inset, no white plate)", () => {
    const { container } = render(
      <CompetitionHero competition={{ ...base, imageUrl: "https://storage.example/logo.png" }} />,
    );
    const badge = screen.getByTestId("hero-logo-badge");
    expect(badge.style.width).toBe("64px");
    expect(badge.style.height).toBe("64px");
    expect(badge.className).toContain("rounded-full");
    expect(badge.className).toContain("overflow-hidden");
    expect(badge.className).not.toContain("bg-white");

    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).toHaveAttribute("src", "https://storage.example/logo.png");
    expect(img.className).toContain("object-cover");
    expect(img.className).not.toContain("object-contain");
    expect(img.className).toContain("h-full");
    expect(img.className).toContain("w-full");
    // The old contain-fit inset the image to a fixed inscribed square.
    expect(img.style.width).toBe("");
    expect(img.style.height).toBe("");
  });

  it("with a banner, the logo badge fills the circle the same way", () => {
    const { container } = render(
      <CompetitionHero
        competition={{
          ...base,
          backgroundImageUrl: "https://storage.example/banner.jpg",
          imageUrl: "https://storage.example/logo.png",
        }}
      />,
    );
    const badge = screen.getByTestId("hero-logo-badge");
    const logo = badge.querySelector("img") as HTMLImageElement;
    expect(logo).toHaveAttribute("src", "https://storage.example/logo.png");
    expect(logo.className).toContain("object-cover");
    expect(badge.className).not.toContain("bg-white");
    expect(container.querySelectorAll("img")).toHaveLength(2);
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

describe("CompetitionHero — Invite only badge (INVITE-2)", () => {
  it("shows the badge when inviteOnly is true", () => {
    render(<CompetitionHero competition={{ ...base, inviteOnly: true }} />);
    expect(screen.getByTestId("invite-only-badge")).toHaveTextContent("Invite only");
  });

  it("shows no badge for absent, false or the string 'true'", () => {
    const values: unknown[] = [undefined, false, "true", 1, null];
    for (const inviteOnly of values) {
      const { unmount } = render(
        <CompetitionHero competition={{ ...base, inviteOnly: inviteOnly as boolean }} />,
      );
      expect(screen.queryByTestId("invite-only-badge")).not.toBeInTheDocument();
      expect(screen.queryByText(/invite only/i)).not.toBeInTheDocument();
      unmount();
    }
  });
});
