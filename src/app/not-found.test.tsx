import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "./not-found";

/**
 * Pins W11-BOUNDARIES's site-wide 404. `next/link` stubbed to a plain
 * anchor, same convention as the other route-test files in this repo.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("not-found.tsx — site-wide 404", () => {
  it("MUT-404-1: renders real navigation, not a dead end", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: /we couldn't find that page/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to ileadit/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /go to your dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });
});
