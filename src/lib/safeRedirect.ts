/**
 * Validates the `?redirect=` query param that `ProtectedRoute`
 * (`src/components/auth/ProtectedRoute.tsx`) attaches to `/login` before
 * bouncing a signed-out visitor there (`/login?redirect=${encodeURIComponent(pathname)}`)
 * — and that `/login`/`/signup` themselves must round-trip back to on a
 * successful sign-in, per the sign-in design spec §2.
 *
 * `pathname` from `usePathname()` is always same-origin by construction, but
 * this value arrives back here as a plain, attacker-controllable query
 * string param by the time we read it — anyone can visit
 * `/login?redirect=https://evil.example` directly. Never hand a raw
 * `redirect` value to `router.replace()`/`router.push()` without running it
 * through this first: that is exactly the open-redirect shape used to turn a
 * trusted login page into a phishing bounce.
 */
export const DEFAULT_REDIRECT = "/dashboard";

/**
 * Returns a same-origin, path-rooted redirect target, or `DEFAULT_REDIRECT`
 * when the input is missing, malformed, or points off-origin.
 *
 * `origin` is passed in (rather than read from `window.location` internally)
 * so this stays a pure function callable from anywhere, including a future
 * unit test — callers in the browser pass `window.location.origin`.
 */
export function resolveSafeRedirect(rawValue: string | null | undefined, origin: string): string {
  if (!rawValue) return DEFAULT_REDIRECT;

  // Reject outright before ever parsing: a value that doesn't start with a
  // single "/" is either a protocol-relative URL ("//evil.com" — the browser
  // treats that as same-scheme-different-host) or an absolute URL
  // ("https://evil.com"). Both are exactly the two shapes `ProtectedRoute`
  // itself never produces (it always sends a same-origin `pathname`), so
  // rejecting them costs nothing on the legitimate path.
  if (!rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return DEFAULT_REDIRECT;
  }

  try {
    const parsed = new URL(rawValue, origin);
    if (parsed.origin !== origin) {
      return DEFAULT_REDIRECT;
    }
    const target = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return target || DEFAULT_REDIRECT;
  } catch {
    return DEFAULT_REDIRECT;
  }
}
