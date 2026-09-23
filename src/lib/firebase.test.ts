import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * PORTAL-EMU-1: pins the actual WIRING at the single Firebase client init
 * point (`getFirebaseAuth`/`getFirebaseDb`/`getFirebaseStorage`) — that
 * each getter hands its freshly-created instance to the matching
 * `connect*EmulatorOnce` helper exactly once, on the FIRST call, and not
 * again on a second call (the lazy-singleton `instance` cache is itself
 * the double-connect guard at this layer; `firebaseEmulators.test.ts`
 * separately pins the guard `firebaseEmulators.ts` uses internally for
 * repeat calls that bypass this module's own singleton, e.g. after HMR).
 *
 * Mocks the real Firebase SDK modules (`firebase/app`, `firebase/auth`,
 * `firebase/firestore`, `firebase/storage`) so no real Firebase call is
 * ever made, and mocks `./firebaseEmulators`'s `connect*Once` functions
 * directly rather than re-mocking the SDK's own `connect*Emulator`
 * functions a second time — that boundary is already covered by
 * `firebaseEmulators.test.ts`.
 */

const mockApp = { name: "[DEFAULT]" };
vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => mockApp),
  getApps: vi.fn(() => []),
}));

const mockAuthInstance = { kind: "auth" };
const mockDbInstance = { kind: "db" };
const mockStorageInstance = { kind: "storage" };
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => mockAuthInstance),
}));
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => mockDbInstance),
}));
vi.mock("firebase/storage", () => ({
  getStorage: vi.fn(() => mockStorageInstance),
}));

const mockConnectAuthEmulatorOnce = vi.fn();
const mockConnectFirestoreEmulatorOnce = vi.fn();
const mockConnectStorageEmulatorOnce = vi.fn();
vi.mock("./firebaseEmulators", () => ({
  connectAuthEmulatorOnce: (...args: unknown[]) => mockConnectAuthEmulatorOnce(...args),
  connectFirestoreEmulatorOnce: (...args: unknown[]) => mockConnectFirestoreEmulatorOnce(...args),
  connectStorageEmulatorOnce: (...args: unknown[]) => mockConnectStorageEmulatorOnce(...args),
}));

beforeEach(() => {
  vi.resetModules();
  mockConnectAuthEmulatorOnce.mockReset();
  mockConnectFirestoreEmulatorOnce.mockReset();
  mockConnectStorageEmulatorOnce.mockReset();
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-key";
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "test.firebaseapp.com";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "ileadit-app";
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "test-app-id";
});

describe("getFirebaseAuth — emulator wiring", () => {
  it("MUT-EMU-12: hands the new Auth instance to connectAuthEmulatorOnce exactly once across repeat calls", async () => {
    const { getFirebaseAuth } = await import("./firebase");

    getFirebaseAuth();
    getFirebaseAuth();

    expect(mockConnectAuthEmulatorOnce).toHaveBeenCalledTimes(1);
    expect(mockConnectAuthEmulatorOnce).toHaveBeenCalledWith(mockAuthInstance);
  });
});

describe("getFirebaseDb — emulator wiring", () => {
  it("MUT-EMU-13: hands the new Firestore instance to connectFirestoreEmulatorOnce exactly once across repeat calls", async () => {
    const { getFirebaseDb } = await import("./firebase");

    getFirebaseDb();
    getFirebaseDb();

    expect(mockConnectFirestoreEmulatorOnce).toHaveBeenCalledTimes(1);
    expect(mockConnectFirestoreEmulatorOnce).toHaveBeenCalledWith(mockDbInstance);
  });
});

describe("getFirebaseStorage — emulator wiring", () => {
  it("MUT-EMU-14: hands the new Storage instance to connectStorageEmulatorOnce exactly once across repeat calls", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "test-bucket";
    const { getFirebaseStorage } = await import("./firebase");

    getFirebaseStorage();
    getFirebaseStorage();

    expect(mockConnectStorageEmulatorOnce).toHaveBeenCalledTimes(1);
    expect(mockConnectStorageEmulatorOnce).toHaveBeenCalledWith(mockStorageInstance);
  });
});
