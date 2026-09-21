"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Client-side QR code generation for invite links (WEB-INV-1). `qrcode`
 * (npm, MIT) is the one new runtime dependency this ticket adds — chosen
 * because it renders a PNG data URL directly in the browser via
 * `<canvas>`, no server round trip needed, and has zero further
 * dependencies of its own.
 *
 * `qrcode`'s browser build needs a real 2D canvas — jsdom (this repo's
 * Vitest environment) has no such implementation, so any test exercising a
 * component that calls this hook must mock the `"qrcode"` module itself at
 * the boundary (same two-mock-boundary discipline already used for
 * callable wrappers, e.g. `ensureAccount.test.ts` mocking
 * `"firebase/functions"`) — never rely on it actually rendering under
 * Vitest.
 */
export type QrDataUrlState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; dataUrl: string };

export function useQrDataUrl(value: string | null, width = 240): QrDataUrlState {
  const [state, setState] = useState<QrDataUrlState>({ status: "loading" });

  useEffect(() => {
    if (!value) {
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(value, { width, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setState({ status: "success", dataUrl });
      })
      .catch((error: unknown) => {
        console.error("[useQrDataUrl] QR generation failed", error);
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [value, width]);

  return state;
}
