import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Support, { metadata } from "./page";

/** WEB-SUPPORT-1: the App Store Support URL page. */
describe("/support", () => {
  it("has the agreed title", () => {
    expect(metadata.title).toBe("Support — ileadit");
  });

  it("gives a real mailto contact and the reply promise", () => {
    render(<Support />);
    const mail = screen.getByRole("link", { name: "hello@ileadit.co.uk" });
    expect(mail).toHaveAttribute("href", "mailto:hello@ileadit.co.uk");
    expect(document.body).toHaveTextContent(/within 2 working days/i);
  });

  it("has one h1 and six FAQs as native details/summary", () => {
    const { container } = render(<Support />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(container.querySelectorAll("details > summary")).toHaveLength(6);
  });

  it("links to privacy, terms and account deletion", () => {
    render(<Support />);
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(
      expect.arrayContaining(["/privacy", "/terms", "/account-deletion"]),
    );
  });

  it("never implies anyone else can see steps, and avoids banned words", () => {
    const { container } = render(<Support />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/Nobody else\. Not other players, and not competition organisers/);
    expect(text).not.toMatch(/fitness|workout|calories|\bpts\b/i);
  });
});
