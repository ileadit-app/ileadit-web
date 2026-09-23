import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * PORTAL-EMU-1: pins two things about `getFunctionsClient()`'s wiring —
 * (1) it hands the new Functions instance to `connectFunctionsEmulatorOnce`
 * exactly once across repeat calls, same singleton-cache discipline as
 * `firebase.test.ts`'s auth/db/storage getters; (2) App Check
 * (`getAppCheckClient`) is called when the emulator switch is off (existing
 * behaviour, unchanged) and SKIPPED entirely when the switch is on — no
 * emulator equivalent exists, and the real module would otherwise try to
 * initialise reCAPTCHA against a test build.
 */

const mockFunctionsInstance = { kind: "functions" };
vi.mock("firebase/functions", () => ({
  getFunctions: vi.fn(() => mockFunctionsInstance),
}));

vi.mock("./firebase", () => ({
  getFirebaseApp: () => ({ name: "[DEFAULT]" }),
}));

const mockGetAppCheckClient = vi.fn();
vi.mock("./appCheck", () => ({
  getAppCheckClient: (...args: unknown[]) => mockGetAppCheckClient(...args),
}));

const mockConnectFunctionsEmulatorOnce = vi.fn();
const mockIsEmulatorModeEnabled = vi.fn();
vi.mock("./firebaseEmulators", () => ({
  connectFunctionsEmulatorOnce: (...args: unknown[]) => mockConnectFunctionsEmulatorOnce(...args),
  isEmulatorModeEnabled: () => mockIsEmulatorModeEnabled(),
}));

beforeEach(() => {
  vi.resetModules();
  mockGetAppCheckClient.mockReset();
  mockConnectFunctionsEmulatorOnce.mockReset();
  mockIsEmulatorModeEnabled.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getFunctionsClient — switch off", () => {
  it("MUT-EMU-15: App Check is initialised, and connectFunctionsEmulatorOnce is still called (as a no-op internally) once", async () => {
    mockIsEmulatorModeEnabled.mockReturnValue(false);
    const { getFunctionsClient } = await import("./functions");

    getFunctionsClient();
    getFunctionsClient();

    expect(mockGetAppCheckClient).toHaveBeenCalledTimes(1);
    expect(mockConnectFunctionsEmulatorOnce).toHaveBeenCalledTimes(1);
    expect(mockConnectFunctionsEmulatorOnce).toHaveBeenCalledWith(mockFunctionsInstance);
  });
});

describe("getFunctionsClient — switch on", () => {
  it("MUT-EMU-16: App Check is skipped entirely, connectFunctionsEmulatorOnce called once with the new instance", async () => {
    mockIsEmulatorModeEnabled.mockReturnValue(true);
    const { getFunctionsClient } = await import("./functions");

    getFunctionsClient();
    getFunctionsClient();

    expect(mockGetAppCheckClient).not.toHaveBeenCalled();
    expect(mockConnectFunctionsEmulatorOnce).toHaveBeenCalledTimes(1);
    expect(mockConnectFunctionsEmulatorOnce).toHaveBeenCalledWith(mockFunctionsInstance);
  });
});
