import type { Metadata } from "next";

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
 */
export function generateMetadata(): Metadata {
  return {
    title: "You're invited to an ileadit competition",
    description: "Open this link to see the competition and join in — ileadit is a game you play by walking.",
  };
}

export default function InviteCodeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
