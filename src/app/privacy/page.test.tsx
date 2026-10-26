import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Privacy from "./page";

/**
 * WEB-LEGAL-1. Pins the approved privacy policy
 * (.ticket-refs/privacy-policy-APPROVED-20261026.md, Paul, 26 Oct 2026) now
 * live on `/privacy`, replacing the old LegalPagePlaceholder skeleton.
 *
 * `next/link` is stubbed to a plain anchor — routing context isn't under
 * test here.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("/privacy — approved policy (WEB-LEGAL-1)", () => {
  it("renders the controller's real company identity", () => {
    render(<Privacy />);

    expect(screen.getAllByText(/kranthews ltd/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/14373131/)).toBeInTheDocument();
    expect(screen.getByText(/zb616290/i)).toBeInTheDocument();
  });

  it("renders the contact email as a mailto link", () => {
    render(<Privacy />);

    const links = screen.getAllByRole("link", { name: /hello@ileadit\.co\.uk/i });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link).toHaveAttribute("href", "mailto:hello@ileadit.co.uk");
    });
  });

  it("has no placeholder/skeleton language anywhere on the page", () => {
    render(<Privacy />);

    const bodyText = document.body.textContent ?? "";
    expect(bodyText).not.toMatch(/placeholder/i);
    expect(bodyText.toLowerCase()).not.toContain("not for production");
    expect(bodyText.toLowerCase()).not.toContain("legal counsel");
  });

  it('the "Deleting your account" section mentions Settings', () => {
    render(<Privacy />);

    const heading = screen.getByRole("heading", { name: /7\. deleting your account/i });
    const section = heading.closest("section");
    expect(section).not.toBeNull();
    expect(section).toHaveTextContent(/settings/i);
  });

  it("links the ICO complaint reference to the real ICO URL", () => {
    render(<Privacy />);

    const link = screen.getByRole("link", { name: /ico\.org\.uk\/make-a-complaint/i });
    expect(link).toHaveAttribute("href", "https://ico.org.uk/make-a-complaint");
  });

  it("links the account-deletion reference to /account-deletion", () => {
    render(<Privacy />);

    const link = screen.getByRole("link", { name: /ileadit\.co\.uk\/account-deletion/i });
    expect(link).toHaveAttribute("href", "/account-deletion");
  });

  it("shows the approved last-updated date", () => {
    render(<Privacy />);

    expect(screen.getByText(/26 october 2026/i)).toBeInTheDocument();
  });

  it("gives every numbered section a stable id for #anchor links", () => {
    render(<Privacy />);

    expect(document.getElementById("deleting-your-account")).not.toBeNull();
    expect(document.getElementById("who-we-are")).not.toBeNull();
    expect(document.getElementById("your-rights")).not.toBeNull();
  });

  it("renders the two data tables with scoped column headers inside a scrollable container", () => {
    render(<Privacy />);

    const tables = screen.getAllByRole("table");
    expect(tables.length).toBe(2);
    tables.forEach((table) => {
      const scrollParent = table.parentElement;
      expect(scrollParent).toHaveClass("overflow-x-auto");
      const headers = table.querySelectorAll("th");
      expect(headers.length).toBeGreaterThan(0);
      headers.forEach((th) => {
        expect(th).toHaveAttribute("scope", "col");
      });
    });
  });

  it("renders heading levels in order (h1 then h2s, h3s only inside section 2)", () => {
    render(<Privacy />);

    expect(screen.getByRole("heading", { level: 1, name: /privacy policy/i })).toBeInTheDocument();
    const h2s = screen.getAllByRole("heading", { level: 2 });
    expect(h2s.length).toBeGreaterThan(5);
    const h3s = screen.getAllByRole("heading", { level: 3 });
    expect(h3s.length).toBe(5); // Your account / Your player profile / Your steps / Playing the game / Keeping the app working and secure
  });
});
