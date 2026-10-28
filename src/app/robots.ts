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
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/account", "/competitions/new", "/competitions/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
