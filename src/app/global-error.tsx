"use client";

import { useEffect } from "react";

/**
 * Replaces the ENTIRE root layout (`src/app/layout.tsx`) when that layout
 * itself throws during render — the one case `error.tsx` can't catch,
 * because `error.tsx` is rendered INSIDE the layout and can't help if the
 * layout is what's broken (e.g. `AuthProvider` throwing during its own
 * render, not inside a page it wraps).
 *
 * Per Next.js's contract for this specific file, it must define its own
 * `<html>` and `<body>` — it IS the document root while active, not a
 * child of one. That also means it cannot rely on anything the layout
 * would normally provide: no `AuthProvider`, no `Header`/`Footer`, no
 * `next/font` (`layout.tsx`'s Plus Jakarta Sans/Fraunces loaders live in
 * the component that just failed), and no shared components from
 * `src/components` — none of those are guaranteed safe to import here,
 * because whatever caused the layout itself to throw might be something
 * they also depend on. Plain inline styles only, deliberately, so nothing
 * in THIS file has any meaningful chance of throwing on its own. A real
 * `<a href="/">` is used instead of `next/link` for the same reason —
 * a full browser navigation degrades more gracefully than a client-side
 * route change would if the router's own state is what's unhappy.
 *
 * This is the most severe, least-likely path in this ticket — expect it to
 * fire close to never in practice — which is exactly why it stays this
 * plain rather than trying to be clever.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Same rule as `error.tsx`: never swallow this. If the root layout is
    // throwing, that's the most severe failure this site can have — it
    // must still reach the console (or a future reporting hook) even
    // though the entire normal page chrome is gone.
    console.error("[global-error boundary] the root layout failed to render", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          margin: 0,
          padding: "24px",
          textAlign: "center",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          backgroundColor: "#fafbfb",
          color: "#12172a",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>
          ileadit isn&apos;t loading right now
        </h1>
        <p style={{ maxWidth: "28rem", color: "#44566c", margin: 0 }}>
          Something went wrong before the page could even start. It&apos;s not something you
          did — reloading usually fixes this.
        </p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- deliberate:
            this file replaces the whole document when the root layout itself
            throws, so it avoids `next/link` on purpose (see header comment) and
            uses a real browser navigation instead. */}
        <a
          href="/"
          style={{
            marginTop: "8px",
            display: "inline-flex",
            height: "48px",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "9999px",
            backgroundColor: "#f8a92f",
            color: "#192f5f",
            fontWeight: 700,
            padding: "0 24px",
            textDecoration: "none",
          }}
        >
          Reload ileadit
        </a>
      </body>
    </html>
  );
}
