import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getFirebaseAuth } from "./firebase";
import { getFunctionsClient } from "./functions";
import { toEngineFailure, type EngineFailure } from "./engineErrors";

/**
 * Mirrors EnsureAccountResult in functions/src/services/accounts.ts
 * (ileadit engine repo, c91f9e3).
 */
export interface EnsureAccountResult {
  /** true when this call created the account documents (first-ever call). */
  created: boolean;
  /** true when this call granted the welcome coins. */
  granted: boolean;
  /** private/game.coins after the call. */
  coins: number;
}

/**
 * Calls the `ensureAccount` callable directly.
 *
 * Idempotent by construction on the engine side
 * (`functions/src/services/accounts.ts` `ensureAccountService`, c91f9e3):
 * the whole operation runs in one Firestore transaction keyed off whether
 * `users/{uid}/private/game` already exists and whether the welcome grant
 * document already exists. A second call with an existing, already-granted
 * account reads two documents, writes nothing, and returns
 * `{ created: false, granted: false, coins: <unchanged> }`. That is what
 * makes it safe to call on every sign-in / every app open rather than only
 * once at registration.
 *
 * There is no sign-in UI in this repo yet, so nothing calls this except
 * `wireEnsureAccountOnSignIn` below - it is also exported directly for
 * whichever page adds sign-in next, and for a manual "retry" action after a
 * `missing-game-state` failure surfaces from another callable.
 */
export async function ensureAccount(timeZone: string): Promise<EnsureAccountResult> {
  const callable = httpsCallable<{ timeZone: string }, EnsureAccountResult>(
    getFunctionsClient(),
    "ensureAccount",
  );
  const result = await callable({ timeZone });
  return result.data;
}

let wired = false;

/**
 * Outcome of one `wireEnsureAccountOnSignIn`-triggered call, handed to the
 * caller's `onOutcome` callback (W2-SURFACE). Never a boolean, same
 * discriminated-union discipline as `AuthOutcome`/`EngineFailure` elsewhere
 * in this repo - `failure` is `EngineFailure | null` rather than always
 * `EngineFailure` because `toEngineFailure` itself can legitimately return
 * `null` for a real error this module doesn't have a specific mapping for
 * (e.g. the engine simply isn't deployed - see this file's header comment
 * history / ticket W2-SURFACE). `null` must still be treated as a real
 * failure by the caller, never as "no error".
 */
export type EnsureAccountOutcome =
  | { status: "success"; result: EnsureAccountResult }
  | { status: "failure"; failure: EngineFailure | null };

/**
 * Wires `ensureAccount` to fire on every auth-state change that lands a
 * signed-in user - not just "on sign-up" - because there is no sign-in UI
 * in this repo yet (W-3) and the callable is cheap/idempotent (see above).
 * This is the web equivalent of the mobile clients' "call ensureAccount
 * after every sign-in" requirement
 * (docs/engine-cutover-checklist.md, "Client changes required", ileadit
 * engine repo c91f9e3): without it, a web-only sign-up never gets a
 * `users/{uid}/private/game` document, and every other callable then fails
 * with `missing-game-state` (see engineErrors.ts) forever, because nothing
 * else in this repo creates that document.
 *
 * `onOutcome` (W2-SURFACE, optional so this stays a drop-in for any caller
 * that only wants the pre-existing console logging) is invoked with the
 * SAME outcome on every call, success or failure - `console.error` alone is
 * no longer the end of the line for a failure. `EngineBootstrap.tsx` uses
 * this to render a visible, retryable banner instead of a swallow nobody
 * but a browser-devtools user would ever see. Console logging is kept
 * unconditionally alongside the callback, not replaced by it - it remains
 * the only trace once a tab is closed / before React has mounted.
 *
 * Returns an unsubscribe function - call it on unmount. Safe to call this
 * function itself more than once (e.g. React Strict Mode's double-invoke in
 * dev): only the first call registers a listener, later calls return a
 * no-op unsubscribe (and never invoke the second call's own `onOutcome`,
 * since no listener was actually registered for it).
 */
export function wireEnsureAccountOnSignIn(
  onOutcome?: (outcome: EnsureAccountOutcome) => void,
): () => void {
  if (wired) {
    return () => {};
  }
  wired = true;

  return onAuthStateChanged(getFirebaseAuth(), (user: User | null) => {
    if (!user) return;

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    void ensureAccount(timeZone)
      .then((result) => {
        if (result.created || result.granted) {
          // Deliberate: this repo has no error-reporting surface yet, and
          // this is the one event worth knowing about (a brand-new
          // web-only account, or a delayed welcome-coin grant).
          console.info("[ensureAccount] account state changed", result);
        }
        onOutcome?.({ status: "success", result });
      })
      .catch((error: unknown) => {
        // NEVER swallow this. If ensureAccount fails, every other callable
        // will fail downstream with missing-game-state and nothing will
        // explain why unless this is logged loudly right here - AND (as of
        // W2-SURFACE) handed to onOutcome so a UI can tell the actual user,
        // not just whoever happens to have devtools open.
        const failure = toEngineFailure(error);
        console.error(
          "[ensureAccount] failed - the account may not be fully provisioned",
          failure ?? error,
        );
        onOutcome?.({ status: "failure", failure });
      });
  });
}
