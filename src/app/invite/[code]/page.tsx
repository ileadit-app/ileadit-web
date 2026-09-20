"use client";

import { use } from "react";
import { InviteLanding } from "@/components/invite/InviteLanding";

/**
 * `/invite/[code]` — the invite landing page (W6-INVITE). See
 * `InviteLanding.tsx`'s header comment for why `code` is treated as a raw
 * `competitions/{id}` document ID rather than a real invite-code lookup —
 * there is no `invites` collection or invite-code callable anywhere in the
 * engine today.
 *
 * Deliberately NOT wrapped in `<ProtectedRoute>` (contrast
 * `/competitions/[id]/page.tsx`) — most people who land here have never
 * signed in, and the point of this page is to greet them with an
 * explanation and a way in, not bounce them straight to `/login` with no
 * context. `InviteLanding` renders its own signed-out state instead.
 */
export default function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  return <InviteLanding competitionId={code} />;
}
