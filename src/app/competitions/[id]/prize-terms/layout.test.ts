import { describe, expect, it } from "vitest";
import { generateMetadata } from "./layout";

/**
 * PRZ-W1-PR: the prize-terms route's metadata must be generic and must
 * never depend on the competition id (no server-side Firestore read) —
 * see this file's own header comment for why. Mirrors
 * `src/app/invite/[code]/layout.test.ts`.
 */
describe("prize terms route metadata", () => {
  it("is generic, with no competition-specific content", () => {
    const metadata = generateMetadata();
    expect(metadata.title).toBe("Prize terms — ileadit");
    expect(metadata.description).toMatch(/entry is always free/i);
  });

  it("carries its own generic social (openGraph/twitter) metadata, not the homepage's", () => {
    const metadata = generateMetadata();
    const homepageTitle = "ileadit — Are you an average winner?";

    expect(metadata.openGraph).toBeDefined();
    expect(metadata.openGraph?.title).toBe("Prize terms — ileadit");
    expect(metadata.openGraph?.title).not.toBe(homepageTitle);
    expect(metadata.openGraph?.url).not.toBe("/");

    expect(metadata.twitter).toBeDefined();
    expect((metadata.twitter as { title?: string })?.title).toBe("Prize terms — ileadit");
    expect((metadata.twitter as { title?: string })?.title).not.toBe(homepageTitle);
  });
});
