import type { MetadataRoute } from "next";

const SITE_URL = "https://ileadit.co.uk";

/**
 * WEB-CR1. Everything under `/dashboard`, `/competitions/new`,
 * `/competitions/[id]` (and its `/invite`, `/settings` sub-routes), and
 * `/account` is behind `<ProtectedRoute>` (see CLAUDE.md's "Authenticated"
 * page list) — a crawler can't do anything useful there anyway, but
 * `disallow` keeps it out of search results/sitemaps-of-sitemaps tooling
 * explicitly rather than relying on the login redirect alone.
 *
 * `/invite/[code]` is deliberately NOT disallowed — it's a real public page
 * (see CLAUDE.md's "Public" list) meant to be opened from a shared link, it
 * just isn't enumerable up front so it can't appear in sitemap.ts.
 *
 * WEB-CR1-FIX3: `/account` (no trailing segment) used to be the disallow
 * entry for the PROTECTED `/account` page — but robots.txt `disallow`
 * matches by PREFIX, so the bare string `/account` also matches the public
 * `/account-deletion` page (see CLAUDE.md's "Public" list — it's a Play
 * Store requirement page, and it's listed in sitemap.ts, which a robots
 * rule silently blocking it would directly contradict). `/account$`
 * anchors to the exact path, and `/account/` separately covers the
 * protected page's own descendants (e.g. a future `/account/billing`, see
 * CLAUDE.md's page list) without recapturing `/account-deletion`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/account$", "/account/", "/competitions/new", "/competitions/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
