import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

/**
 * WEB-HONEST-1: the homepage may only claim what is true today. Each test
 * pins one claim that used to be false.
 */
describe("homepage honesty (WEB-HONEST-1)", () => {
  beforeAll(() => {
    // jsdom has neither; the hero scoreboard animation needs both.
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  it("does not claim step data never leaves the player's view, and matches /privacy on retention", () => {
    const { container } = render(<Home />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/never leaves/i);
    expect(text).toMatch(/deleted automatically 30 days after the day/i);
  });

  it("advertises no team-vs-team competitions, paid quotes or non-existent plans", () => {
    const { container } = render(<Home />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/department|rivalr|team leaderboard|Northwind/i);
    expect(text).not.toMatch(/per-player pricing|straight quote/i);
    expect(text).toMatch(/up to 3 free pilot/i);
  });

  it("shows no store buttons or store links while no listing is public", () => {
    const { container } = render(<Home />);
    expect(screen.queryByText(/download on the app store/i)).toBeNull();
    expect(screen.queryByText(/get it on google play/i)).toBeNull();
    expect(container.querySelector('a[href="/download"]')).toBeNull();
  });

  it("never uses fitness wording, 'pts', or shows step numbers", () => {
    const { container } = render(<Home />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/fitness|workout|calorie/i);
    expect(text).not.toMatch(/\bpts\b/i);
    expect(text).not.toMatch(/\d[\d,]*\s+steps/i);
  });
});
