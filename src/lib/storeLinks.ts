/**
 * The ONE place the app store listing URLs live (WEB-SHOP-LINK).
 *
 * Both are `null` until the listings are public. Paul sets them as plain
 * strings in a normal commit + deploy when each listing goes live; nothing
 * else in the codebase names a store URL.
 *
 * Rule for every surface (`/download`, the invite page's "Get the app"
 * block, the homepage download section): a `null` URL means NO button for
 * that store. Never a dead link, never a "placeholder" label on a public
 * page. The shared rendering lives in `StoreButtons.tsx`; the shared words
 * live in `storeAvailabilityCopy` below.
 */
export const PLAY_STORE_URL: string | null = null; // e.g. "https://play.google.com/store/apps/details?id=..."
export const APP_STORE_URL: string | null = null; // e.g. "https://apps.apple.com/app/id..."

/**
 * One sentence about where the app can be had, derived from which URLs are
 * set. Takes the URLs as arguments (rather than reading the constants) so it
 * is a pure function and the callers pass the live constants in.
 *
 * - neither set: early-access wording, no store named as available
 * - exactly one set: names only that store (never hints at the other)
 * - both set: names both
 */
export function storeAvailabilityCopy(
  playUrl: string | null,
  appUrl: string | null,
): string {
  if (playUrl && appUrl) return "Get ileadit on Google Play or the App Store.";
  if (playUrl) return "Get ileadit on Google Play.";
  if (appUrl) return "Get ileadit on the App Store.";
  return "ileadit is in early access on Android and iPhone. Store links are coming soon.";
}
