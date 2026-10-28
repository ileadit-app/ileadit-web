import type { Metadata } from "next";

const INVITE_TITLE = "You're invited to an ileadit competition";
const INVITE_DESCRIPTION = "Open this link to see the competition and join in — ileadit is a game you play by walking.";

/**
 * WEB-CR1. `page.tsx` in this directory is a client component (`"use
 * client"`, reads `code` via `use(params)`), so it cannot itself export
 * `generateMetadata` — that must live in a server-component sibling, which
 * is what this file is for.
 *
 * Deliberately GENERIC, hardcoded copy — no `fetch`/Firestore read of any
 * kind, and the `code` param is intentionally unused. `code` is either a
 * real invite code OR (legacy path, see `page.tsx`'s own header comment) a
 * raw `competitions/{id}` Firestore document ID — either way, looking it up
 * server-side just to put a competition's name into a link-preview title
 * would mean doing an unauthenticated read of competition data purely to
 * serve crawlers/chat-unfurl bots, which this ticket explicitly rules out.
 *
 * WEB-CR1-FIX3: `openGraph`/`twitter` are set here explicitly, not just
 * `title`/`description`. Next's metadata resolver (confirmed by reading
 * `node_modules/next/dist/lib/metadata/resolvers/resolve-opengraph.js`)
 * resolves `openGraph`/`twitter` ENTIRELY from whatever object the most
 * specific segment defines — it does not merge individual fields with an
 * ancestor's `openGraph`/`twitter` object. The root layout
 * (`src/app/layout.tsx`) sets its own full `openGraph`/`twitter` objects
 * naming the HOMEPAGE; a segment that only overrides plain `title`/
 * `description` (as this file did before this fix) leaves those two objects
 * fully inherited from the root, so a shared invite link unfurls in
 * Slack/WhatsApp/iMessage/etc. advertising "Are you an average winner?" and
 * the homepage's own description/URL instead of this generic invite copy —
 * silently wrong for the one page on this site whose entire purpose is
 * being shared as a link. Every route that wants its own social preview
 * must set BOTH objects itself, not rely on the plain fields alone.
 */
export function generateMetadata(): Metadata {
  return {
    title: INVITE_TITLE,
    description: INVITE_DESCRIPTION,
    openGraph: {
      type: "website",
      siteName: "ileadit",
      title: INVITE_TITLE,
      description: INVITE_DESCRIPTION,
      // Generic path, not the specific `code` — stays as non-specific as
      // the title/description above (no per-invite data fetch, see the
      // comment above).
      url: "/invite",
    },
    twitter: {
      card: "summary_large_image",
      title: INVITE_TITLE,
      description: INVITE_DESCRIPTION,
    },
  };
}

export default function InviteCodeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
