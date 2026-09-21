/**
 * Turns whatever Firebase Storage throws into one of a small set of named
 * failures, each with copy a human can act on.
 *
 * Same shape and same reasoning as `src/lib/createCompetitionErrors.ts`
 * does for the callable: the classification and the wording live here,
 * away from the component, so the component's job is only to render
 * whatever it is handed and a test can pin each message without a
 * network.
 *
 * The case that matters most is `unauthorized`. The
 * `competitions/{competitionId}` storage rule grants write on
 * `request.auth.token.admin == true` — a signed-in NON-admin fails at the
 * bucket, not in this app's own gate, and Firebase reports that as a
 * plain `storage/unauthorized`. Rendered as a generic "something went
 * wrong" that is indistinguishable from a dropped connection, and the
 * admin retries forever. It gets its own message.
 */

export type ArtworkUploadFailureCode =
  | "unauthorized"
  | "unauthenticated"
  | "canceled"
  | "quota-exceeded"
  | "retry-limit"
  | "not-configured"
  | "unknown";

export interface ArtworkUploadFailure {
  code: ArtworkUploadFailureCode;
  /** The underlying Storage error code (`storage/unauthorized`, …) when
   * there was one. Rendered nowhere; kept for logging and for a test to
   * assert the mapping came from the real code rather than a guess. */
  storageCode: string | null;
}

function readStorageCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string" && code.startsWith("storage/")) return code;
  }
  return null;
}

export function toArtworkUploadFailure(error: unknown): ArtworkUploadFailure {
  const storageCode = readStorageCode(error);

  // Thrown by `getFirebaseStorage()` before any network call — a missing
  // NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, which is a deployment mistake and
  // not something a retry can fix.
  if (
    storageCode === null &&
    error instanceof Error &&
    error.message.includes("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET")
  ) {
    return { code: "not-configured", storageCode: null };
  }

  switch (storageCode) {
    case "storage/unauthorized":
      return { code: "unauthorized", storageCode };
    case "storage/unauthenticated":
      return { code: "unauthenticated", storageCode };
    case "storage/canceled":
      return { code: "canceled", storageCode };
    case "storage/quota-exceeded":
      return { code: "quota-exceeded", storageCode };
    case "storage/retry-limit-exceeded":
      return { code: "retry-limit", storageCode };
    default:
      return { code: "unknown", storageCode };
  }
}

export function artworkUploadFailureMessage(failure: ArtworkUploadFailure): string {
  switch (failure.code) {
    case "unauthorized":
      return "Your account isn't allowed to upload competition artwork. That needs the ileadit admin permission — email hello@ileadit.co.uk if you think you should have it.";
    case "unauthenticated":
      return "You've been signed out. Sign in again and re-add the image.";
    case "canceled":
      return "Upload cancelled. Nothing was saved.";
    case "quota-exceeded":
      return "ileadit's image storage is full, so this couldn't be saved. Email hello@ileadit.co.uk — this one is on us, not you.";
    case "retry-limit":
      return "The upload kept failing, most likely a slow or dropped connection. Check your connection and try again.";
    case "not-configured":
      return "Image uploads aren't configured on this deployment (the Firebase storage bucket is missing). Email hello@ileadit.co.uk.";
    case "unknown":
      return "We couldn't upload that image. Try again, or email hello@ileadit.co.uk if it keeps happening.";
  }
}
