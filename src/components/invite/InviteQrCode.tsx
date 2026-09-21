"use client";

import { useQrDataUrl } from "@/lib/qrCode";

/**
 * Renders a QR code for `value` (an invite URL) as a real `<img>` once
 * generated. Used both by the public invite page (desktop-to-phone scan,
 * WEB-INV-1 BUILD item 1) and the organiser panel's per-link QR/download
 * action (BUILD item 2) — each mounts its own instance of this component,
 * which independently calls `useQrDataUrl` rather than sharing one
 * generation call across the two surfaces (they're genuinely separate UI,
 * may or may not both be on screen at once).
 */
export function InviteQrCode({
  value,
  size = 160,
  label,
}: {
  value: string;
  size?: number;
  label: string;
}) {
  const state = useQrDataUrl(value, size * 2);

  if (state.status === "error") {
    return (
      <div
        role="note"
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-xl border border-dashed border-border bg-muted text-center text-xs text-muted-foreground"
      >
        Couldn&apos;t generate a QR code — use the link instead.
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div
        style={{ width: size, height: size }}
        className="animate-pulse rounded-xl bg-muted"
        aria-hidden="true"
      />
    );
  }

  return (
    // A base64 data URL generated client-side has no source next/image can optimise.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={state.dataUrl}
      alt={label}
      width={size}
      height={size}
      className="rounded-xl border border-border"
    />
  );
}
