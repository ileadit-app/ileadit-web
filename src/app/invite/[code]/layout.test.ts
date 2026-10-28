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
});
