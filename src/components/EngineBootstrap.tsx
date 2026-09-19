"use client";

import { useEffect } from "react";
import { wireEnsureAccountOnSignIn } from "@/lib/ensureAccount";

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
    const unsubscribe = wireEnsureAccountOnSignIn();
    return unsubscribe;
  }, []);

  return null;
}
