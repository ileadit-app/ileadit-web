"use client";

import { use } from "react";
import { InviteLanding } from "@/components/invite/InviteLanding";
import { InviteCodeLanding } from "@/components/invite/InviteCodeLanding";
import { isEightCharacterInviteCode } from "@/lib/invites";

/**
 * `/invite/[code]` — the invite landing page. As of WEB-INV-1, this route
 * serves TWO distinct code spaces, distinguished purely by normalised
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

  if (isEightCharacterInviteCode(code)) {
    return <InviteCodeLanding code={code} />;
  }

  return <InviteLanding competitionId={code} />;
}
