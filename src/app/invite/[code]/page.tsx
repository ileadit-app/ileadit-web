"use client";

import { use } from "react";
import Link from "next/link";
import { PartyPopper } from "lucide-react";
import { InviteLanding } from "@/components/invite/InviteLanding";
import { InviteCodeLanding } from "@/components/invite/InviteCodeLanding";
import { isEightCharacterInviteCode } from "@/lib/invites";
import { formatShortDate } from "@/lib/competitionDates";
import { resolveShopRound } from "@/lib/shopLinks";

/**
 * `/invite/[code]` — the invite landing page. This route serves THREE code
 * spaces. WEB-SHOP-LINK adds the first, checked BEFORE the length split:
 *
 * - **4 to 7 characters** → a SHOP code (`src/lib/shopLinks.ts`), e.g.
 *   `/invite/BEAN26`. Resolves to that shop's current weekly round and
 *   renders `InviteCodeLanding` for that round's real invite code. The URL
 *   stays the shop link (no redirect) so the printed QR keeps working all
 *   season. An unknown 4–7 character code is "not a shop" and falls through
 *   to the existing behaviour below (the legacy path, which shows its own
 *   not-found state), exactly as before. Shop codes can never be 8 or 20
 *   characters, so they cannot shadow the two spaces below.
 *
 * As of WEB-INV-1, the other two code spaces are, distinguished purely by normalised
 * length (see `isEightCharacterInviteCode`, `src/lib/invites.ts`):
 *
 * - **8 characters** → a real `invites/{CODE}` document (engine ticket
 *   INV-1, Ivor — NOT deployed as of 2026-09-21) → `InviteCodeLanding.tsx`,
 *   built against `previewInvite`/`acceptInvite`.
 * - **Anything else (in practice, always 20)** → the LEGACY path, where
 *   `code` is literally a raw `competitions/{id}` document ID (see
 *   `InviteLanding.tsx`'s own header comment for the full history) →
 *   unchanged, still `InviteLanding.tsx`.
 *
 * Firestore auto-generated IDs are always exactly 20 alphanumeric
 * characters, so stripping non-alphanumerics (which `isEightCharacterInvite
 * Code` does internally) never coincidentally turns one into 8 — this
 * length check is a reliable, sufficient discriminator without needing to
 * know anything about the invite code alphabet itself. Existing
 * `/invite/<competitionId>` links MUST keep working exactly as before —
 * this routing split is additive, not a replacement.
 *
 * Deliberately NOT wrapped in `<ProtectedRoute>` for either branch
 * (contrast `/competitions/[id]/page.tsx`) — most people who land here have
 * never signed in, and the point of this page is to greet them with an
 * explanation and a way in, not bounce them straight to `/login` with no
 * context. Both landing components render their own signed-out state.
 */
export default function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  // Evaluated at render time; the shop's own London calendar date decides
  // the round, so a render either side of Sunday midnight picks a different
  // round, which is the intended behaviour.
  const shop = resolveShopRound(code, new Date());

  if (shop.kind === "finished") {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center sm:px-6">
        <PartyPopper className="mx-auto size-8 text-brand-navy" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-extrabold text-foreground">
          {shop.shopName}&apos;s ileadit rounds have finished. Thanks for playing!
        </h1>
        <div className="mt-6 flex justify-center">
          <Link
            href="/download"
            className="inline-flex h-12 items-center rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold px-6 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
          >
            Get the app
          </Link>
        </div>
      </div>
    );
  }

  if (shop.kind === "round") {
    return (
      <>
        <p
          data-testid="shop-round-line"
          className="mx-auto max-w-lg px-5 pt-8 text-center text-sm font-bold text-muted-foreground sm:px-6"
        >
          {shop.shopName} · Round {shop.roundNumber} of {shop.totalRounds},{" "}
          {formatShortDate(shop.startDate)} to {formatShortDate(shop.endDate)}
        </p>
        <InviteCodeLanding code={shop.inviteCode} />
      </>
    );
  }

  if (isEightCharacterInviteCode(code)) {
    return <InviteCodeLanding code={code} />;
  }

  return <InviteLanding competitionId={code} />;
}
