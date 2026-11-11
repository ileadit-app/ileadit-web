import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Privacy from "./page";

/**
 * WEB-LEGAL-1. Pins the approved privacy policy
 * (.ticket-refs/privacy-policy-APPROVED-20261026.md, Paul, 26 Oct 2026) now
 * live on `/privacy`, replacing the old LegalPagePlaceholder skeleton.
 *
 * WEB-PRIV-3 (Paul, 28 Oct 2026) updated the "App integrity checks" wording
 * to name Apple App Attest and the website's reCAPTCHA (Fraud Defense) use, added a new
 * "Signing in on our website" item, and bumped the last-updated date.
 *
 * WEB-PRIVACY-ALIGN-1 (11 Nov 2026, DRAFT, pending Paul): the alignment tests at
 * the bottom pin each added disclosure to its row in
 * docs/privacy-alignment-20261111.md. They only prove the wording is present,
 * not that Paul has approved it.
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

    expect(screen.getByText(/11 november 2026/i)).toBeInTheDocument();
  });

  it("covers the iPhone app and Apple Health, and drops the Android-only scope line", () => {
    const { container } = render(<Privacy />);
    const text = container.textContent ?? "";

    expect(text).toMatch(/apps for Android and iPhone/);
    expect(text).toMatch(/Apple Health \(HealthKit\)/);
    expect(text).toMatch(/never used for advertising or marketing/);
    expect(text).toMatch(/Settings → Health → Data Access & Devices → ileadit/);
    expect(text).not.toMatch(/When the iPhone app is released/);
  });

  it("describes app integrity checks across all three platforms (WEB-PRIV-3)", () => {
    render(<Privacy />);

    const bodyText = document.body.textContent ?? "";
    expect(bodyText).toMatch(/reCAPTCHA/);
    expect(bodyText).toMatch(/App Attest/);
  });

  it("describes the website's sign-in token storage (WEB-PRIV-3)", () => {
    render(<Privacy />);

    expect(screen.getByText(/signing in on our website/i)).toBeInTheDocument();
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
    // Your account / Your player profile / Your steps / Playing the game /
    // Reports, blocking and name checks / Keeping the app working and secure
    expect(h3s.length).toBe(6);
  });
  describe("WEB-PRIVACY-ALIGN-1 draft additions", () => {
    function section(name: RegExp): HTMLElement {
      const heading = screen.getByRole("heading", { name });
      const el = heading.closest("section");
      expect(el).not.toBeNull();
      return el as HTMLElement;
    }

    it("F4: says only the 16+ confirmation and its time are stored, still no date of birth", () => {
      render(<Privacy />);

      const text = section(/2\. what we collect/i).textContent ?? "";
      expect(text).toMatch(/store only that you confirmed it, and when/);
      expect(text).toMatch(/don't ask for your date of birth/);
    });

    it("F5: discloses the legal acceptance record, in collection, retention and deletion", () => {
      render(<Privacy />);

      expect(section(/2\. what we collect/i)).toHaveTextContent(
        /which version of our terms of use and this privacy policy you accepted, and when/i,
      );
      expect(section(/6\. how long/i)).toHaveTextContent(/record of the terms and policy versions you accepted/i);
      expect(section(/7\. deleting your account/i)).toHaveTextContent(
        /record of which terms and policy versions you accepted/i,
      );
    });

    it("F6: describes reports, expiry, reporter-note removal and what a block hides", () => {
      render(<Privacy />);

      const text = section(/2\. what we collect/i).textContent ?? "";
      expect(text).toMatch(/up to 300 characters/);
      expect(text).toMatch(/deleted automatically after 12 months/);
      expect(text).toMatch(/your note is deleted/);
      expect(text).toMatch(/Your app then hides their name and photo/);
      expect(text).toMatch(/they are not told/);
      expect(section(/6\. how long/i)).toHaveTextContent(/reports you make, or that are about you/i);
      expect(section(/6\. how long/i)).toHaveTextContent(/your block list/i);
    });

    it("F7: describes the name filter reset and the 7-day lock", () => {
      render(<Privacy />);

      const text = section(/2\. what we collect/i).textContent ?? "";
      expect(text).toMatch(/automatic word filter/);
      expect(text).toMatch(/We don't keep the rejected name/);
      expect(text).toMatch(/can't change your name or photo again for 7 days/);
    });

    it("F8: describes prize data and the claim window, and says no contact details are collected", () => {
      render(<Privacy />);

      const text = section(/2\. what we collect/i).textContent ?? "";
      expect(text).toMatch(/currently 14 days/);
      expect(text).toMatch(/We don't ask you for your address, phone number or other contact details for a prize/);
      expect(section(/6\. how long/i)).toHaveTextContent(/prize claim record/i);
    });

    it("F9: anti-cheat retention is no longer 'a rolling 30 days' alone, and a prize hold is disclosed", () => {
      render(<Privacy />);

      expect(section(/6\. how long/i)).toHaveTextContent(/up to 400 days/);
      expect(section(/2\. what we collect/i)).toHaveTextContent(/pause the prize while the ileadit team takes a look/);
    });

    it("F9/F10: states backup retention and that deleted data can linger in backups", () => {
      render(<Privacy />);

      expect(section(/6\. how long/i)).toHaveTextContent(/up to 30 days.*last 7 days/);
      expect(section(/7\. deleting your account/i)).toHaveTextContent(
        /remain in a backup for up to 30 days/,
      );
    });

    it("never prints a step number anywhere on the page", () => {
      render(<Privacy />);

      const text = document.body.textContent ?? "";
      expect(text).not.toMatch(/\d[\d,]*\s+steps/);
    });
  });
});
