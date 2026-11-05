/**
 * Competition artwork: the pure, browser-free half of the upload feature.
 *
 * Everything here is a plain function or a constant so it can be unit
 * tested without jsdom, Firebase, or a canvas. Anything that needs a
 * `File`/`Blob`/`<canvas>` lives in `src/lib/imageCrop.ts`; anything that
 * needs the network lives in `src/lib/artworkUpload.ts`.
 *
 * ── The two fields ────────────────────────────────────────────────────
 * `createCompetition` accepts `imageUrl` and `backgroundImageUrl`
 * (`functions/src/callables/createCompetition.ts:70-71`, both
 * `z.string().url().max(2048).optional()`, schema `.strict()`). They are
 * NOT interchangeable — they are rendered at different shapes on both
 * platforms, which is what `TILE` and `BANNER` below encode.
 */

/* ------------------------------------------------------------------ *
 * Aspect ratios — measured, not assumed. Read the evidence before
 * changing a number here; every one of them is a citation, and the
 * BANNER case has a genuinely open question attached to it.
 * ------------------------------------------------------------------ */

/**
 * `imageUrl` — the circular tile/avatar. **1:1, and it is a circle.**
 *
 * This one is not in doubt. Every render site on both platforms is a
 * square box with a 50% corner radius:
 *
 * | Where | Size | Evidence |
 * |---|---|---|
 * | Android leaderboard header | 118dp × 118dp | `app/src/main/res/layout/activity_competition_leaderboard.xml:66-74` (`ShapeableImageView`, `shapeAppearance="@style/circularImageView"`) |
 * | Android competition list row | 64dp × 64dp | `app/src/main/res/layout/item_competition.xml:18-27` |
 * | Android joined-list row | 64dp × 64dp | `app/src/main/res/layout/item_joined_competition.xml:21-30` |
 * | Android details dialog | 96dp × 96dp | `app/src/main/res/layout/dialog_competition_details.xml:17-26` |
 * | Android joined dialog | 96dp × 96dp | `app/src/main/res/layout/dialog_joined_competition_details.xml:17-26` |
 * | Web detail hero | `size-14` (56 × 56 px), `rounded-full` | `src/components/competitions/CompetitionHero.tsx` |
 *
 * `@style/circularImageView` is `cornerFamily=rounded, cornerSize=50%`
 * (`app/src/main/res/values/styles.xml:192-196`), i.e. a true circle.
 * Every Android site uses `scaleType="centerCrop"`; the web site uses
 * `object-cover` — the same behaviour. Cropping to 1:1 with a round mask
 * is therefore exactly what both platforms show, at every size.
 */
export const TILE_ASPECT = 1;

/**
 * `backgroundImageUrl` — the banner. **One format everywhere: 3:1,
 * uploaded at 2400 × 800 px** (COMP-BRAND-1, approved by Paul on
 * 5 Nov 2026). This supersedes the earlier 16:9 / 1920 × 1080 "generous
 * source" contract (branding spec 20 Sep 2026 §3), which tried to survive
 * a full-bleed band of fixed height and variable width. The approved
 * design instead has the app show the same 3:1 banner on list cards and
 * crop it to 13:5 (2.6:1) on the details sheet and the leaderboard, so one
 * source shape covers every surface and the web previews show it at 3:1
 * too (see `CompetitionHero`).
 *
 * Images already uploaded at 16:9 are not touched; they simply
 * `object-cover` into the 3:1 frame.
 */
export const BANNER_ASPECT = 3;

/**
 * The aspect the app crops the banner to on the details sheet and the
 * leaderboard: 13:5 = 2.6:1. Kept as data so tests can check the guides
 * below against it — the web portal itself shows 3:1.
 */
export const BANNER_APP_DETAIL_ASPECT = 13 / 5;

/**
 * Crop-dialog guides, as fractions of the banner. The design states them
 * in pixels of a 1200 × 400 reference banner, so the fractions are derived
 * from those pixel figures rather than typed as decimals:
 *
 *  - safe zone: inset 80px left/right and 80px top/bottom (at 1200 × 400);
 *    keep logos and text inside it.
 *  - logo overlap: the bottom-left 300 × 120px (at 1200 × 400), where the
 *    round competition logo sits over the banner in the app. Keep
 *    anything important out of it.
 */
const BANNER_GUIDE_REFERENCE = { width: 1200, height: 400 } as const;

export const BANNER_GUIDES = {
  safeZone: {
    insetX: 80 / BANNER_GUIDE_REFERENCE.width,
    insetY: 80 / BANNER_GUIDE_REFERENCE.height,
  },
  logoOverlap: {
    width: 300 / BANNER_GUIDE_REFERENCE.width,
    height: 120 / BANNER_GUIDE_REFERENCE.height,
  },
} as const;

export type BannerGuides = typeof BANNER_GUIDES;

/* ------------------------------------------------------------------ *
 * Output sizes
 * ------------------------------------------------------------------ */

/**
 * Pixel dimensions the cropped image is re-encoded at before upload.
 *
 *  - tile: Android's largest render is 118dp → 354px at 3x device pixel
 *    ratio → rounded to 512.
 *  - banner: 2400×800 (3:1), the approved COMP-BRAND-1 upload size — the
 *    same shape as `BANNER_ASPECT`, so the output canvas is never
 *    stretched. 2x the 1200×400 reference the crop-dialog guides are
 *    specified in, so the guides scale exactly.
 */
export const ARTWORK_OUTPUT_SIZE = {
  tile: { width: 512, height: 512 },
  banner: { width: 2400, height: 800 },
} as const;

export type ArtworkKind = keyof typeof ARTWORK_OUTPUT_SIZE;

export function artworkAspect(kind: ArtworkKind): number {
  return kind === "tile" ? TILE_ASPECT : BANNER_ASPECT;
}

/* ------------------------------------------------------------------ *
 * Client-side file validation
 * ------------------------------------------------------------------ */

/**
 * Raster formats only. This list is a deliberate 1:1 copy of the
 * `profiles/{userId}` storage rule's own allowlist
 * (`admin-web/storage.rules`:
 * `request.resource.contentType.matches('image/(png|jpeg|webp|gif)')`).
 *
 * **SVG is excluded on purpose.** `image/svg+xml` can carry script that
 * executes when someone navigates directly to the storage download URL on
 * the `firebasestorage.googleapis.com` origin. The profiles rule already
 * blocks it server-side; the `competitions/{competitionId}` rule does NOT
 * (it is `allow write: if request.auth != null && request.auth.token.admin
 * == true`, with no content-type or size predicate at all). So for this
 * path the check below is the ONLY thing standing between an admin and a
 * scriptable object in the bucket — it is a real control here, not a
 * convenience mirror of a server rule. If that ever stops being
 * acceptable, the fix is to add the predicate to the competitions rule,
 * not to lean harder on this constant.
 */
export const ACCEPTED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

/** The `accept` attribute for the file input — same list, same source. */
export const ARTWORK_FILE_ACCEPT = ACCEPTED_IMAGE_MIME_TYPES.join(",");

/**
 * Max size of the file a user may SELECT, per artwork kind. Not the size of
 * what gets uploaded: the crop step re-encodes to `ARTWORK_OUTPUT_SIZE`
 * first, so the object that actually reaches the bucket is typically a few
 * hundred KB regardless of how large the original photo was.
 *
 * These numbers are the spec's own figures
 * (`ileadit-branding-spec-20260920.md` §2 "Max 2MB, matching the
 * `profiles/` cap" for the badge, §3 "max 4MB — higher than the badge's
 * 2MB — banners are photographic" for the banner), and — unlike the flat
 * 10 MB this file shipped with before — they are deliberately the SAME
 * numbers spec §5's prerequisite #2 asks the `competitions/{competitionId}`
 * storage rule to enforce server-side. That rule hardening has not
 * shipped yet (the rule still has no size predicate at all — see
 * `ACCEPTED_IMAGE_MIME_TYPES`'s comment on the same gap for content type),
 * so today this client-side check is a courtesy that can be bypassed by
 * anyone not using this form; it stops being only a courtesy the moment
 * the storage rule catches up, which is exactly why the numbers already
 * match.
 */
export const MAX_SOURCE_FILE_BYTES_BY_KIND: Record<ArtworkKind, number> = {
  tile: 2 * 1024 * 1024,
  banner: 4 * 1024 * 1024,
};

export type ArtworkRejectionReason = "empty" | "vector-image" | "unsupported-type" | "too-large";

export interface ArtworkFileRejection {
  reason: ArtworkRejectionReason;
  /** User-facing, already written for a human. Never a raw error string. */
  message: string;
}

/** Just the `File` fields validation reads — so tests need no `File`
 * constructor and no jsdom. A real `File` satisfies this structurally. */
export interface ArtworkFileLike {
  name: string;
  type: string;
  size: number;
}

function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
}

/**
 * Returns `null` when the file is acceptable, or a rejection with copy
 * the field can show as-is.
 *
 * `kind` selects which of `MAX_SOURCE_FILE_BYTES_BY_KIND`'s two caps
 * applies — the badge and the banner are no longer held to the same size
 * limit (spec §2/§3, see `MAX_SOURCE_FILE_BYTES_BY_KIND`'s own comment).
 *
 * SVG gets its OWN reason and message rather than falling into the
 * generic unsupported-type bucket: "SVG isn't supported" with no reason
 * reads like an oversight to fix, and someone would reasonably try to
 * widen the allowlist. The message says why it is excluded.
 */
export function validateArtworkFile(file: ArtworkFileLike, kind: ArtworkKind): ArtworkFileRejection | null {
  if (file.size === 0) {
    return { reason: "empty", message: "That file is empty. Try picking it again." };
  }

  const type = file.type.toLowerCase();
  const isSvg = type === "image/svg+xml" || /\.svgz?$/i.test(file.name);
  if (isSvg) {
    return {
      reason: "vector-image",
      message:
        "SVG images aren't accepted, because an SVG can contain scripts that run when the image is opened directly. Export it as PNG, JPEG or WebP and upload that.",
    };
  }

  if (!ACCEPTED_IMAGE_MIME_TYPES.includes(type as (typeof ACCEPTED_IMAGE_MIME_TYPES)[number])) {
    return {
      reason: "unsupported-type",
      message: `That's not an image we can use${file.type ? ` (${file.type})` : ""}. Choose a PNG, JPEG, WebP or GIF.`,
    };
  }

  const maxBytes = MAX_SOURCE_FILE_BYTES_BY_KIND[kind];
  if (file.size > maxBytes) {
    // Spec §4's own phrasing ("That file is over 2MB — try a smaller
    // image." / "…over 4MB…") names the threshold, not the file's actual
    // size — kept that way here too rather than reintroducing the file's
    // exact size, so the two kinds read as the same sentence with one
    // number swapped, matching the spec's copy exactly.
    return {
      reason: "too-large",
      message: `That file is over ${formatMegabytes(maxBytes)} — try a smaller image.`,
    };
  }

  return null;
}

/** GIFs go through a `<canvas>`, which only ever has one frame of them.
 * Worth saying out loud before the upload, not after. */
export function losesAnimationOnCrop(file: ArtworkFileLike): boolean {
  return file.type.toLowerCase() === "image/gif";
}

/* ------------------------------------------------------------------ *
 * Minimum source resolution — a SOFT, non-blocking warning
 * ------------------------------------------------------------------ *
 * Spec §2 (badge) and §3 (banner) both frame "the source is smaller than
 * recommended" as a WARNING, not a rejection ("Warning, low resolution
 * (soft, non-blocking) ... with a secondary 'Use anyway' text button —
 * genuinely a warning, not an error, since a slightly soft badge is a real
 * ship-it-anyway call sponsors get to make", spec §4). These functions are
 * pure and kind-generic so both the badge's 512×512 and the banner's
 * 1200×400 minimum go through one path; the actual pixel dimensions can
 * only be read by decoding the file in a browser, which is why this is
 * split from the deciding logic below — see `getImageDimensions` in
 * `src/lib/imageCrop.ts` for the half that needs an `Image`.
 */

/** Minimum recommended source dimensions per kind. Badge: spec §2,
 * "minimum 512×512px (1024×1024 recommended...)". Banner: spec §3,
 * "min 1920×1080", superseded by COMP-BRAND-1 (5 Nov 2026): the banner is
 * 3:1 at 2400×800, and a source below half that (1200×400) is what warns,
 * so a correctly-sized 2400×800 upload never does. Falling short of these is a warning, never a block —
 * nothing here throws or rejects a file for being under this size. */
export const MIN_SOURCE_DIMENSIONS: Record<ArtworkKind, { width: number; height: number }> = {
  tile: { width: 512, height: 512 },
  banner: { width: 1200, height: 400 },
};

export function isBelowMinimumResolution(kind: ArtworkKind, width: number, height: number): boolean {
  const min = MIN_SOURCE_DIMENSIONS[kind];
  return width < min.width || height < min.height;
}

/** User-facing copy for the soft warning, worded per spec §4's badge
 * example ("This image is smaller than 512×512px and may look blurry.
 * Upload a larger version, or use it anyway.") and extended to the banner
 * with the same shape and its own numbers — the spec does not spell out
 * the banner's exact sentence, so this is a deliberate, documented
 * extrapolation of the badge's wording, not a second verbatim quote. */
export function lowResolutionWarning(kind: ArtworkKind): string {
  const min = MIN_SOURCE_DIMENSIONS[kind];
  return `This image is smaller than ${min.width}×${min.height}px and may look blurry. Upload a larger version, or use it anyway.`;
}

/* ------------------------------------------------------------------ *
 * Upload guidance copy (WEB-SPONSOR-NAME, COMP-BRAND-1)
 * ------------------------------------------------------------------ */

/** Exact words from the ticket — shown under each upload field. The banner
 * wording describes the sponsor-branded design (3:1, 2400 × 800 px), which
 * is exactly what the crop step produces (`BANNER_ASPECT`,
 * `ARTWORK_OUTPUT_SIZE.banner`). */
export const BANNER_UPLOAD_GUIDANCE =
  "Banner: 2400 × 800 px (3:1). Keep logos and text inside the centre area, away from the bottom-left corner, where the round logo sits. Don't put text in the image; the app shows the name and prize.";

export const LOGO_UPLOAD_GUIDANCE =
  "Logo: square, 512 × 512 px, ideally a transparent PNG. It's shown in full inside a circle.";

/* ------------------------------------------------------------------ *
 * Draft competition ids and storage paths
 * ------------------------------------------------------------------ */

const DRAFT_ID_PREFIX = "draft-";

/**
 * A client-minted id used as the `{competitionId}` path segment while the
 * form is still being filled in.
 *
 * **The ordering problem this solves.** The engine mints the real
 * competition id — `createCompetition` returns it — but the artwork has
 * to be uploaded and turned into a download URL BEFORE that callable is
 * invoked, because the URL is one of the callable's own inputs
 * (`imageUrl`/`backgroundImageUrl`). So at upload time there is, by
 * construction, no real id to put in the path.
 *
 * The storage rule does not require one. It is
 * `match /competitions/{competitionId}/{allPaths=**}` with
 * `allow write: if request.auth != null && request.auth.token.admin ==
 * true` — `{competitionId}` is a free wildcard, never checked against
 * Firestore. A draft id is therefore as writable as a real one, and the
 * uploaded object is equally readable by any signed-in user afterwards,
 * which is all the app needs.
 *
 * **What it costs.** An abandoned form leaves the uploaded objects in the
 * bucket with nothing pointing at them, and there is no lifecycle rule or
 * cleanup job in this project that would ever collect them. Two things
 * bound the damage, neither of which eliminates it:
 *  - replacing or removing an image within the same form session deletes
 *    the object it replaces (`deleteCompetitionArtwork`), so a session
 *    orphans at most one object per field, not one per attempt;
 *  - the `draft-` prefix makes every orphan identifiable by path alone, so
 *    a future sweep ("delete `competitions/draft-*` older than N days")
 *    needs no Firestore cross-reference to be safe.
 *
 * The alternative — create the competition first, then upload, then patch
 * the URLs on — needs an `updateCompetition` callable that does not exist,
 * and creating the engine object before the admin has finished the form is
 * a worse trade anyway (it would be visible, joinable and half-configured).
 * A user-scoped temp path is not available either: the storage rules'
 * catch-all denies everything outside `profiles/{userId}` and
 * `competitions/{competitionId}`.
 */
export function createDraftCompetitionId(): string {
  const globalCrypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (globalCrypto && typeof globalCrypto.randomUUID === "function") {
    return `${DRAFT_ID_PREFIX}${globalCrypto.randomUUID()}`;
  }
  // Non-secure fallback for any runtime without `crypto.randomUUID` (older
  // Safari, some test environments). Uniqueness is all this id needs —
  // it is a folder name, not a capability or a secret; the storage rule
  // grants on the admin claim, never on knowing the path.
  return `${DRAFT_ID_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isDraftCompetitionId(id: string): boolean {
  return id.startsWith(DRAFT_ID_PREFIX);
}

/** A single path segment: no slashes, no whitespace, no query characters.
 * `.` and `..` are allowed by this character class and are handled
 * separately below — they match it happily and are exactly the two values
 * that would escape the folder. */
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9._-]+$/;
const RELATIVE_PATH_SEGMENTS = new Set([".", ".."]);

/** File extension for the encoded output — not the source file's, which
 * may differ (a WebP source is re-encoded as PNG, a JPEG as JPEG). */
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

/**
 * `competitions/{competitionId}/{kind}-{timestamp}.{ext}`.
 *
 * Timestamped rather than a fixed `tile.png`, so replacing an image never
 * has to race a CDN cache holding the previous object under the same URL.
 * Throws on a path segment that could escape the folder — the id comes
 * from `createDraftCompetitionId` today, but this function is the thing
 * that has to stay safe if a caller ever passes a real engine id through.
 */
export function artworkStoragePath(
  competitionId: string,
  kind: ArtworkKind,
  mimeType: string,
  now: number = Date.now(),
): string {
  if (!SAFE_PATH_SEGMENT.test(competitionId) || RELATIVE_PATH_SEGMENTS.has(competitionId)) {
    throw new Error(`Unsafe competition id for a storage path: ${JSON.stringify(competitionId)}`);
  }
  const extension = EXTENSION_BY_MIME[mimeType.toLowerCase()];
  if (!extension) {
    throw new Error(`Unsupported output mime type for a storage path: ${mimeType}`);
  }
  return `competitions/${competitionId}/${kind}-${now}.${extension}`;
}

/**
 * The mime type the crop is re-encoded to.
 *
 * PNG when the source could carry transparency (PNG/WebP/GIF) and the
 * output is the tile — the tile is masked into a circle over whatever
 * background the app happens to use, so a logo with a transparent
 * surround must stay transparent or it gains a white square's corners.
 * JPEG otherwise, including for every banner: the banner is a full-bleed
 * photographic band sitting on solid navy under a gradient overlay, where
 * alpha buys nothing and PNG would multiply the file size of a 1536px
 * photo for no visible gain.
 */
export function artworkOutputMimeType(kind: ArtworkKind, sourceMimeType: string): "image/png" | "image/jpeg" {
  if (kind !== "tile") return "image/jpeg";
  const type = sourceMimeType.toLowerCase();
  return type === "image/png" || type === "image/webp" || type === "image/gif" ? "image/png" : "image/jpeg";
}
