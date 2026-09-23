import { connectAuthEmulator, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, type Firestore } from "firebase/firestore";
import { connectFunctionsEmulator, type Functions } from "firebase/functions";
import { connectStorageEmulator, type FirebaseStorage } from "firebase/storage";

/**
 * PORTAL-EMU-1 (approved 23 Sep 2026, test-only) — the ONE switch that
 * routes every Firebase client (Auth, Firestore, Functions, Storage) at
 * emulators instead of the real `ileadit-app` project, for Paul's private-
 * competitions acceptance test. Default (unset, or anything other than the
 * literal string `"true"`) is byte-identical production behaviour: this
 * module's connect functions become no-ops and nothing else in
 * `firebase.ts`/`functions.ts` changes shape. Never flip this default —
 * an accidental `true` in a real deploy would silently point production
 * traffic at a non-existent local emulator.
 */
export function isEmulatorModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
}

const DEFAULT_PORTS = {
  auth: 29099,
  firestore: 28085,
  functions: 25001,
  storage: 29199,
} as const;

function getEmulatorHost(): string {
  // No stated default in the ticket beyond "host env var" — falls back to
  // the standard local-emulator loopback address only so a misconfigured
  // (unset) switch fails obviously (connection refused) rather than
  // silently, since NEXT_PUBLIC_FIREBASE_EMULATOR_HOST is expected to
  // always be set explicitly whenever the switch itself is "true".
  return process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || "127.0.0.1";
}

function getPort(rawValue: string | undefined, fallback: number): number {
  const parsed = rawValue ? Number(rawValue) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Double-connect guard, keyed on `globalThis` rather than a plain
 * module-level `let` (unlike e.g. `ensureAccount.ts`'s `wired` flag).
 * This is deliberate: Next.js Fast Refresh can re-evaluate this module
 * (resetting any module-level state) while the underlying Firebase SDK
 * singletons it touches — the `Auth`/`Firestore`/`Functions`/`Storage`
 * instances registered against the shared `FirebaseApp` in `firebase.ts`
 * — persist across that re-evaluation. A module-level flag would then
 * let a post-HMR re-render call `connectAuthEmulator` a second time on
 * the SAME underlying instance, which throws
 * ("Auth/Firestore/... has already been started, and connecting to the
 * emulator after has no effect"). `globalThis` survives module
 * re-evaluation, so the guard survives exactly as long as the instances
 * it's guarding do.
 */
type ConnectionFlags = {
  auth: boolean;
  firestore: boolean;
  functions: boolean;
  storage: boolean;
};

const GLOBAL_KEY = "__ileaditEmulatorConnections__";

function getFlags(): ConnectionFlags {
  const globalScope = globalThis as unknown as Record<string, ConnectionFlags | undefined>;
  if (!globalScope[GLOBAL_KEY]) {
    globalScope[GLOBAL_KEY] = { auth: false, firestore: false, functions: false, storage: false };
  }
  return globalScope[GLOBAL_KEY]!;
}

/**
 * Test-only: clears the double-connect guard so each test file gets a
 * clean slate. Never called from application code.
 */
export function resetEmulatorConnectionsForTest(): void {
  const globalScope = globalThis as unknown as Record<string, ConnectionFlags | undefined>;
  delete globalScope[GLOBAL_KEY];
}

export function connectAuthEmulatorOnce(auth: Auth): void {
  if (!isEmulatorModeEnabled()) return;
  const flags = getFlags();
  if (flags.auth) return;
  flags.auth = true;

  const host = getEmulatorHost();
  const port = getPort(process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_AUTH_PORT, DEFAULT_PORTS.auth);
  connectAuthEmulator(auth, `http://${host}:${port}`, { disableWarnings: false });
}

export function connectFirestoreEmulatorOnce(db: Firestore): void {
  if (!isEmulatorModeEnabled()) return;
  const flags = getFlags();
  if (flags.firestore) return;
  flags.firestore = true;

  const host = getEmulatorHost();
  const port = getPort(
    process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_FIRESTORE_PORT,
    DEFAULT_PORTS.firestore,
  );
  connectFirestoreEmulator(db, host, port);
}

export function connectFunctionsEmulatorOnce(functionsClient: Functions): void {
  if (!isEmulatorModeEnabled()) return;
  const flags = getFlags();
  if (flags.functions) return;
  flags.functions = true;

  const host = getEmulatorHost();
  const port = getPort(
    process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_FUNCTIONS_PORT,
    DEFAULT_PORTS.functions,
  );
  connectFunctionsEmulator(functionsClient, host, port);
}

export function connectStorageEmulatorOnce(storage: FirebaseStorage): void {
  if (!isEmulatorModeEnabled()) return;
  const flags = getFlags();
  if (flags.storage) return;
  flags.storage = true;

  const host = getEmulatorHost();
  const port = getPort(
    process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_STORAGE_PORT,
    DEFAULT_PORTS.storage,
  );
  connectStorageEmulator(storage, host, port);
}
