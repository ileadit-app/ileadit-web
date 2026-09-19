import { getFunctions, type Functions } from "firebase/functions";
import { getFirebaseApp } from "./firebase";
import { getAppCheckClient } from "./appCheck";

/**
 * THE web portal's ONLY Cloud Functions client, and the ONLY file in this
 * repo allowed to name the engine's region. This mirrors the exact rule the
 * Android client's C1a ticket was held to
 * (`FirebaseFunctions.getInstance("europe-west2")`, one call site) —
 * `docs/engine-cutover-checklist.md` in the ileadit engine repo confirms the
 * deployed engine (`functions/src`, entry point `lib/index.js`) runs
 * entirely in europe-west2, including every callable this repo will ever
 * call. If the engine ever adds a function in a different region, this is
 * the one place that needs to change - grep for "europe-west2" across
 * `src/` must return exactly this file, always.
 *
 * Every callable invocation in this repo MUST go through
 * `getFunctionsClient()`. Do not call `getFunctions(app, "europe-west2")`
 * anywhere else, even for a "quick" one-off callable.
 */
const REGION = "europe-west2";

let functionsInstance: Functions | null = null;

export function getFunctionsClient(): Functions {
  if (!functionsInstance) {
    // Touch App Check before the first callable is ever made from this
    // client, so the App Check token header is attached from the very
    // first call once a site key is configured (src/lib/appCheck.ts). A
    // missing site key degrades to "no App Check token" rather than a
    // crash - safe today because the engine's first deploy is unenforced
    // (see appCheck.ts for the enforcement-day consequences of skipping
    // this setup).
    getAppCheckClient();
    functionsInstance = getFunctions(getFirebaseApp(), REGION);
  }
  return functionsInstance;
}
