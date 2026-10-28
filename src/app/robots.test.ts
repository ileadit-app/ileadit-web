import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots", () => {
  it("allows the site root and points at the sitemap", () => {
    const result = robots();
    expect(result.sitemap).toBe("https://ileadit.co.uk/sitemap.xml");
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules?.userAgent).toBe("*");
    expect(rules?.allow).toBe("/");
  });

  it("disallows every authenticated-only route prefix", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    const disallow = rules?.disallow;
    const list = Array.isArray(disallow) ? disallow : [disallow];
    for (const path of ["/dashboard", "/account", "/competitions/new", "/competitions/"]) {
      expect(list).toContain(path);
    }
  });
});
