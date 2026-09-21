// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  ARTWORK_OUTPUT_SIZE,
  BANNER_ASPECT,
  MAX_SOURCE_FILE_BYTES_BY_KIND,
  MEASURED_BANNER_DISPLAY_RATIOS,
  MIN_SOURCE_DIMENSIONS,
  TILE_ASPECT,
  type ArtworkFileLike,
  type ArtworkKind,
  artworkAspect,
  artworkOutputMimeType,
  artworkStoragePath,
  bannerSafeAreaFractions,
  createDraftCompetitionId,
  isBelowMinimumResolution,
  isDraftCompetitionId,
  losesAnimationOnCrop,
  lowResolutionWarning,
  validateArtworkFile,
} from "./competitionArtwork";

/**
 * Node environment, not jsdom: every function under test is deliberately
 * free of `File`, `Blob`, `<canvas>` and the Firebase SDK, and the
 * `ArtworkFileLike` interface exists precisely so these tests can pass
 * plain objects. The browser-only half (`src/lib/imageCrop.ts`) is not
 * tested here — see that file's header for why a jsdom test of it would
 * only pin its own mock.
 */

function file(overrides: Partial<{ name: string; type: string; size: number }> = {}) {
  return { name: "artwork.png", type: "image/png", size: 1024, ...overrides };
}

/** `validateArtworkFile` takes a `kind` now (the badge and banner have
 * different size caps — see `MAX_SOURCE_FILE_BYTES_BY_KIND`). Defaults to
 * "tile" here since most of the tests below are about format/emptiness
 * rules that do not vary by kind; tests about the size cap pass `kind`
 * explicitly. */
function validate(overrides: Partial<ArtworkFileLike> = {}, kind: ArtworkKind = "tile") {
  return validateArtworkFile(file(overrides), kind);
}

describe("validateArtworkFile — what may be uploaded", () => {
  it.each(ACCEPTED_IMAGE_MIME_TYPES)("accepts %s", (type) => {
    expect(validate({ type })).toBeNull();
  });

  it("accepts an uppercase mime type (browsers are not consistent about case)", () => {
    expect(validate({ type: "IMAGE/JPEG" })).toBeNull();
  });

  it("rejects SVG by mime type, with its own reason and a message that says WHY", () => {
    const rejection = validate({ name: "logo.svg", type: "image/svg+xml" });
    expect(rejection?.reason).toBe("vector-image");
    // The point of the distinct reason: nobody reading this message should
    // conclude SVG is an oversight to "fix" by widening the allowlist.
    expect(rejection?.message).toMatch(/scripts that run/i);
  });

  it("rejects SVG by filename even when the browser reports no mime type at all", () => {
    // A drag from some file managers arrives with `type === ""`. Falling
    // through to the generic unsupported-type branch would still block it,
    // but this pins that it is recognised AS an SVG.
    expect(validate({ name: "logo.svg", type: "" })?.reason).toBe("vector-image");
    expect(validate({ name: "logo.svgz", type: "" })?.reason).toBe("vector-image");
  });

  it.each(["application/pdf", "image/bmp", "image/tiff", "image/avif", "text/html", ""])(
    "rejects %s as an unsupported type",
    (type) => {
      expect(validate({ name: "thing.dat", type })?.reason).toBe("unsupported-type");
    },
  );

  it("rejects a zero-byte file before anything tries to decode it", () => {
    expect(validate({ size: 0 })?.reason).toBe("empty");
  });

  it("checks type before size, so a 50 MB SVG is refused as an SVG", () => {
    const rejection = validate({ name: "huge.svg", type: "image/svg+xml", size: 50 * 1024 * 1024 });
    expect(rejection?.reason).toBe("vector-image");
  });

  // Per-kind size caps — spec §2 (badge, 2MB) / §3 (banner, 4MB). These
  // replaced a single flat 10MB cap that applied to both kinds; a
  // regression back to a shared cap would show up here as one of the two
  // `it.each` rows failing at a boundary the other kind's own cap doesn't
  // share.
  describe.each<[ArtworkKind, number, string]>([
    ["tile", MAX_SOURCE_FILE_BYTES_BY_KIND.tile, "2 MB"],
    ["banner", MAX_SOURCE_FILE_BYTES_BY_KIND.banner, "4 MB"],
  ])("size cap for %s", (kind, maxBytes, label) => {
    it(`accepts a file exactly at the ${label} cap (the boundary is inclusive)`, () => {
      expect(validate({ size: maxBytes }, kind)).toBeNull();
    });

    it(`rejects a file one byte over the ${label} cap, naming the threshold`, () => {
      const rejection = validate({ size: maxBytes + 1 }, kind);
      expect(rejection?.reason).toBe("too-large");
      expect(rejection?.message).toContain(label);
    });

    it("does not use the OTHER kind's cap", () => {
      const otherKind: ArtworkKind = kind === "tile" ? "banner" : "tile";
      const otherMax = MAX_SOURCE_FILE_BYTES_BY_KIND[otherKind];
      if (otherMax <= maxBytes) return; // only meaningful when this kind's cap is the larger one
      // A file between the two caps must be accepted for this (larger-cap)
      // kind and rejected for the other — proving the two are genuinely
      // independent, not one constant read twice.
      expect(validate({ size: maxBytes }, kind)).toBeNull();
      expect(validate({ size: otherMax + 1 }, otherKind)?.reason).toBe("too-large");
    });
  });
});

describe("minimum source resolution — a soft, non-blocking warning (spec §2/§3/§4)", () => {
  it("flags a tile source under 512×512", () => {
    expect(isBelowMinimumResolution("tile", 511, 512)).toBe(true);
    expect(isBelowMinimumResolution("tile", 512, 511)).toBe(true);
    expect(isBelowMinimumResolution("tile", 512, 512)).toBe(false);
  });

  it("flags a banner source under 1920×1080", () => {
    expect(isBelowMinimumResolution("banner", 1919, 1080)).toBe(true);
    expect(isBelowMinimumResolution("banner", 1920, 1079)).toBe(true);
    expect(isBelowMinimumResolution("banner", 1920, 1080)).toBe(false);
  });

  it("names the actual minimum for the kind, not a generic message", () => {
    expect(lowResolutionWarning("tile")).toContain("512×512");
    expect(lowResolutionWarning("banner")).toContain("1920×1080");
  });

  it("reads its numbers from MIN_SOURCE_DIMENSIONS, not a second hand-copied pair", () => {
    expect(lowResolutionWarning("banner")).toContain(`${MIN_SOURCE_DIMENSIONS.banner.width}`);
  });
});

describe("losesAnimationOnCrop", () => {
  it("is true only for GIF", () => {
    expect(losesAnimationOnCrop(file({ type: "image/gif" }))).toBe(true);
    expect(losesAnimationOnCrop(file({ type: "image/png" }))).toBe(false);
  });
});

describe("aspect ratios", () => {
  it("the tile is 1:1 — square on web and on all five Android render sites", () => {
    expect(TILE_ASPECT).toBe(1);
    expect(artworkAspect("tile")).toBe(1);
  });

  it("the banner output size actually matches BANNER_ASPECT", () => {
    // Guards the one way these two constants can silently disagree: someone
    // changing the ratio and not the pixel dimensions, which would produce
    // a crop rect and an output canvas of different shapes and squash
    // every banner.
    const { width, height } = ARTWORK_OUTPUT_SIZE.banner;
    expect(width / height).toBeCloseTo(BANNER_ASPECT, 10);
    expect(artworkAspect("banner")).toBe(BANNER_ASPECT);
  });

  it("the tile output size is square", () => {
    expect(ARTWORK_OUTPUT_SIZE.tile.width).toBe(ARTWORK_OUTPUT_SIZE.tile.height);
  });

  // The old provisional 3:1 crop (a compromise BETWEEN the measured web
  // extremes — see the git history of this file for that version of the
  // test) has been replaced by the spec's settled answer: a generous 16:9
  // SOURCE, narrower than every real display ratio, plus a safe-area
  // contract computed against the widest one. These two tests pin THAT
  // relationship, not the old one — either would fail if the ratio ever
  // silently reverted to 3, since 3 is neither 16:9 nor narrower than the
  // measured narrowest (1.95).
  it("the banner source contract is 16:9 (1920×1080) — the spec's settled answer, not the old provisional 3:1", () => {
    expect(BANNER_ASPECT).toBeCloseTo(16 / 9, 10);
    expect(BANNER_ASPECT).not.toBeCloseTo(3, 1);
    expect(ARTWORK_OUTPUT_SIZE.banner).toEqual({ width: 1920, height: 1080 });
  });

  it("16:9 is narrower than every measured real display ratio, so object-cover always keeps the full width", () => {
    // This is the property the whole "generous source" strategy depends
    // on: unlike the old 3:1 compromise (which sat BETWEEN the measured
    // extremes and so lost width on narrow displays too), 16:9 sits below
    // BOTH of them — width is never trimmed on any real surface, only
    // height, which is what makes a single, purely-vertical safe area
    // guide (see `bannerSafeAreaFractions`) an honest promise.
    expect(BANNER_ASPECT).toBeLessThan(MEASURED_BANNER_DISPLAY_RATIOS.narrowest);
    expect(BANNER_ASPECT).toBeLessThan(MEASURED_BANNER_DISPLAY_RATIOS.widest);
  });
});

describe("bannerSafeAreaFractions", () => {
  it("derives the visible fractions from arbitrary display ratios (illustrative numbers, not the live constants)", () => {
    const safe = bannerSafeAreaFractions(3, { narrowest: 1.95, widest: 4.5 });
    expect(safe.horizontal).toBeCloseTo(0.65, 5); // 1.95 / 3
    expect(safe.vertical).toBeCloseTo(3 / 4.5, 5);
  });

  it("clamps at 1 — nothing is ever more than fully visible", () => {
    const safe = bannerSafeAreaFractions(3, { narrowest: 4, widest: 2 });
    expect(safe.horizontal).toBe(1);
    expect(safe.vertical).toBe(1);
  });

  it("a crop at exactly one extreme is fully visible in that dimension", () => {
    const ratios = { narrowest: 2, widest: 5 };
    expect(bannerSafeAreaFractions(2, ratios).horizontal).toBe(1);
    expect(bannerSafeAreaFractions(5, ratios).vertical).toBe(1);
  });

  it("defaults to the real measured ratios: full width always survives, height is the real constraint", () => {
    // With the spec's 16:9 crop, every measured display ratio (1.95
    // through ~4.57) is WIDER than the crop, so `object-cover` always
    // keeps the full width (horizontal === 1) and only ever trims top and
    // bottom. This is a genuine behaviour change from the old 3:1 ratio,
    // which sat between the measured extremes and so lost width on the
    // narrowest ones too — if this ever comes back as < 1, either the
    // ratio changed or this safe-area contract silently reverted to the
    // old ambiguous-tradeoff shape.
    const safe = bannerSafeAreaFractions();
    expect(safe.horizontal).toBe(1);
    expect(safe.vertical).toBeLessThan(1);
  });

  it("matches the spec's own arithmetic: ~39% of the source height survives the widest (desktop) target", () => {
    // Spec §3: "cover-cropped into the widest target (4.6:1 desktop web),
    // only the center ~39% of the source's height stays visible
    // (1080 × 1.78/4.6 ≈ 418px of the original 1080px)."
    const safe = bannerSafeAreaFractions();
    expect(safe.vertical).toBeCloseTo(0.39, 2);
  });

  it("matches the spec's own arithmetic: ~73% of the source height survives the Android target (2.45:1)", () => {
    // Spec §3: "Into the Android target (2.45:1), center ~73% of the
    // height stays visible." Android's 2.45:1 isn't one of
    // `MEASURED_BANNER_DISPLAY_RATIOS` (that record is web-breakpoint
    // derived), so it's passed explicitly here rather than assumed to be
    // covered by the default ratios.
    const safe = bannerSafeAreaFractions(BANNER_ASPECT, { narrowest: 2.45, widest: 2.45 });
    expect(safe.vertical).toBeCloseTo(0.73, 2);
  });
});

describe("draft competition ids — the upload-before-the-id-exists path", () => {
  it("is prefixed so an orphan is identifiable from its storage path alone", () => {
    const id = createDraftCompetitionId();
    expect(id.startsWith("draft-")).toBe(true);
    expect(isDraftCompetitionId(id)).toBe(true);
  });

  it("is unique across calls", () => {
    const ids = new Set(Array.from({ length: 200 }, () => createDraftCompetitionId()));
    expect(ids.size).toBe(200);
  });

  it("does not mistake a real engine id for a draft", () => {
    expect(isDraftCompetitionId("aB3xY9qLmN0pQrSt")).toBe(false);
  });

  it("is a safe storage path segment, so artworkStoragePath never rejects one", () => {
    expect(() => artworkStoragePath(createDraftCompetitionId(), "tile", "image/png")).not.toThrow();
  });
});

describe("artworkStoragePath", () => {
  it("writes into competitions/{id}/ — the folder the live storage rule grants admins", () => {
    const path = artworkStoragePath("draft-abc", "banner", "image/jpeg", 1_700_000_000_000);
    expect(path).toBe("competitions/draft-abc/banner-1700000000000.jpg");
  });

  it("uses the OUTPUT extension, which is not always the source's", () => {
    expect(artworkStoragePath("draft-abc", "tile", "image/png", 1)).toBe(
      "competitions/draft-abc/tile-1.png",
    );
  });

  it("timestamps the filename so replacing an image cannot hit a cached URL", () => {
    const first = artworkStoragePath("draft-abc", "tile", "image/png", 1);
    const second = artworkStoragePath("draft-abc", "tile", "image/png", 2);
    expect(first).not.toBe(second);
  });

  it.each(["../other", "a/b", "", "has space", "x?y", "..", "draft-abc/../../x"])(
    "throws on an id that could escape the folder: %j",
    (id) => {
      expect(() => artworkStoragePath(id, "tile", "image/png")).toThrow(/Unsafe competition id/);
    },
  );

  it("throws on an output mime type it has no extension for", () => {
    expect(() => artworkStoragePath("draft-abc", "tile", "image/webp")).toThrow(
      /Unsupported output mime type/,
    );
  });
});

describe("artworkOutputMimeType", () => {
  it("keeps the tile as PNG when the source could be transparent", () => {
    // The tile is masked into a circle over an arbitrary background; a
    // transparent logo re-encoded as JPEG gains opaque corners.
    expect(artworkOutputMimeType("tile", "image/png")).toBe("image/png");
    expect(artworkOutputMimeType("tile", "image/webp")).toBe("image/png");
    expect(artworkOutputMimeType("tile", "image/gif")).toBe("image/png");
  });

  it("encodes a JPEG tile as JPEG — there is no alpha to preserve", () => {
    expect(artworkOutputMimeType("tile", "image/jpeg")).toBe("image/jpeg");
  });

  it("always encodes the banner as JPEG, whatever the source", () => {
    for (const type of ACCEPTED_IMAGE_MIME_TYPES) {
      expect(artworkOutputMimeType("banner", type)).toBe("image/jpeg");
    }
  });
});
