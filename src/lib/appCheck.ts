import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from "firebase/app-check";
import { getFirebaseApp } from "./firebase";

/**
 * App Check — the web equivalent of the Android client's Play Integrity
 * attestation (see docs/engine-cutover-checklist.md, Step 3, in the ileadit
 * engine repo). Every callable in `functions/src` is declared with
 * `enforceAppCheck: ENFORCE_APP_CHECK`, so once the engine flips that flag
 * to `true` any call from a client with no App Check token starts failing.
 *
 * IMPORTANT — the engine's first deploy runs with `ENFORCE_APP_CHECK=false`
 * (checklist Step 3: "the phone app has no App Check provider... enforcing
 * would reject every call from every shipped client"). That means a portal
 * that never wires this module up will keep working today and fail LOUDLY
 * only once Paul flips the flag later — silently, from this repo's point of
 * view, until that day. This module exists now, unforced, precisely so that
 * flip is a non-event instead of a production outage discovered the hard
 * way.
 *
 * ---
 * ONE-TIME LOCAL DEV SETUP (do this once per machine):
 *   1. Set `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` in `.env.local` to the reCAPTCHA
 *      v3 site key for the `ileadit-app` Firebase project's App Check
 *      registration (Firebase console → App Check → Web app → reCAPTCHA v3).
 *   2. For `next dev` (localhost, no real reCAPTCHA attestation available),
 *      also set `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=true` in
 *      `.env.local`. On first run the browser console prints a generated
 *      debug token ("App Check debug token: <uuid>. You will need to add it
 *      to your app's App Check settings in the Firebase console for it to
 *      work") — register that token once under Firebase console → App
 *      Check → Manage debug tokens. Until it is registered, every callable
 *      will be rejected the moment enforcement is turned on (App Check
 *      unenforced today means it is NOT rejected yet — see above).
 *   3. Never commit the debug token value itself; it is a per-machine
 *      secret and belongs in `.env.local` only (gitignored), never in
 *      `.env.example`.
 */
let appCheckInstance: AppCheck | null = null;

export function getAppCheckClient(): AppCheck | null {
  // App Check needs `window`/reCAPTCHA's script injection; it cannot run
  // during Next.js server-side rendering. Callers must tolerate `null`.
  if (typeof window === "undefined") return null;
  if (appCheckInstance) return appCheckInstance;

  const debugToken = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;
  if (debugToken) {
    // Must be assigned before initializeAppCheck() runs - the SDK reads this
    // global at init time to switch to the debug provider instead of real
    // reCAPTCHA attestation. Local/dev only - see setup notes above.
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      debugToken === "true" ? true : debugToken;
  }

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) {
    // Do not silently skip App Check - that is exactly the "works today,
    // fails the day enforcement flips" trap this module exists to avoid.
    // Fail loudly in the console so a developer notices before enforcement
    // day, not after.
    console.error(
      "[appCheck] NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set - App Check is NOT initialized. " +
        "Callables will still work today (the engine's first deploy is unenforced), but will " +
        "start failing the moment App Check enforcement is turned on. See src/lib/appCheck.ts.",
    );
    return null;
  }

  appCheckInstance = initializeAppCheck(getFirebaseApp(), {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  return appCheckInstance;
}
