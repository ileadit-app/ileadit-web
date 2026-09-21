import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Pricing from "./page";

/**
 * Pins WEB-3 item 4: the stub's body paragraph used `text-text-primary`, a
 * token that doesn't exist anywhere in globals.css's `@theme inline` block
 * — it rendered with no explicit colour at all. Swapped to the real
 * `muted-foreground` token. This is the ONLY thing this ticket changed on
 * this page; it stays an intentionally minimal stub otherwise (the built
 * pricing content lives at `/#pricing`, PricingSection.tsx).
 */
describe("Pricing stub page", () => {
  it("MUT-TOKEN: the body paragraph uses a real token, not the undefined text-text-primary", () => {
    render(<Pricing />);
    const paragraph = screen.getByText(/choose the plan that fits your competition needs/i);
    expect(paragraph.className).toContain("text-muted-foreground");
    expect(paragraph.className).not.toContain("text-text-primary");
  });
});
