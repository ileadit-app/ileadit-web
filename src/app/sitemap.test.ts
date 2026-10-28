import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("lists only the static public pages, as absolute ileadit.co.uk URLs", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual([
      "https://ileadit.co.uk/",
      "https://ileadit.co.uk/pricing",
      "https://ileadit.co.uk/about",
      "https://ileadit.co.uk/privacy",
      "https://ileadit.co.uk/terms",
      "https://ileadit.co.uk/account-deletion",
      "https://ileadit.co.uk/download",
    ]);
  });

  it("never includes an authenticated or dynamic invite route", () => {
    const urls = sitemap().map((entry) => entry.url);
    for (const url of urls) {
      expect(url).not.toMatch(/\/dashboard|\/account\/|\/competitions|\/invite\//);
    }
  });
});
