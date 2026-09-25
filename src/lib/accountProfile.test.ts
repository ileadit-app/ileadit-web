import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { updatePrivateProfile, useAccountProfile } from "./accountProfile";

/**
 * Pins F-DOB-1 (Paul, 25 Sep 2026) at the Firestore boundary: the portal
 * must never write `dateOfBirth` or `gender` to `users/{uid}/private/profile`
 * (not even as null/empty), and must not carry them into its in-memory
 * profile state when a legacy document still holds them.
 *
 * `firebase/firestore` is mocked at the module boundary (no network in
 * tests); `./firebase` is stubbed only to avoid real Firebase app init.
 */

const updateDocMock = vi.fn();
type SnapshotCb = (snap: { data: () => Record<string, unknown> | undefined }) => void;
const snapshotCallbacks = new Map<string, SnapshotCb>();

vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join("/") }),
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
  onSnapshot: (ref: { path: string }, cb: SnapshotCb) => {
    snapshotCallbacks.set(ref.path, cb);
    return vi.fn();
  },
}));

vi.mock("./firebase", () => ({
  getFirebaseDb: () => ({}),
}));

beforeEach(() => {
  updateDocMock.mockReset();
  updateDocMock.mockResolvedValue(undefined);
  snapshotCallbacks.clear();
});

describe("updatePrivateProfile - F-DOB-1", () => {
  it("never writes dateOfBirth or gender, even if a caller passes them", async () => {
    const fields = {
      firstName: "Paul",
      country: "United Kingdom",
      dateOfBirth: "1980-01-01",
      gender: "x",
    } as unknown as Parameters<typeof updatePrivateProfile>[1];

    const result = await updatePrivateProfile("user-1", fields);

    expect(result).toEqual({ status: "success" });
    expect(updateDocMock).toHaveBeenCalledTimes(1);
    const [ref, payload] = updateDocMock.mock.calls[0] as [{ path: string }, Record<string, unknown>];
    expect(ref.path).toBe("users/user-1/private/profile");
    expect(payload).not.toHaveProperty("dateOfBirth");
    expect(payload).not.toHaveProperty("gender");
    expect(payload).toEqual({ firstName: "Paul", country: "United Kingdom" });
  });

  it("with only dateOfBirth/gender passed, writes nothing at all", async () => {
    const fields = { dateOfBirth: "", gender: "" } as unknown as Parameters<
      typeof updatePrivateProfile
    >[1];
    const result = await updatePrivateProfile("user-1", fields);
    expect(result).toEqual({ status: "success" });
    expect(updateDocMock).not.toHaveBeenCalled();
  });
});

describe("useAccountProfile - F-DOB-1", () => {
  it("does not read legacy dateOfBirth/gender into the private profile", () => {
    const { result } = renderHook(() => useAccountProfile("user-1"));
    act(() => {
      snapshotCallbacks.get("users/user-1")!({ data: () => ({ displayName: "Paul" }) });
      snapshotCallbacks.get("users/user-1/private/profile")!({
        data: () => ({
          firstName: "Paul",
          country: "United Kingdom",
          dateOfBirth: "1980-01-01",
          gender: "x",
        }),
      });
      snapshotCallbacks.get("users/user-1/private/game")!({ data: () => ({}) });
    });

    expect(result.current.status).toBe("success");
    if (result.current.status !== "success") return;
    expect(result.current.privateProfile).not.toHaveProperty("dateOfBirth");
    expect(result.current.privateProfile).not.toHaveProperty("gender");
    expect(result.current.privateProfile.firstName).toBe("Paul");
  });
});
