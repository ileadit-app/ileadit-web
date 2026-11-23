import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Terms from "./page";

/**
 * Pins the approved Terms of Use v1 (Paul, 27 Oct 2026) now live on `/terms`,
 * replacing the old placeholder skeleton.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("/terms — approved Terms of Use v1", () => {
  it("renders the company identity and version", () => {
    render(<Terms />);

    expect(screen.getAllByText(/kranthews ltd/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/14373131/)).toBeInTheDocument();
    expect(screen.getByText(/version 1\. last updated:/i)).toBeInTheDocument();
  });

  it("states 16+, free entry and the Apple/Google disclaimer", () => {
    render(<Terms />);

    const text = document.body.textContent ?? "";
    expect(text).toMatch(/16 or over/);
    expect(text).toMatch(/Entry is always free\./);
    expect(text).toMatch(/Apple and Google are not sponsors of, and are not involved in, any ileadit competition or prize\./);
  });

  it("WEB-POLICY-1: bans alcohol, tobacco, vaping and gambling prizes, and shows the new date", () => {
    render(<Terms />);

    const text = document.body.textContent ?? "";
    expect(text).toMatch(
      /Prizes can't be alcohol, tobacco or vaping products, or anything to do with gambling \(for example betting credit or lottery tickets\)\./,
    );
    expect(text).toMatch(/Version 1\. Last updated: 23 November 2026/);
  });

  it("links the privacy policy and the contact email", () => {
    render(<Terms />);

    expect(screen.getAllByRole("link", { name: "ileadit.co.uk/privacy" })[0]).toHaveAttribute("href", "/privacy");
    screen.getAllByRole("link", { name: /hello@ileadit\.co\.uk/i }).forEach((link) => {
      expect(link).toHaveAttribute("href", "mailto:hello@ileadit.co.uk");
    });
  });

  it("has no placeholder language and keeps headings in order", () => {
    render(<Terms />);

    const text = (document.body.textContent ?? "").toLowerCase();
    expect(text).not.toMatch(/placeholder/);
    expect(text).not.toContain("not for production");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 2, name: /16\. contact us/i })).toBeInTheDocument();
  });
});
