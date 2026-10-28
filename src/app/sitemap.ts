import type { MetadataRoute } from "next";

const SITE_URL = "https://ileadit.co.uk";

/**
 * WEB-CR1. Public, static, enumerable marketing/legal pages only — per
 * CLAUDE.md's "Public" page list, minus `/invite/[code]`: that route is
 * genuinely public, but its `code` segment has no finite/enumerable list to
 * generate from the web portal (and, per the invite-system gotcha memory,
 * `code` is often literally someone else's Firestore competition ID — not
 * something to publish in a crawlable sitemap even if it were enumerable).
 * Authenticated pages (`/dashboard`, `/competitions/*`, `/account*`) are
 * excluded here and explicitly disallowed in `robots.ts`.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const paths = ["/", "/pricing", "/about", "/privacy", "/terms", "/account-deletion", "/download"];
  return paths.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
  }));
}
