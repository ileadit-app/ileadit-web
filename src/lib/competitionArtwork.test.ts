// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  ARTWORK_OUTPUT_SIZE,
  BANNER_ASPECT,
  MAX_SOURCE_FILE_BYTES,
  MEASURED_BANNER_DISPLAY_RATIOS,
  TILE_ASPECT,
  artworkAspect,
  artworkOutputMimeType,
  artworkStoragePath,
  bannerSafeAreaFractions,
  createDraftCompetitionId,
  isDraftCompetitionId,
  losesAnimationOnCrop,
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

describe("validateArtworkFile — what may be uploaded", () => {
  it.each(ACCEPTED_IMAGE_MIME_TYPES)("accepts %s", (type) => {
    expect(validateArtworkFile(file({ type }))).toBeNull();
  });

  it("accepts an uppercase mime type (browsers are not consistent about case)", () => {
    expect(validateArtworkFile(file({ type: "IMAGE/JPEG" }))).toBeNull();
  });

  it("rejects SVG by mime type, with its own reason and a message that says WHY", () => {
    const rejection = validateArtworkFile(file({ name: "logo.svg", type: "image/svg+xml" }));
    expect(rejection?.reason).toBe("vector-image");
    // The point of the distinct reason: nobody reading this message should
    // conclude SVG is an oversight to "fix" by widening the allowlist.
    expect(rejection?.message).toMatch(/scripts that run/i);
  });

  it("rejects SVG by filename even when the browser reports no mime type at all", () => {
    // A drag from some file managers arrives with `type === ""`. Falling
    // through to the generic unsupported-type branch would still block it,
    // but this pins that it is recognised AS an SVG.
    expect(validateArtworkFile(file({ name: "logo.svg", type: "" }))?.reason).toBe("vector-image");
    expect(validateArtworkFile(file({ name: "logo.svgz", type: "" }))?.reason).toBe("vector-image");
  });

  it.each(["application/pdf", "image/bmp", "image/tiff", "image/avif", "text/html", ""])(
    "rejects %s as an unsupported type",
    (type) => {
      expect(validateArtworkFile(file({ name: "thing.dat", type }))?.reason).toBe("unsupported-type");
    },
  );

  it("rejects a file over the size cap and says how big it actually is", () => {
    const rejection = validateArtworkFile(file({ size: MAX_SOURCE_FILE_BYTES + 1 }));
    expect(rejection?.reason).toBe("too-large");
    expect(rejection?.message).toContain("10 MB");
  });

  it("accepts a file exactly at the cap (the boundary is inclusive)", () => {
    expect(validateArtworkFile(file({ size: MAX_SOURCE_FILE_BYTES }))).toBeNull();
  });

  it("rejects a zero-byte file before anything tries to decode it", () => {
    expect(validateArtworkFile(file({ size: 0 }))?.reason).toBe("empty");
  });

  it("checks type before size, so a 50 MB SVG is refused as an SVG", () => {
    const rejection = validateArtworkFile(
      file({ name: "huge.svg", type: "image/svg+xml", size: 50 * 1024 * 1024 }),
    );
    expect(rejection?.reason).toBe("vector-image");
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

  it("the provisional banner ratio sits between the measured web extremes", () => {
    // Not an assertion that 3 is right — it is not settled. This only pins
    // that it stays inside the range it was derived from, so a future edit
    // to either the ratio or the measurements cannot quietly put the crop
    // outside every real display shape.
    expect(BANNER_ASPECT).toBeGreaterThan(MEASURED_BANNER_DISPLAY_RATIOS.narrowest);
    expect(BANNER_ASPECT).toBeLessThan(MEASURED_BANNER_DISPLAY_RATIOS.widest);
  });
});

describe("bannerSafeAreaFractions", () => {
  it("derives the visible fractions from the measured display ratios", () => {
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

  it("defaults to the real measured ratios and leaves a genuinely reduced safe area", () => {
    const safe = bannerSafeAreaFractions();
    // If this ever comes back as 1/1, the crop ratio has been changed to
    // something that claims nothing is ever trimmed — which is not true of
    // a full-bleed band, and would make the guide box a lie.
    expect(safe.horizontal).toBeLessThan(1);
    expect(safe.vertical).toBeLessThan(1);
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
