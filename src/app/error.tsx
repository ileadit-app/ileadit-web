"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import {
  BoundaryCard,
  BOUNDARY_PRIMARY_CTA_CLASSES,
  BOUNDARY_SECONDARY_LINK_CLASSES,
} from "@/components/errors/BoundaryCard";

/**
 * Route-level error boundary (W11-BOUNDARIES). Next.js wraps every page
 * segment under this one in a real React error boundary and renders this
 * component in place of that segment whenever a child throws during
 * render — the root layout (Header/Footer/AuthProvider) is UNAFFECTED and
 * keeps rendering around this; that's what makes it different from
 * `global-error.tsx`, which only fires if the layout itself throws.
 *
 * Before this file existed, any render-time throw anywhere on the site hit
 * Next's bare production default ("Application error: a client-side
 * exception has occurred") — no branding, no way back, and per the ticket
 * brief this is the site's front door for someone arriving cold from an
 * invite link. See this file's other decisions below.
 *
 * MUST be a Client Component — Next.js requires this for `error.tsx`
 * specifically, since it needs `reset()` and to run inside the error
 * boundary React sets up on the client.
 *
 * --- Decision: no bare `reset()` retry button ---
 * `reset()` re-renders the SAME segment with the SAME module/JS state that
 * just threw — it does not refetch data, reload config, or clear anything
 * the failing code depended on. That's a reasonable "try again" for a
 * genuinely transient blip (a flaky single network call). It is not an
 * honest offer for what's actually likely to be wrong on this site today:
 * the engine backend isn't deployed yet (see the accumulated project
 * memory on `ileadit-web`'s callable foundation), so the leading cause of
 * a render throw is a missing/failing callable or a real bug — both
 * structural, not transient — and `reset()` would almost always throw
 * again immediately, looking like an action was taken while doing nothing.
 * Offering it as the primary (or only) way forward would be dishonest UI.
 *
 * Instead: "Back to ileadit" (a real navigation to `/`, guaranteed to land
 * outside whatever subtree just broke) is the primary action, and "Reload
 * this page" is a genuine full browser reload (`location.reload()`, not
 * `reset()`) — that one at least re-fetches everything from scratch, which
 * has a real chance of helping in the cases `reset()` can't (e.g. a stale
 * client bundle after a deploy).
 */
export default function ErrorBoundaryPage({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Never swallow this — the point of a friendly fallback is to replace
    // what the USER sees, not what reaches the console or a future error
    // reporting hook. Deliberately does not print `error.message` or
    // `error.stack` into the rendered page (see the component below) since
    // either can carry internals or, on a Firebase app, identifiers.
    console.error("[error boundary] a page segment failed to render", error);
  }, [error]);

  return (
    <BoundaryCard
      role="alert"
      live
      icon={<AlertCircle className="mx-auto size-8 text-destructive" aria-hidden="true" />}
      title="Something's gone wrong on our end"
      body="This page hit a snag loading, and it isn't something you did. Head back home, or give it a moment and reload."
    >
      <Link href="/" className={BOUNDARY_PRIMARY_CTA_CLASSES}>
        Back to ileadit
      </Link>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className={BOUNDARY_SECONDARY_LINK_CLASSES}
      >
        Reload this page
      </button>
    </BoundaryCard>
  );
}
