import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { getFirebaseStorage } from "./firebase";
import { toArtworkUploadFailure, type ArtworkUploadFailure } from "./artworkUploadErrors";

/**
 * The one place this app talks to Cloud Storage.
 *
 * Mirrors the single-call-site discipline `src/lib/createCompetition.ts`
 * established for the engine callable: components never import
 * `firebase/storage` themselves, so the error mapping, the resumable-
 * upload plumbing and the progress contract exist once.
 *
 * NOTE for the repo guards (`src/lib/repoGuards.test.ts`): the
 * no-direct-writes guard bans `setDoc`/`updateDoc`/`addDoc`/`deleteDoc`/
 * `writeBatch`/`runTransaction` — Firestore game-state mutations, which
 * must go through an engine callable. Nothing here writes Firestore.
 * Cloud Storage is a separate service with its own rules file, and it has
 * no callable wrapper in the engine to go through; the storage rules
 * (`admin-web/storage.rules`) ARE the authority on who may write here,
 * and they gate `competitions/**` on the `admin` custom claim.
 */

export interface ArtworkUploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  /** 0–100, integer. `totalBytes` of 0 reports 0 rather than NaN. */
  percent: number;
}

export type ArtworkUploadOutcome =
  | { status: "success"; downloadUrl: string; storagePath: string }
  | { status: "failure"; failure: ArtworkUploadFailure };

export interface ArtworkUploadHandle {
  outcome: Promise<ArtworkUploadOutcome>;
  /** Aborts the transfer. The promise then resolves (never rejects) with
   * a `canceled` failure, so a caller that awaits it does not also need a
   * catch. */
  cancel: () => void;
}

export function toProgress(bytesTransferred: number, totalBytes: number): ArtworkUploadProgress {
  return {
    bytesTransferred,
    totalBytes,
    percent: totalBytes > 0 ? Math.round((bytesTransferred / totalBytes) * 100) : 0,
  };
}

/**
 * Uploads `blob` to `storagePath` and resolves with its download URL.
 *
 * Resumable rather than a one-shot `uploadBytes` for one reason only: it
 * is the only Storage API that reports progress, and an upload of a
 * multi-hundred-KB image over a phone connection with no progress bar is
 * indistinguishable from a hang.
 *
 * Never rejects. Every path resolves to a `success` or a `failure` — the
 * caller renders one or the other, and there is no shape of this function
 * that fails silently.
 */
export function uploadCompetitionArtwork({
  blob,
  storagePath,
  contentType,
  onProgress,
}: {
  blob: Blob;
  storagePath: string;
  contentType: string;
  onProgress?: (progress: ArtworkUploadProgress) => void;
}): ArtworkUploadHandle {
  let cancel = () => {};

  const outcome = new Promise<ArtworkUploadOutcome>((resolve) => {
    let task;
    try {
      const storageRef = ref(getFirebaseStorage(), storagePath);
      task = uploadBytesResumable(storageRef, blob, { contentType });
    } catch (error) {
      // `getFirebaseStorage()` throws synchronously on a missing bucket.
      resolve({ status: "failure", failure: toArtworkUploadFailure(error) });
      return;
    }

    cancel = () => task.cancel();

    task.on(
      "state_changed",
      (snapshot) => onProgress?.(toProgress(snapshot.bytesTransferred, snapshot.totalBytes)),
      (error) => resolve({ status: "failure", failure: toArtworkUploadFailure(error) }),
      async () => {
        try {
          const downloadUrl = await getDownloadURL(task.snapshot.ref);
          resolve({ status: "success", downloadUrl, storagePath });
        } catch (error) {
          // The bytes are in the bucket but we could not get a URL for
          // them. That is still a failure from the form's point of view —
          // there is nothing to put in `imageUrl` — so it is reported as
          // one rather than resolving success with an empty string.
          resolve({ status: "failure", failure: toArtworkUploadFailure(error) });
        }
      },
    );
  });

  return { outcome, cancel: () => cancel() };
}

/**
 * Best-effort delete of a previously uploaded object.
 *
 * Deliberately swallows its errors and returns a boolean rather than
 * throwing: this is only ever called to tidy up an object the user has
 * already replaced or removed, so a failure changes nothing the user can
 * see or act on, and surfacing it would mean showing an error for an
 * operation they did not ask for. The bounded cost of a failure here is
 * one orphaned object — the same cost as abandoning the form, which
 * `createDraftCompetitionId`'s comment already accounts for.
 */
export async function deleteCompetitionArtwork(storagePath: string): Promise<boolean> {
  try {
    await deleteObject(ref(getFirebaseStorage(), storagePath));
    return true;
  } catch {
    return false;
  }
}
