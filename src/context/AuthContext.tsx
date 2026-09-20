"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getFirebaseAuth, missingFirebaseConfigKeys } from "@/lib/firebase";
import { signOutUser } from "@/lib/auth";

/**
 * `"loading"` until the very first `onAuthStateChanged` callback fires
 * (Firebase has not yet told us whether a persisted session exists), then
 * `"signed-in"` or `"signed-out"` for the rest of the session.
 *
 * THIS is the field that prevents the classic "signed-out UI flash" bug
 * named in the P1.2 ticket: `user === null` is true BOTH while Firebase is
 * still resolving a persisted session AND once it has confirmed there is
 * none — a consumer that only checks `user` cannot tell those two states
 * apart and will render signed-out UI (or redirect) for one frame even for
 * an already-signed-in returning visitor. Gate on `status`, not `user`.
 */
export type AuthStatus = "loading" | "signed-in" | "signed-out";

export interface AuthContextValue {
  /** The current Firebase user, or null. Also null while `status ===
   * "loading"` — see `AuthStatus` above for why `status`, not this field,
   * is what a consumer should branch on. */
  user: User | null;
  status: AuthStatus;
  /** Signs the current user out. */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Lazy initializer (not a value computed in the effect below) so the
  // missing-config case resolves straight to "signed-out" on the FIRST
  // render, with no extra setState call inside the effect — React's
  // react-hooks/set-state-in-effect rule flags a synchronous setState in an
  // effect body as a cascading-render smell, and here it would also be
  // pointless: the config either is or isn't present before this component
  // ever mounts, so there is nothing to "wait and see" about.
  const [status, setStatus] = useState<AuthStatus>(() =>
    missingFirebaseConfigKeys().length > 0 ? "signed-out" : "loading",
  );

  useEffect(() => {
    // Same missing-config guard as EngineBootstrap
    // (src/components/EngineBootstrap.tsx): getFirebaseAuth() validates the
    // API key format synchronously and throws auth/invalid-api-key the
    // instant it's called with no .env.local present. Both this provider
    // and EngineBootstrap mount from the root layout, so an unguarded call
    // here would take down every route the same way an unguarded call
    // there would. The initial state above already resolved "signed-out"
    // for this case, so here we only need to log loudly and skip
    // registering a listener against an auth instance that would throw.
    const missing = missingFirebaseConfigKeys();
    if (missing.length > 0) {
      console.error(
        `[AuthProvider] Firebase is not configured - ${missing.join(", ")} ` +
          `${missing.length === 1 ? "is" : "are"} not set, so sign-in is disabled and ` +
          "auth state will stay signed-out for the whole session. Copy .env.example to " +
          ".env.local and fill in the values from the Firebase console.",
      );
      return;
    }

    // Deliberately a SEPARATE onAuthStateChanged listener from
    // wireEnsureAccountOnSignIn() in src/lib/ensureAccount.ts (mounted by
    // EngineBootstrap — see src/components/EngineBootstrap.tsx, which calls
    // it once via a module-level `wired` guard). Firebase Auth supports any
    // number of independent onAuthStateChanged subscribers; registering
    // this one does not re-trigger, duplicate, or race
    // wireEnsureAccountOnSignIn's listener or its ensureAccount() call —
    // each subscriber is invoked independently by the SDK on the same
    // underlying auth state change. This listener ONLY sets local React
    // state for the UI. It must never itself call ensureAccount() — that
    // call path belongs to EngineBootstrap alone. Do not "simplify" this by
    // merging the two listeners or by calling ensureAccount from here.
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (nextUser) => {
      setUser(nextUser);
      setStatus(nextUser ? "signed-in" : "signed-out");
    });

    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      signOut: signOutUser,
    }),
    [user, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * The one obvious entry point for reading auth state anywhere in the app
 * (Header, ProtectedRoute, future pages). Throws when called outside
 * `<AuthProvider>` — mounted once, at the root layout — rather than
 * silently returning a fake signed-out value, because a caller that thinks
 * it has real auth state but doesn't is a much worse bug than a loud crash
 * during development.
 */
export function useUser(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useUser() must be called within <AuthProvider>. Is the root layout missing it?");
  }
  return ctx;
}
