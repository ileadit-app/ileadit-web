// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Pins the contract that stops an upload failing silently:
 * `uploadCompetitionArtwork` NEVER rejects, and every path — a refused
 * write, a cancelled transfer, a synchronous config error, and the
 * awkward one where the bytes land but the download URL cannot be read —
 * resolves to a `failure` the field can render.
 *
 * Mocked at the `firebase/storage` module boundary, i.e. the network
 * itself, so `src/lib/artworkUpload.ts` and
 * `src/lib/artworkUploadErrors.ts` both run for real.
 */

const uploadBytesResumable = vi.fn();
const getDownloadURL = vi.fn();
const deleteObject = vi.fn();
const getFirebaseStorage = vi.fn(() => ({}));

vi.mock("firebase/storage", () => ({
  ref: (_storage: unknown, path: string) => ({ path }),
  uploadBytesResumable: (...args: unknown[]) => uploadBytesResumable(...args),
  getDownloadURL: (...args: unknown[]) => getDownloadURL(...args),
  deleteObject: (...args: unknown[]) => deleteObject(...args),
}));

vi.mock("./firebase", () => ({
  getFirebaseStorage: () => getFirebaseStorage(),
}));

const { deleteCompetitionArtwork, toProgress, uploadCompetitionArtwork } = await import("./artworkUpload");

/** A stand-in for Firebase's `UploadTask`: captures the three `on()`
 * callbacks so a test can drive progress, failure or completion by hand. */
function fakeTask() {
  const handlers: {
    next?: (s: { bytesTransferred: number; totalBytes: number }) => void;
    error?: (e: unknown) => void;
    complete?: () => void;
  } = {};
  return {
    handlers,
    snapshot: { ref: { path: "competitions/draft-x/tile-1.png" } },
    cancel: vi.fn(),
    on(
      _event: string,
      next: typeof handlers.next,
      error: typeof handlers.error,
      complete: typeof handlers.complete,
    ) {
      handlers.next = next;
      handlers.error = error;
      handlers.complete = complete;
    },
  };
}

function startUpload(onProgress?: (p: { percent: number }) => void) {
  return uploadCompetitionArtwork({
    blob: { size: 10 } as Blob,
    storagePath: "competitions/draft-x/tile-1.png",
    contentType: "image/png",
    onProgress,
  });
}

beforeEach(() => {
  uploadBytesResumable.mockReset();
  getDownloadURL.mockReset();
  deleteObject.mockReset();
  getFirebaseStorage.mockReset();
  getFirebaseStorage.mockReturnValue({});
});

describe("toProgress", () => {
  it("reports an integer percentage", () => {
    expect(toProgress(50, 200)).toEqual({ bytesTransferred: 50, totalBytes: 200, percent: 25 });
  });

  it("reports 0 rather than NaN for a zero-byte total", () => {
    // `0/0` is NaN, and NaN reaches `aria-valuenow` and a CSS width, where
    // it silently renders as an empty/absent bar rather than an error.
    expect(toProgress(0, 0).percent).toBe(0);
  });
});

describe("uploadCompetitionArtwork", () => {
  it("resolves success with the download URL and the path it wrote to", async () => {
    const task = fakeTask();
    uploadBytesResumable.mockReturnValue(task);
    getDownloadURL.mockResolvedValue("https://storage.example/tile.png");

    const handle = startUpload();
    task.handlers.complete?.();

    await expect(handle.outcome).resolves.toEqual({
      status: "success",
      downloadUrl: "https://storage.example/tile.png",
      storagePath: "competitions/draft-x/tile-1.png",
    });
  });

  it("reports progress while the transfer runs", async () => {
    const task = fakeTask();
    uploadBytesResumable.mockReturnValue(task);
    getDownloadURL.mockResolvedValue("https://storage.example/tile.png");
    const onProgress = vi.fn();

    const handle = startUpload(onProgress);
    task.handlers.next?.({ bytesTransferred: 25, totalBytes: 100 });
    task.handlers.next?.({ bytesTransferred: 100, totalBytes: 100 });
    task.handlers.complete?.();
    await handle.outcome;

    expect(onProgress.mock.calls.map(([p]) => p.percent)).toEqual([25, 100]);
  });

  it("resolves (never rejects) a refused write as an `unauthorized` failure", async () => {
    const task = fakeTask();
    uploadBytesResumable.mockReturnValue(task);

    const handle = startUpload();
    task.handlers.error?.(Object.assign(new Error("denied"), { code: "storage/unauthorized" }));

    await expect(handle.outcome).resolves.toEqual({
      status: "failure",
      failure: { code: "unauthorized", storageCode: "storage/unauthorized" },
    });
  });

  it("treats an unreadable download URL as a failure, not a success with no URL", async () => {
    // The bytes are in the bucket, but there is nothing to put in
    // `imageUrl`. Resolving success here would send the callable an empty
    // string — the exact silent-failure shape this feature has to avoid.
    const task = fakeTask();
    uploadBytesResumable.mockReturnValue(task);
    getDownloadURL.mockRejectedValue(Object.assign(new Error("nope"), { code: "storage/unknown" }));

    const handle = startUpload();
    task.handlers.complete?.();

    const outcome = await handle.outcome;
    expect(outcome.status).toBe("failure");
  });

  it("cancel() aborts the task and the outcome still resolves", async () => {
    const task = fakeTask();
    uploadBytesResumable.mockReturnValue(task);

    const handle = startUpload();
    handle.cancel();
    expect(task.cancel).toHaveBeenCalled();

    // Firebase reports the abort through the error callback.
    task.handlers.error?.(Object.assign(new Error("cancelled"), { code: "storage/canceled" }));
    await expect(handle.outcome).resolves.toMatchObject({
      status: "failure",
      failure: { code: "canceled" },
    });
  });

  it("resolves a failure when the storage handle itself throws synchronously", async () => {
    // A missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET throws from
    // getFirebaseStorage() before any task exists, outside the `on()`
    // error path entirely.
    getFirebaseStorage.mockImplementation(() => {
      throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set");
    });

    await expect(startUpload().outcome).resolves.toEqual({
      status: "failure",
      failure: { code: "not-configured", storageCode: null },
    });
    expect(uploadBytesResumable).not.toHaveBeenCalled();
  });
});

describe("deleteCompetitionArtwork", () => {
  it("returns true when the object is deleted", async () => {
    deleteObject.mockResolvedValue(undefined);
    await expect(deleteCompetitionArtwork("competitions/draft-x/tile-1.png")).resolves.toBe(true);
  });

  it("swallows a failure and returns false, because the user did not ask for this", async () => {
    deleteObject.mockRejectedValue(Object.assign(new Error("denied"), { code: "storage/unauthorized" }));
    await expect(deleteCompetitionArtwork("competitions/draft-x/tile-1.png")).resolves.toBe(false);
  });
});
