import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * PORTAL-EMU-1: pins the emulator switch's two hard requirements —
 * (1) switch off (unset, or anything other than the literal string
 * "true") means byte-identical production behaviour, i.e. NONE of the
 * four `connect*Emulator` SDK functions are ever called; (2) switch on
 * means each is called exactly once, with the documented host/port
 * (default or overridden), even across repeated getter calls (the
 * double-connect guard).
 *
 * Mocks at the real SDK boundary (`firebase/auth`, `firebase/firestore`,
 * `firebase/functions`, `firebase/storage`) — these are the actual
 * `connect*Emulator` functions this module wraps; nothing about
 * `firebaseEmulators.ts`'s own logic (env reads, host/port resolution,
 * the guard) is mocked.
 */

const mockConnectAuthEmulator = vi.fn();
const mockConnectFirestoreEmulator = vi.fn();
const mockConnectFunctionsEmulator = vi.fn();
const mockConnectStorageEmulator = vi.fn();

vi.mock("firebase/auth", () => ({
  connectAuthEmulator: (...args: unknown[]) => mockConnectAuthEmulator(...args),
}));
vi.mock("firebase/firestore", () => ({
  connectFirestoreEmulator: (...args: unknown[]) => mockConnectFirestoreEmulator(...args),
}));
vi.mock("firebase/functions", () => ({
  connectFunctionsEmulator: (...args: unknown[]) => mockConnectFunctionsEmulator(...args),
}));
vi.mock("firebase/storage", () => ({
  connectStorageEmulator: (...args: unknown[]) => mockConnectStorageEmulator(...args),
}));

const ENV_KEYS = [
  "NEXT_PUBLIC_USE_FIREBASE_EMULATORS",
  "NEXT_PUBLIC_FIREBASE_EMULATOR_HOST",
  "NEXT_PUBLIC_FIREBASE_EMULATOR_AUTH_PORT",
  "NEXT_PUBLIC_FIREBASE_EMULATOR_FIRESTORE_PORT",
  "NEXT_PUBLIC_FIREBASE_EMULATOR_FUNCTIONS_PORT",
  "NEXT_PUBLIC_FIREBASE_EMULATOR_STORAGE_PORT",
] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
  mockConnectAuthEmulator.mockReset();
  mockConnectFirestoreEmulator.mockReset();
  mockConnectFunctionsEmulator.mockReset();
  mockConnectStorageEmulator.mockReset();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe("isEmulatorModeEnabled", () => {
  it("MUT-EMU-1: is false when the env var is unset", async () => {
    const { isEmulatorModeEnabled } = await import("./firebaseEmulators");
    expect(isEmulatorModeEnabled()).toBe(false);
  });

  it("MUT-EMU-2: is false for any value other than the literal string 'true'", async () => {
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = "TRUE";
    const { isEmulatorModeEnabled } = await import("./firebaseEmulators");
    expect(isEmulatorModeEnabled()).toBe(false);
  });

  it("MUT-EMU-3: is true only for the literal string 'true'", async () => {
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = "true";
    const { isEmulatorModeEnabled } = await import("./firebaseEmulators");
    expect(isEmulatorModeEnabled()).toBe(true);
  });
});

describe("switch OFF — production behaviour is byte-identical", () => {
  it("MUT-EMU-4: none of the four connect*Emulator calls ever fire", async () => {
    const {
      connectAuthEmulatorOnce,
      connectFirestoreEmulatorOnce,
      connectFunctionsEmulatorOnce,
      connectStorageEmulatorOnce,
      resetEmulatorConnectionsForTest,
    } = await import("./firebaseEmulators");
    resetEmulatorConnectionsForTest();

    connectAuthEmulatorOnce({} as never);
    connectFirestoreEmulatorOnce({} as never);
    connectFunctionsEmulatorOnce({} as never);
    connectStorageEmulatorOnce({} as never);

    expect(mockConnectAuthEmulator).not.toHaveBeenCalled();
    expect(mockConnectFirestoreEmulator).not.toHaveBeenCalled();
    expect(mockConnectFunctionsEmulator).not.toHaveBeenCalled();
    expect(mockConnectStorageEmulator).not.toHaveBeenCalled();
  });
});

describe("switch ON — each connect*Emulator called exactly once, with correct host/port", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = "true";
    process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST = "100.99.106.47";
  });

  it("MUT-EMU-5: connectAuthEmulator called once with default port 29099", async () => {
    const { connectAuthEmulatorOnce, resetEmulatorConnectionsForTest } = await import(
      "./firebaseEmulators"
    );
    resetEmulatorConnectionsForTest();
    const auth = {} as never;

    connectAuthEmulatorOnce(auth);
    connectAuthEmulatorOnce(auth); // second call — must be a no-op

    expect(mockConnectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(mockConnectAuthEmulator).toHaveBeenCalledWith(
      auth,
      "http://100.99.106.47:29099",
      { disableWarnings: false },
    );
  });

  it("MUT-EMU-6: connectFirestoreEmulator called once with default port 28085", async () => {
    const { connectFirestoreEmulatorOnce, resetEmulatorConnectionsForTest } = await import(
      "./firebaseEmulators"
    );
    resetEmulatorConnectionsForTest();
    const db = {} as never;

    connectFirestoreEmulatorOnce(db);
    connectFirestoreEmulatorOnce(db);

    expect(mockConnectFirestoreEmulator).toHaveBeenCalledTimes(1);
    expect(mockConnectFirestoreEmulator).toHaveBeenCalledWith(db, "100.99.106.47", 28085);
  });

  it("MUT-EMU-7: connectFunctionsEmulator called once with default port 25001", async () => {
    const { connectFunctionsEmulatorOnce, resetEmulatorConnectionsForTest } = await import(
      "./firebaseEmulators"
    );
    resetEmulatorConnectionsForTest();
    const functionsClient = {} as never;

    connectFunctionsEmulatorOnce(functionsClient);
    connectFunctionsEmulatorOnce(functionsClient);

    expect(mockConnectFunctionsEmulator).toHaveBeenCalledTimes(1);
    expect(mockConnectFunctionsEmulator).toHaveBeenCalledWith(
      functionsClient,
      "100.99.106.47",
      25001,
    );
  });

  it("MUT-EMU-8: connectStorageEmulator called once with default port 29199", async () => {
    const { connectStorageEmulatorOnce, resetEmulatorConnectionsForTest } = await import(
      "./firebaseEmulators"
    );
    resetEmulatorConnectionsForTest();
    const storage = {} as never;

    connectStorageEmulatorOnce(storage);
    connectStorageEmulatorOnce(storage);

    expect(mockConnectStorageEmulator).toHaveBeenCalledTimes(1);
    expect(mockConnectStorageEmulator).toHaveBeenCalledWith(storage, "100.99.106.47", 29199);
  });

  it("MUT-EMU-9: port env var overrides are honoured", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_AUTH_PORT = "9099";
    const { connectAuthEmulatorOnce, resetEmulatorConnectionsForTest } = await import(
      "./firebaseEmulators"
    );
    resetEmulatorConnectionsForTest();

    connectAuthEmulatorOnce({} as never);

    expect(mockConnectAuthEmulator).toHaveBeenCalledWith(
      {},
      "http://100.99.106.47:9099",
      { disableWarnings: false },
    );
  });
});
