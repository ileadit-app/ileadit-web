import { AlertTriangle } from "lucide-react";
import { isEmulatorModeEnabled } from "@/lib/firebaseEmulators";

/**
 * PORTAL-EMU-1 (test-only, approved 23 Sep 2026) — a small, persistent
 * banner rendered at the very top of every page ONLY when
 * `NEXT_PUBLIC_USE_FIREBASE_EMULATORS==="true"`. Exists so a build pointed
 * at Firebase emulators can never be mistaken for a real production build
 * (by Paul, by a tester, or by anyone taking a screenshot) — the switch and
 * this banner are deliberately coupled 1:1, with no separate flag to
 * remember to flip.
 *
 * Plain server component (no "use client") — `process.env.NEXT_PUBLIC_*`
 * reads are inlined at build time by Next.js either way, so no client-side
 * state or interactivity is needed here.
 */
export default function EmulatorBanner() {
  if (!isEmulatorModeEnabled()) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-brand-coral px-4 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-white"
    >
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
      Test environment — Firebase emulators
    </div>
  );
}
