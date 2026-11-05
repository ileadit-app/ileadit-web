// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  ARTWORK_OUTPUT_SIZE,
  BANNER_APP_DETAIL_ASPECT,
  BANNER_ASPECT,
  BANNER_GUIDES,
  BANNER_UPLOAD_GUIDANCE,
  MAX_SOURCE_FILE_BYTES_BY_KIND,
  MIN_SOURCE_DIMENSIONS,
  TILE_ASPECT,
  type ArtworkFileLike,
  type ArtworkKind,
  artworkAspect,
  artworkOutputMimeType,
  artworkStoragePath,
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

  it("flags a banner source under 1200×400, and never warns on a 2400×800 upload", () => {
    expect(isBelowMinimumResolution("banner", 1199, 400)).toBe(true);
    expect(isBelowMinimumResolution("banner", 1200, 399)).toBe(true);
    expect(isBelowMinimumResolution("banner", 1200, 400)).toBe(false);
    expect(isBelowMinimumResolution("banner", 2400, 800)).toBe(false);
  });

  it("the banner minimum is exactly half the output size, at the same 3:1 shape", () => {
    expect(MIN_SOURCE_DIMENSIONS.banner).toEqual({ width: 1200, height: 400 });
    expect(MIN_SOURCE_DIMENSIONS.banner.width * 2).toBe(ARTWORK_OUTPUT_SIZE.banner.width);
    expect(MIN_SOURCE_DIMENSIONS.banner.height * 2).toBe(ARTWORK_OUTPUT_SIZE.banner.height);
  });

  it("names the actual minimum for the kind, not a generic message", () => {
    expect(lowResolutionWarning("tile")).toContain("512×512");
    expect(lowResolutionWarning("banner")).toContain("1200×400");
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

  it("the banner is the one approved format: 3:1, output 2400×800 (COMP-BRAND-1) — the 16:9 crop is superseded", () => {
    expect(BANNER_ASPECT).toBe(3);
    expect(ARTWORK_OUTPUT_SIZE.banner).toEqual({ width: 2400, height: 800 });
    expect(BANNER_ASPECT).not.toBeCloseTo(16 / 9, 1);
  });

  it("the upload guidance copy states the same format the crop actually produces", () => {
    const { width, height } = ARTWORK_OUTPUT_SIZE.banner;
    expect(BANNER_UPLOAD_GUIDANCE).toContain(`${width} × ${height} px (3:1)`);
  });
});

describe("banner crop-dialog guides", () => {
  it("the safe zone is inset 80/1200 each side and 80/400 top and bottom", () => {
    expect(BANNER_GUIDES.safeZone.insetX).toBeCloseTo(80 / 1200, 10);
    expect(BANNER_GUIDES.safeZone.insetY).toBeCloseTo(80 / 400, 10);
  });

  it("the logo-overlap area is the bottom-left 300×120 of a 1200×400 banner", () => {
    expect(BANNER_GUIDES.logoOverlap.width).toBeCloseTo(300 / 1200, 10);
    expect(BANNER_GUIDES.logoOverlap.height).toBeCloseTo(120 / 400, 10);
  });

  it("the guides land on whole pixels of the 2400×800 output", () => {
    const { width, height } = ARTWORK_OUTPUT_SIZE.banner;
    expect(BANNER_GUIDES.safeZone.insetX * width).toBeCloseTo(160, 6);
    expect(BANNER_GUIDES.safeZone.insetY * height).toBeCloseTo(160, 6);
    expect(BANNER_GUIDES.logoOverlap.width * width).toBeCloseTo(600, 6);
    expect(BANNER_GUIDES.logoOverlap.height * height).toBeCloseTo(240, 6);
  });

  it("the horizontal safe-zone inset is exactly what the app's 13:5 details crop trims from each side", () => {
    // 3:1 -> 13:5 (2.6:1) keeps the full height and trims the sides: the
    // visible width fraction is 2.6 / 3, so each side loses
    // (1 - 2.6/3) / 2 = 1/15 = 80/1200 — the safe zone's own x inset.
    const visibleWidth = BANNER_APP_DETAIL_ASPECT / BANNER_ASPECT;
    expect(BANNER_GUIDES.safeZone.insetX).toBeCloseTo((1 - visibleWidth) / 2, 10);
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
