import { describe, expect, it } from "vitest";
import robots from "./robots";

/**
 * WEB-CR1-FIX3: the previous version of this file only asserted array
 * MEMBERSHIP of the raw `disallow` strings — it would have passed just as
 * happily with the bug this ticket found (`disallow: ["/account", ...]`
 * silently also blocking the public `/account-deletion` page, since
 * robots.txt matches by PREFIX, not exact path). `matchesDisallowRule`
 * below reimplements that same prefix/`$`-anchor matching semantic
 * (https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt#url-matching-based-on-path-values)
 * so these tests pin actual real-world URL outcomes, not just "is this
 * literal string present in the array".
 */
function matchesDisallowRule(rule: string, path: string): boolean {
  if (rule.endsWith("$")) {
    return path === rule.slice(0, -1);
  }
  return path.startsWith(rule);
}

function isDisallowed(disallow: string[], path: string): boolean {
  return disallow.some((rule) => matchesDisallowRule(rule, path));
}

function getDisallowList(): string[] {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
  const disallow = rules?.disallow;
  return Array.isArray(disallow) ? disallow : disallow ? [disallow] : [];
}

describe("robots", () => {
  it("allows the site root and points at the sitemap", () => {
    const result = robots();
    expect(result.sitemap).toBe("https://ileadit.co.uk/sitemap.xml");
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules?.userAgent).toBe("*");
    expect(rules?.allow).toBe("/");
  });

  it("disallows every authenticated-only route prefix", () => {
    const list = getDisallowList();
    for (const path of ["/dashboard", "/account$", "/account/", "/competitions/new", "/competitions/"]) {
      expect(list).toContain(path);
    }
  });

  it("disallows the protected /account page and its descendants", () => {
    const list = getDisallowList();
    expect(isDisallowed(list, "/account")).toBe(true);
    expect(isDisallowed(list, "/account/")).toBe(true);
    expect(isDisallowed(list, "/account/billing")).toBe(true);
  });

  it("does NOT disallow the public /account-deletion page — the WEB-CR1-FIX3 regression", () => {
    const list = getDisallowList();
    // The bug: a bare "/account" disallow rule is a PREFIX match, so it also
    // matched "/account-deletion" even though that page is public and listed
    // in sitemap.ts. Pin that it stays crawlable.
    expect(isDisallowed(list, "/account-deletion")).toBe(false);
  });

  it("still disallows the other authenticated-route families", () => {
    const list = getDisallowList();
    expect(isDisallowed(list, "/dashboard")).toBe(true);
    expect(isDisallowed(list, "/competitions/new")).toBe(true);
    expect(isDisallowed(list, "/competitions/abc123")).toBe(true);
  });
});
