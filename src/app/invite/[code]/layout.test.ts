import { describe, expect, it } from "vitest";
import { generateMetadata } from "./layout";

/**
 * WEB-CR1: the invite route's metadata must be generic and must never
 * depend on `code` (no server-side competition/user data fetch) — see this
 * file's own header comment for why. `generateMetadata` deliberately takes
 * no params, so there's nothing to vary the assertion by; this test just
 * pins the exact generic copy so a future edit can't quietly start reading
 * `params` without the change being obvious in review.
 */
describe("invite code route metadata", () => {
  it("is generic, with no competition-specific content", () => {
    const metadata = generateMetadata();
    expect(metadata.title).toBe("You're invited to an ileadit competition");
    expect(metadata.description).toMatch(/ileadit is a game you play by walking/);
  });

  /**
   * WEB-CR1-FIX3: before this fix, this file only overrode the plain
   * `title`/`description` fields. Next's metadata resolver does NOT merge
   * `openGraph`/`twitter` field-by-field with an ancestor layout — a
   * segment that doesn't set its own `openGraph`/`twitter` object inherits
   * the ROOT layout's in full, which names the homepage ("Are you an
   * average winner?") and points `url` at "/". A shared invite link would
   * therefore unfurl in Slack/WhatsApp/etc. advertising the homepage, not
   * the invite. Pin that both objects are set here, independently of the
   * homepage's own copy.
   */
  it("carries its own generic social (openGraph/twitter) metadata, not the homepage's", () => {
    const metadata = generateMetadata();
    const homepageTitle = "ileadit — Are you an average winner?";

    expect(metadata.openGraph).toBeDefined();
    expect(metadata.openGraph?.title).toBe("You're invited to an ileadit competition");
    expect(metadata.openGraph?.title).not.toBe(homepageTitle);
    expect(metadata.openGraph?.description).toMatch(/ileadit is a game you play by walking/);
    expect(metadata.openGraph?.url).not.toBe("/");

    expect(metadata.twitter).toBeDefined();
    expect((metadata.twitter as { title?: string })?.title).toBe("You're invited to an ileadit competition");
    expect((metadata.twitter as { title?: string })?.title).not.toBe(homepageTitle);
  });
});
