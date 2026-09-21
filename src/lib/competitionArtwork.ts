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
 * DISPLAY ratio, and web and Android do not agree** — that part is still
 * true and unchanged. What changed (per
 * `automation-hub/docs/ileadit-branding-spec-20260920.md` §3, Paul-approved
 * design spec, superseding the provisional `BANNER_ASPECT = 3` this file
 * shipped with) is the STRATEGY: instead of guessing a single crop ratio
 * that compromises between the two platforms' display ratios, the crop
 * asks for a generous **16:9 (1920×1080) SOURCE** — wider than the
 * tightest Android target, narrower than the widest web target — and
 * accepts that each platform's `object-cover` render will trim a
 * DIFFERENT amount off the top and bottom of that same source. The safe
 * area (see `bannerSafeAreaFractions`) is what tells the uploader how much
 * survives everywhere.
 *
 * Neither platform renders the banner at a fixed ratio. Both render it as
 * a full-bleed band of FIXED HEIGHT and VARIABLE (viewport) WIDTH, filled
 * with `centerCrop`/`object-cover` — so the effective DISPLAY ratio is
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
 * | 1280px laptop | 4.57 : 1 (the spec rounds this to "≈4.6:1") |
 * | 1920px desktop | 6.86 : 1 |
 *
 * So: Android sits in a narrow 2.4–2.8 band; web sweeps 1.95 → 6.86 and
 * spends most of its life far WIDER than Android ever gets. Both bands sit
 * ABOVE 16:9 (1.78:1) — a 16:9 source is narrower than every real display
 * target on either platform, which is exactly why it works as a source
 * contract: `object-cover` always keeps the FULL WIDTH of a 16:9 source
 * and trims only the top and bottom, never the sides, on every surface
 * this app actually renders.
 *
 * `BANNER_ASPECT = 16 / 9` is the spec's settled answer, not a provisional
 * placeholder — Paul has signed off on the 16:9/1920×1080 source
 * recommendation (spec §3). What is still asserted rather than guaranteed
 * is the sponsor's own choice of what to put in the source photo, which is
 * why the crop UI still draws the always-visible safe area (see
 * `bannerSafeAreaFractions`) over the crop frame, and the form still
 * previews the result at both a phone and a desktop width using the real
 * hero component — so the trimming stays visible rather than asserted.
 */
export const BANNER_ASPECT = 16 / 9;

/**
 * The real display ratios measured above, kept as data so
 * `bannerSafeAreaFractions` derives the safe area from the SAME numbers
 * the comment cites instead of a second hand-copied pair.
 *
 * These are DISPLAY ratios (unaffected by the `BANNER_ASPECT` source
 * contract change above) — they describe `CompetitionHero.tsx`'s own
 * rendered band shape, not anything about the uploaded source. The spec
 * (§3) quotes the widest of these as "≈4.6:1"; `1280 / 280` below is the
 * precise figure that rounds to it.
 */
export const MEASURED_BANNER_DISPLAY_RATIOS = {
  /** Web at a 390px phone viewport: 390 / 200. */
  narrowest: 390 / 200,
  /** Web at a 1280px laptop viewport: 1280 / 280 ≈ 4.6:1 — the spec's
   * own "desktop web reaches about 4.6:1" figure. Wider desktops exist
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
 * With the spec's 16:9 `BANNER_ASPECT`, EVERY real display ratio measured
 * above (1.95 through 4.6+) is wider than the crop, so in practice
 * `horizontal` always clamps to 1 (nothing is ever trimmed off the sides)
 * and the whole safe area question is really a `vertical` question, always
 * decided by the WIDEST target — that is what actually determines what
 * survives, per the spec's own arithmetic: cover-cropping a 1920×1080
 * (16:9) source into the 4.6:1 desktop band keeps only
 * `(16/9) / 4.6 ≈ 0.386` — about 39% — of the source's height
 * (1080 × 0.386 ≈ 417px of the original 1080px), matching spec §3's own
 * "~39% of the source's height" figure. The Android target (2.45:1) is
 * far gentler by comparison: `(16/9) / 2.45 ≈ 0.726`, about 73%.
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
 *  - tile: Android's largest render is 118dp → 354px at 3x device pixel
 *    ratio → rounded to 512.
 *  - banner: the spec's own recommended/minimum SOURCE resolution,
 *    1920×1080 (16:9) — not a value derived from any one render site's
 *    pixel density, because the banner's whole point is to be one generous
 *    source that every display ratio then crops independently (see
 *    `BANNER_ASPECT`). 1920×1080 comfortably exceeds even the sharpest
 *    real render (the 1280px-wide desktop band, 1280×280) at 1x, so it is
 *    never the limiting factor.
 */
export const ARTWORK_OUTPUT_SIZE = {
  tile: { width: 512, height: 512 },
  banner: { width: 1920, height: 1080 },
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
 * 1920×1080 minimum go through one path; the actual pixel dimensions can
 * only be read by decoding the file in a browser, which is why this is
 * split from the deciding logic below — see `getImageDimensions` in
 * `src/lib/imageCrop.ts` for the half that needs an `Image`.
 */

/** Minimum recommended source dimensions per kind. Badge: spec §2,
 * "minimum 512×512px (1024×1024 recommended...)". Banner: spec §3,
 * "min 1920×1080". Falling short of these is a warning, never a block —
 * nothing here throws or rejects a file for being under this size. */
export const MIN_SOURCE_DIMENSIONS: Record<ArtworkKind, { width: number; height: number }> = {
  tile: { width: 512, height: 512 },
  banner: { width: 1920, height: 1080 },
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
