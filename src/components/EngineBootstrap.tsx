"use client";

import { useEffect } from "react";
import { wireEnsureAccountOnSignIn } from "@/lib/ensureAccount";
import { missingFirebaseConfigKeys } from "@/lib/firebase";

/**
 * Renders nothing. Wires `ensureAccount` (W-3) to the Firebase Auth
 * listener so it fires whenever sign-in lands, on any page - there is no
 * sign-in UI in this repo yet, so this root-level mount is the only place
 * that can make that guarantee today. See src/lib/ensureAccount.ts for why
 * this matters (a web-only sign-up otherwise never gets a
 * `private/game` document, and every other callable fails).
 */
export default function EngineBootstrap() {
  useEffect(() => {
    // Without this guard a missing `.env.local` takes the WHOLE SITE down:
    // `wireEnsureAccountOnSignIn` calls `getFirebaseAuth()` synchronously,
    // that throws `auth/invalid-api-key` on an undefined key, and because
    // this component mounts from the root layout the error surfaces on
    // every route - including the purely static landing page, which needs
    // no auth at all.
    //
    // This is NOT a silent degrade. Nothing here substitutes a fake value
    // or pretends to be signed in; it refuses to wire auth and says
    // exactly which variable is absent, in the same shape as
    // src/lib/appCheck.ts's missing-site-key error.
    const missing = missingFirebaseConfigKeys();
    if (missing.length > 0) {
      console.error(
        `[EngineBootstrap] Firebase is not configured - ${missing.join(", ")} ` +
          `${missing.length === 1 ? "is" : "are"} not set, so sign-in and every engine ` +
          "callable are disabled. Copy .env.example to .env.local and fill in the values " +
          "from the Firebase console (ileadit-app project, Web app config). The rest of " +
          "the site renders normally.",
      );
      return;
    }

    const unsubscribe = wireEnsureAccountOnSignIn();
    return unsubscribe;
  }, []);

  return null;
}
