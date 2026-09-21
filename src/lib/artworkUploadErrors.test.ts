// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  artworkUploadFailureMessage,
  toArtworkUploadFailure,
  type ArtworkUploadFailureCode,
} from "./artworkUploadErrors";

/**
 * The mapping from a Storage error to something a human can act on.
 *
 * The case this file exists for is `storage/unauthorized`. The
 * `competitions/**` rule grants write on the `admin` custom claim, so a
 * signed-in non-admin is refused at the bucket rather than by this app's
 * own gate — and if that lands on screen as a generic "something went
 * wrong", it is indistinguishable from a flaky connection and the person
 * retries forever. Its message is asserted to name the real cause.
 */

function storageError(code: string) {
  return Object.assign(new Error(code), { code });
}

describe("toArtworkUploadFailure", () => {
  it.each([
    ["storage/unauthorized", "unauthorized"],
    ["storage/unauthenticated", "unauthenticated"],
    ["storage/canceled", "canceled"],
    ["storage/quota-exceeded", "quota-exceeded"],
    ["storage/retry-limit-exceeded", "retry-limit"],
  ] as const)("maps %s to %s", (storageCode, expected) => {
    const failure = toArtworkUploadFailure(storageError(storageCode));
    expect(failure.code).toBe(expected);
    // Pins that the classification came from the REAL code rather than a
    // default that happens to match.
    expect(failure.storageCode).toBe(storageCode);
  });

  it("falls back to unknown for an unrecognised storage code, keeping the code for logs", () => {
    const failure = toArtworkUploadFailure(storageError("storage/object-not-found"));
    expect(failure.code).toBe("unknown");
    expect(failure.storageCode).toBe("storage/object-not-found");
  });

  it("falls back to unknown for something that is not a Firebase error at all", () => {
    expect(toArtworkUploadFailure(new Error("network exploded")).code).toBe("unknown");
    expect(toArtworkUploadFailure(undefined).code).toBe("unknown");
    expect(toArtworkUploadFailure("a string").code).toBe("unknown");
  });

  it("ignores a `code` that is not a storage/* code", () => {
    // e.g. a callable's `functions/permission-denied` arriving here by
    // mistake must not be read as a Storage classification.
    const failure = toArtworkUploadFailure({ code: "functions/permission-denied" });
    expect(failure.code).toBe("unknown");
    expect(failure.storageCode).toBeNull();
  });

  it("recognises the missing-bucket error thrown before any network call", () => {
    const failure = toArtworkUploadFailure(new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set"));
    expect(failure.code).toBe("not-configured");
  });
});

describe("artworkUploadFailureMessage", () => {
  const codes: ArtworkUploadFailureCode[] = [
    "unauthorized",
    "unauthenticated",
    "canceled",
    "quota-exceeded",
    "retry-limit",
    "not-configured",
    "unknown",
  ];

  it("has a distinct, non-empty message for every code", () => {
    const messages = codes.map((code) => artworkUploadFailureMessage({ code, storageCode: null }));
    expect(messages.every((m) => m.length > 0)).toBe(true);
    expect(new Set(messages).size).toBe(codes.length);
  });

  it("says a permission refusal is about the admin permission, not a network blip", () => {
    const message = artworkUploadFailureMessage({ code: "unauthorized", storageCode: null });
    expect(message).toMatch(/admin/i);
    expect(message).not.toMatch(/try again/i);
  });

  it("tells someone whose session expired to sign in again, rather than to retry", () => {
    expect(artworkUploadFailureMessage({ code: "unauthenticated", storageCode: null })).toMatch(
      /sign in again/i,
    );
  });
});
