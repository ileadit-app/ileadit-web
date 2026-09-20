"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@/context/AuthContext";

/**
 * Route guard for the pages CLAUDE.md lists under "Authenticated"
 * (`/dashboard`, `/account`, `/competitions/new`). Wrap a page's content in
 * this component. It renders no visual design of its own beyond a single
 * neutral status line — Lacey owns the real UI for these pages; this is
 * plumbing only, per the P1.2 ticket's split of work.
 *
 * Usage (a Server Component page can pass its content straight through —
 * this composition works fine in the App Router even though this file is a
 * Client Component):
 *
 *   export default function Dashboard() {
 *     return (
 *       <ProtectedRoute>
 *         <div>...</div>
 *       </ProtectedRoute>
 *     );
 *   }
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Only redirect once status is DEFINITELY "signed-out" — never on
    // "loading". Redirecting on "loading" would bounce every returning,
    // already-signed-in visitor to the sign-in page for one frame on every
    // page load, which is the same flicker bug in a different guise.
    //
    // `/login` does not exist in this repo yet — Lacey is building it in
    // parallel (P1.1). Route and param name (`/login`, `?redirect=`) match
    // her approved spec (automation-hub/docs/ileadit-web-signin-design-
    // 20260920.md §2), which superseded the earlier `/sign-in?next=`
    // placeholder this file shipped with under P1.2 — update this comment
    // again if that spec's routes ever change.
    if (status === "signed-out") {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  // The flicker this whole component exists to prevent: rendering
  // `children` (protected content) before Firebase has resolved whether a
  // persisted session exists would show it for one frame to EVERY visitor,
  // signed in or not. `status` (not `user` — see AuthContext.tsx) is what
  // makes "still resolving" legible as a distinct state from "signed out".
  // Treat "loading" and "signed-out" identically here: for "loading" we
  // don't yet know; for "signed-out" the redirect above is in flight and
  // rendering protected content even briefly would defeat the guard.
  if (status !== "signed-in") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16" role="status" aria-live="polite">
        <p className="text-lg text-muted-foreground">Checking your session…</p>
      </div>
    );
  }

  return <>{children}</>;
}
