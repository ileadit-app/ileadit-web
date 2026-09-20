import type { ReactNode } from "react";

/**
 * Shared visual shell for the route-level "this didn't work" pages that
 * render INSIDE the normal layout — `src/app/error.tsx` and
 * `src/app/not-found.tsx` (W11-BOUNDARIES). Deliberately NOT used by
 * `src/app/global-error.tsx`, which replaces the root layout itself and
 * must stay fully self-contained (no Tailwind classes it can't be sure are
 * available, no imports from the tree the failed layout would have
 * provided) — see that file's own header comment.
 *
 * This mirrors `InviteLanding.tsx`'s private `InviteStatusCard` almost
 * exactly (icon + heading + body + CTA slot, `mx-auto max-w-lg` centred
 * column) rather than importing it: `InviteStatusCard` carries
 * invite-specific concerns (the `live`/`aria-live` announcement path for a
 * state reached by clicking "Join" on the SAME page) that don't apply to a
 * fresh page load, and reaching into a feature module (`components/invite`)
 * from a generic app-wide boundary would be the wrong dependency direction.
 * If a third near-identical shell shows up, that's the point to extract a
 * single shared one both modules import — not before (see the W10-STATECHIP
 * lesson on this in memory: don't generalise before a third real
 * occurrence forces the shape).
 */
export function BoundaryCard({
  icon,
  title,
  body,
  children,
  role,
  live,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children?: ReactNode;
  role?: "alert";
  live?: boolean;
}) {
  return (
    <div
      className="mx-auto max-w-lg px-5 py-20 text-center sm:px-6"
      role={role}
      aria-live={live ? "assertive" : undefined}
    >
      {icon}
      <h1 className="mt-4 text-2xl font-extrabold text-foreground">{title}</h1>
      <p className="mt-2 text-base text-muted-foreground">{body}</p>
      {children ? (
        <div className="mt-6 flex flex-col items-center gap-3">{children}</div>
      ) : null}
    </div>
  );
}

export const BOUNDARY_PRIMARY_CTA_CLASSES =
  "flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-brand-gold px-6 text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy";

export const BOUNDARY_SECONDARY_LINK_CLASSES =
  "text-sm font-semibold text-brand-navy underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy";
