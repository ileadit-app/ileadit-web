import type { Metadata } from "next";

const PRIZE_TERMS_TITLE = "Prize terms — ileadit";
const PRIZE_TERMS_DESCRIPTION =
  "The official terms for a competition's prize on ileadit. Entry is always free.";

/**
 * PRZ-W1-PR. `page.tsx` in this directory is a client component (`"use
 * client"`, reads `id` via `use(params)`, see `PrizeTerms.tsx`'s own header
 * comment for why — it needs a live `onSnapshot` listener), so it cannot
 * itself export `generateMetadata`. Same shape as `src/app/invite/[code]/
 * layout.tsx` (WEB-CR1) for the exact same reason.
 *
 * Deliberately GENERIC, hardcoded copy — no Firestore read, and `id` is
 * intentionally unused. This page is shared from the mobile apps to anyone,
 * signed in or not (see `page.tsx`'s own comment); putting a competition's
 * real name/prize detail into a server-rendered `<title>`/link-preview
 * would mean an unauthenticated read done purely to serve crawlers/chat-
 * unfurl bots, which this ticket doesn't ask for and CLAUDE.md's "no user
 * data in generic metadata" instinct (mirrored from the invite route)
 * argues against doing by default.
 *
 * `openGraph`/`twitter` are set explicitly, not just `title`/`description`
 * — per the invite layout's WEB-CR1-FIX3 finding, Next's metadata resolver
 * does not merge these field-by-field with the root layout's own objects;
 * omitting them here would make a shared prize-terms link unfurl advertising
 * the homepage instead.
 */
export function generateMetadata(): Metadata {
  return {
    title: PRIZE_TERMS_TITLE,
    description: PRIZE_TERMS_DESCRIPTION,
    openGraph: {
      type: "website",
      siteName: "ileadit",
      title: PRIZE_TERMS_TITLE,
      description: PRIZE_TERMS_DESCRIPTION,
      // Generic path, not the specific competition id — see comment above.
      url: "/competitions",
    },
    twitter: {
      card: "summary_large_image",
      title: PRIZE_TERMS_TITLE,
      description: PRIZE_TERMS_DESCRIPTION,
    },
  };
}

export default function PrizeTermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
