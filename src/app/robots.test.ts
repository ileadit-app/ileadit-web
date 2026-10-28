import { describe, expect, it } from "vitest";
import robots from "./robots";

/**
 * WEB-CR1-FIX3: the previous version of this file only asserted array
 * MEMBERSHIP of the raw `disallow` strings — it would have passed just as
 * happily with the bug this ticket found (`disallow: ["/account", ...]`
 * silently also blocking the public `/account-deletion` page, since
 * robots.txt matches by PREFIX, not exact path). `matchesRule` below
 * reimplements that same prefix/`$`-anchor/`*`-wildcard matching semantic,
 * and `resolve` reimplements Google's documented ALLOW-VS-DISALLOW
 * precedence (the longer/more specific matching rule wins, allow wins ties)
 * (https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt#url-matching-based-on-path-values)
 * so these tests pin actual real-world URL outcomes, not just "is this
 * literal string present in the array". PRZ-W1-PR added the `*`-wildcard
 * support and the allow-vs-disallow precedence check for the new
 * `/competitions/*\/prize-terms` carve-out (see `robots.ts`'s own comment).
 */
function escapeRegExpLiteral(segment: string): string {
  return segment.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

function matchesRule(rule: string, path: string): boolean {
  const anchored = rule.endsWith("$");
  const pattern = anchored ? rule.slice(0, -1) : rule;
  const regexSource = pattern.split("*").map(escapeRegExpLiteral).join(".*");
  const regex = new RegExp(`^${regexSource}${anchored ? "$" : ""}`);
  return regex.test(path);
}

function longestMatch(rules: string[], path: string): string | null {
  const matches = rules.filter((rule) => matchesRule(rule, path));
  if (matches.length === 0) return null;
  return matches.reduce((longest, rule) => (rule.length > longest.length ? rule : longest));
}

function getRuleLists(): { allow: string[]; disallow: string[] } {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
  const toList = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value : value ? [value] : [];
  return { allow: toList(rules?.allow), disallow: toList(rules?.disallow) };
}

/** Real-world outcome for a path: the longer/more specific matching rule
 * wins; an allow rule wins a tie against a disallow rule of equal length. */
function isDisallowed(disallow: string[], path: string, allow: string[] = []): boolean {
  const matchedDisallow = longestMatch(disallow, path);
  if (!matchedDisallow) return false;
  const matchedAllow = longestMatch(allow, path);
  if (!matchedAllow) return true;
  return matchedAllow.length < matchedDisallow.length;
}

function getDisallowList(): string[] {
  return getRuleLists().disallow;
}

describe("robots", () => {
  it("allows the site root and points at the sitemap", () => {
    const result = robots();
    expect(result.sitemap).toBe("https://ileadit.co.uk/sitemap.xml");
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules?.userAgent).toBe("*");
    expect(getRuleLists().allow).toContain("/");
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

  it("does NOT disallow the public /competitions/[id]/prize-terms page — PRZ-W1-PR", () => {
    // The bare "/competitions/" disallow rule is a prefix match, so it would
    // also match the deliberately-public prize-terms route (see
    // page.tsx/robots.ts's own comments) unless a more specific `allow` rule
    // carves it out. Pin that it stays crawlable for real-world competition
    // ids, including ids containing dashes.
    const { allow, disallow } = getRuleLists();
    expect(isDisallowed(disallow, "/competitions/abc123/prize-terms", allow)).toBe(false);
    expect(isDisallowed(disallow, "/competitions/comp-with-dashes/prize-terms", allow)).toBe(false);
  });

  it("still disallows every OTHER route under a competition id, e.g. the protected detail/invite/settings pages", () => {
    const { allow, disallow } = getRuleLists();
    expect(isDisallowed(disallow, "/competitions/abc123", allow)).toBe(true);
    expect(isDisallowed(disallow, "/competitions/abc123/invite", allow)).toBe(true);
    expect(isDisallowed(disallow, "/competitions/abc123/settings", allow)).toBe(true);
    // Not a real route today, but proves the allow rule is narrowly scoped
    // to the exact "/prize-terms" suffix, not a loose "contains prize-terms".
    expect(isDisallowed(disallow, "/competitions/abc123/prize-terms-admin", allow)).toBe(true);
  });
});
