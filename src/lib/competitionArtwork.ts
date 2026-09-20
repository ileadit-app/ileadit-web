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
 * `backgroundImageUrl` — the hero banner. **There is no single correct
 * ratio, and web and Android do not agree.** This is a flagged, open
 * question, not a settled number; `BANNER_ASPECT` below is provisional.
 *
 * Neither platform renders this at a fixed ratio. Both render it as a
 * full-bleed band of FIXED HEIGHT and VARIABLE (viewport) WIDTH, filled
 * with `centerCrop`/`object-cover` — so the effective aspect ratio is
 * whatever `viewportWidth / bandHeight` happens to be on the device.
 *
 * Android — ONE render site only (grep of `competition.backgroundImageUrl`
 * across `app/src/main/java` returns exactly
 * `CompetitionLeaderboardActivity.kt:643-648`, which resolves
 * `backgroundImageUrl ?: imageUrl` and Glides it into
 * `binding.competitionBackgroundImage`). That view is
 * `layout_width="match_parent"`, `layout_height="147dp"`,
 * `scaleType="centerCrop"`
 * (`app/src/main/res/layout/activity_competition_leaderboard.xml:27-33`):
 *
 * | Device width | Ratio |
 * |---|---|
 * | 360dp (baseline phone) | 2.45 : 1 |
 * | 393dp (Pixel-class) | 2.67 : 1 |
 * | 411dp (large phone) | 2.80 : 1 |
 *
 * Web — `src/components/competitions/CompetitionHero.tsx`, a full-viewport-
 * width band at `h-[200px]` below Tailwind's `sm` (640px) and
 * `h-[280px]` at and above it, with `object-cover`:
 *
 * | Viewport | Ratio |
 * |---|---|
 * | 390px phone | 1.95 : 1 |
 * | 640px (`sm` boundary) | 2.29 : 1 |
 * | 1280px laptop | 4.57 : 1 |
 * | 1920px desktop | 6.86 : 1 |
 *
 * So: Android sits in a narrow 2.4–2.8 band; web sweeps 1.95 → 6.86 and
 * spends most of its life far WIDER than Android ever gets. They
 * disagree, and neither is a fixed target a cropper can be "correct"
 * against.
 *
 * `BANNER_ASPECT = 3` is a provisional choice, not a measurement: it is
 * approximately the geometric mean of the web extremes actually worth
 * designing for (√(1.95 × 4.57) ≈ 2.99), which minimises the worst-case
 * proportion lost in EITHER direction, and it happens to sit just outside
 * Android's own 2.45–2.80 band. **Paul has not signed this off.** Until
 * he does, the crop UI does not present it as authoritative: it draws the
 * always-visible safe area (see `bannerSafeAreaFractions`) over the crop
 * frame, and the form previews the result at both a phone and a desktop
 * width using the real hero component, so the trimming is visible rather
 * than asserted.
 */
export const BANNER_ASPECT = 3;

/**
 * The real display ratios measured above, kept as data so
 * `bannerSafeAreaFractions` derives the safe area from the SAME numbers
 * the comment cites instead of a second hand-copied pair.
 */
export const MEASURED_BANNER_DISPLAY_RATIOS = {
  /** Web at a 390px phone viewport: 390 / 200. */
  narrowest: 390 / 200,
  /** Web at a 1280px laptop viewport: 1280 / 280. Wider desktops exist
   * (1920px → 6.86) but a banner designed for those loses so much height
   * everywhere else that it stops being a useful target; 1280 is the
   * widest ratio this crop is asked to survive. */
  widest: 1280 / 280,
} as const;

/**
 * The fraction of a crop at `cropAspect` that survives `object-cover` at
 * every display ratio between `narrowest` and `widest`.
 *
 * A display band WIDER than the crop keeps the full width and trims top
 * and bottom (vertical fraction `cropAspect / widest`); a band NARROWER
 * than the crop keeps the full height and trims left and right
 * (horizontal fraction `narrowest / cropAspect`). Both are clamped at 1 —
 * nothing is ever more than fully visible.
 *
 * Used to draw the "always visible" guide inside the banner crop frame.
 */
export function bannerSafeAreaFractions(
  cropAspect: number = BANNER_ASPECT,
  ratios: { narrowest: number; widest: number } = MEASURED_BANNER_DISPLAY_RATIOS,
): { horizontal: number; vertical: number } {
  return {
    horizontal: Math.min(1, ratios.narrowest / cropAspect),
    vertical: Math.min(1, cropAspect / ratios.widest),
  };
}

/* ------------------------------------------------------------------ *
 * Output sizes
 * ------------------------------------------------------------------ */

/**
 * Pixel dimensions the cropped image is re-encoded at before upload.
 *
 * Sized from the largest real render times a 3x device pixel ratio, then
 * rounded to a round number — not arbitrary:
 *  - tile: Android's largest is 118dp → 354px at 3x → 512.
 *  - banner: Android's band is 147dp tall → 441px at 3x; web's is 280 CSS
 *    px → 560px at 2x. 512 tall at `BANNER_ASPECT` = 1536 × 512.
 */
export const ARTWORK_OUTPUT_SIZE = {
  tile: { width: 512, height: 512 },
  banner: { width: 512 * BANNER_ASPECT, height: 512 },
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
 * Max size of the file a user may SELECT. Not the size of what gets
 * uploaded: the crop step re-encodes to `ARTWORK_OUTPUT_SIZE` first, so
 * the object that actually reaches the bucket is typically a few hundred
 * KB regardless. 10 MB is roughly a 12-megapixel phone photo, which is
 * the realistic worst case someone drags in; above that the browser-side
 * decode-and-canvas step starts to be the thing that hurts, not the
 * network.
 *
 * Deliberately NOT the profiles rule's 2 MB: that limit is enforced
 * server-side on the uploaded object, and applies to a much smaller
 * avatar. The competitions rule has no size predicate at all.
 */
export const MAX_SOURCE_FILE_BYTES = 10 * 1024 * 1024;

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
 * SVG gets its OWN reason and message rather than falling into the
 * generic unsupported-type bucket: "SVG isn't supported" with no reason
 * reads like an oversight to fix, and someone would reasonably try to
 * widen the allowlist. The message says why it is excluded.
 */
export function validateArtworkFile(file: ArtworkFileLike): ArtworkFileRejection | null {
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

  if (file.size > MAX_SOURCE_FILE_BYTES) {
    return {
      reason: "too-large",
      message: `That image is ${formatMegabytes(file.size)}. Keep it under ${formatMegabytes(MAX_SOURCE_FILE_BYTES)}.`,
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
