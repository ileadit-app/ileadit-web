import Link from "next/link";
import type { Metadata } from "next";
import { LogoMark } from "@/components/brand/Logo";
import {
  BoundaryCard,
  BOUNDARY_PRIMARY_CTA_CLASSES,
  BOUNDARY_SECONDARY_LINK_CLASSES,
} from "@/components/errors/BoundaryCard";

export const metadata: Metadata = {
  title: "Page not found — ileadit",
};

/**
 * Site-wide 404 (W11-BOUNDARIES). Renders for any URL that doesn't match a
 * route, and for any page that explicitly calls `notFound()` from
 * `next/navigation` (none currently do — see this file's own note on
 * `/invite/[code]` below). Runs inside the normal root layout
 * (Header/Footer/AuthProvider all still render), unlike `global-error.tsx`.
 *
 * Uses the logo mark, not the warning icon — a bad URL is a normal,
 * expected navigational outcome, not a failure, and shouldn't read as one
 * (same distinction `InviteLanding.tsx`'s `InviteStatusCard` already makes
 * between its `isError` and default icon).
 *
 * --- Does `/invite/[code]` need its own not-found.tsx? No — and it can't
 * shadow this one, because it never reaches it. ---
 * This file only fires for a URL Next can't match to any route, or a call
 * to `notFound()`. `/invite/[code]` matches for ANY `code` value (it's a
 * dynamic segment with no validation at the routing layer), and
 * `InviteLanding.tsx` never calls `notFound()` — an invalid/expired code
 * is a normal Firestore "no such document" result, handled entirely inside
 * `SignedInInviteContent` as a `competitionState.status === "not-found"`
 * render branch (see `NotFoundInvite` in that file), with its own
 * invite-specific copy ("This invite link isn't valid... double-check it
 * with whoever sent it"). That is the ONLY place "bad invite code" is
 * handled, and it already existed before this ticket — this file never
 * sees that case, so there is no duplicate treatment to reconcile. This
 * file exists for the genuinely different case of a URL that doesn't match
 * any route at all (typo'd path, stale bookmark to a page that moved).
 */
export default function NotFound() {
  return (
    <BoundaryCard
      icon={<LogoMark className="mx-auto h-10 w-10" />}
      title="We couldn't find that page"
      body="The link might be out of date, or the page may have moved. Here's how to get back on track."
    >
      <Link href="/" className={BOUNDARY_PRIMARY_CTA_CLASSES}>
        Back to ileadit
      </Link>
      <Link href="/dashboard" className={BOUNDARY_SECONDARY_LINK_CLASSES}>
        Go to your dashboard
      </Link>
    </BoundaryCard>
  );
}
