"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import {
  ensureAccount,
  wireEnsureAccountOnSignIn,
  type EnsureAccountOutcome,
} from "@/lib/ensureAccount";
import { toEngineFailure, type EngineFailure } from "@/lib/engineErrors";
import { ensureAccountRetryMessage } from "@/lib/authCopy";
import { missingFirebaseConfigKeys } from "@/lib/firebase";

type SetupState = { kind: "ok" } | { kind: "failed"; failure: EngineFailure | null };

/**
 * Wires `ensureAccount` (W-3) to the Firebase Auth listener so it fires
 * whenever sign-in lands, on any page - there is no dedicated "just
 * finished signing in" screen that owns this for a RETURNING visitor (only
 * `AuthCard.tsx`'s interactive flow does, for a fresh sign-in), so this
 * root-level mount is the only place that can make that guarantee for
 * everyone. See src/lib/ensureAccount.ts for why this matters (a web-only
 * sign-up otherwise never gets a `private/game` document, and every other
 * callable fails).
 *
 * W2-SURFACE (2026-09-20): a failed `ensureAccount` call used to reach only
 * `console.error` here - invisible to anyone not watching devtools, on
 * EVERY page, for EVERY signed-in visitor. Since `ensureAccount` is what
 * provisions `users/{uid}/private/game` (coins, welcome grant, the
 * precondition every other callable needs), a silent failure meant the site
 * looked completely normal while quietly not working for that visitor. This
 * component now renders a small, non-blocking banner instead of nothing -
 * deliberately NOT a modal (ensureAccount is idempotent and safe to retry;
 * an alarming interrupt on every page load for a background provisioning
 * step would be the wrong tone) and deliberately rendering nothing at all
 * in the overwhelmingly common case (engine deployed, call succeeds).
 */
export default function EngineBootstrap() {
  const [setup, setSetup] = useState<SetupState>({ kind: "ok" });
  const [retrying, setRetrying] = useState(false);

  const handleOutcome = useCallback((outcome: EnsureAccountOutcome) => {
    setSetup(
      outcome.status === "success" ? { kind: "ok" } : { kind: "failed", failure: outcome.failure },
    );
  }, []);

  useEffect(() => {
    // Without this guard a missing `.env.local` takes the WHOLE SITE down:
    // `wireEnsureAccountOnSignIn` calls `getFirebaseAuth()` synchronously,
    // that throws `auth/invalid-api-key` on an undefined key, and because
    // this component mounts from the root layout the error surfaces on
    // every route - including the purely static landing page, which needs
    // no auth at all.
    //
    // This is NOT a silent degrade from the user's point of view: nobody
    // can be signed in when Firebase config is entirely absent
    // (AuthContext resolves straight to "signed-out" for the same reason -
    // see AuthContext.tsx), so there is no visitor this banner would ever
    // need to reach for THIS specific case. It stays a console-only,
    // developer-facing message, same shape as src/lib/appCheck.ts's
    // missing-site-key error.
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

    const unsubscribe = wireEnsureAccountOnSignIn(handleOutcome);
    return unsubscribe;
  }, [handleOutcome]);

  async function handleRetry() {
    // ensureAccount is idempotent by construction (see ensureAccount.ts) -
    // safe to fire again from a manual click with no extra guard needed.
    setRetrying(true);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await ensureAccount(timeZone);
      setSetup({ kind: "ok" });
    } catch (error) {
      setSetup({ kind: "failed", failure: toEngineFailure(error) });
    } finally {
      setRetrying(false);
    }
  }

  if (setup.kind === "ok") return null;

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive sm:flex-row sm:gap-3"
    >
      <span className="flex items-center gap-2 text-center sm:text-left">
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        {ensureAccountRetryMessage(setup.failure)}
      </span>
      <button
        type="button"
        onClick={() => void handleRetry()}
        disabled={retrying}
        className="shrink-0 font-semibold underline-offset-2 hover:underline disabled:opacity-60"
      >
        {retrying ? "Retrying…" : "Try again"}
      </button>
    </div>
  );
}
