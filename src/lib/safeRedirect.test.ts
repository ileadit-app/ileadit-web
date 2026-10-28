import { describe, expect, it } from "vitest";
import { DEFAULT_REDIRECT, resolveSafeRedirect } from "./safeRedirect";

/**
 * WEB-CR1 (28 Oct code review). `resolveSafeRedirect` guards the `?redirect=`
 * query param `/login`/`/signup` round-trip to — see the header comment in
 * safeRedirect.ts for the open-redirect shape this exists to block. Each
 * rejection case below pins a DISTINCT attacker-controllable shape, not just
 * "garbage in, default out".
 */
const ORIGIN = "https://ileadit.co.uk";

describe("resolveSafeRedirect", () => {
  it("passes through a same-origin path", () => {
    expect(resolveSafeRedirect("/dashboard", ORIGIN)).toBe("/dashboard");
  });

  it("preserves query string and hash on a same-origin path", () => {
    expect(resolveSafeRedirect("/competitions/new?step=2#top", ORIGIN)).toBe(
      "/competitions/new?step=2#top",
    );
  });

  it.each([null, undefined, ""])("falls back to the default for %p", (value) => {
    expect(resolveSafeRedirect(value, ORIGIN)).toBe(DEFAULT_REDIRECT);
  });

  it("rejects a protocol-relative URL (//evil.example)", () => {
    expect(resolveSafeRedirect("//evil.example", ORIGIN)).toBe(DEFAULT_REDIRECT);
  });

  it("rejects an absolute off-origin URL", () => {
    expect(resolveSafeRedirect("https://evil.example/phish", ORIGIN)).toBe(DEFAULT_REDIRECT);
  });

  it("rejects an absolute URL that merely starts with the right host as a substring", () => {
    expect(resolveSafeRedirect("https://ileadit.co.uk.evil.example/", ORIGIN)).toBe(DEFAULT_REDIRECT);
  });

  it("rejects a value that doesn't start with a single leading slash", () => {
    expect(resolveSafeRedirect("evil.example/dashboard", ORIGIN)).toBe(DEFAULT_REDIRECT);
  });

  it("rejects a javascript: URL", () => {
    expect(resolveSafeRedirect("javascript:alert(1)", ORIGIN)).toBe(DEFAULT_REDIRECT);
  });

  it("falls back to the default when the parsed path is empty (edge case of a bare origin)", () => {
    // New URL("/", origin).pathname is "/" (not ""), but this exercises the
    // `target || DEFAULT_REDIRECT` fallback path explicitly for coverage.
    expect(resolveSafeRedirect("/", ORIGIN)).toBe("/");
  });
});
