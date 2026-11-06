import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ArtworkUploadField } from "./ArtworkUploadField";
import { LOGO_PLATE_GUIDE, MAX_SOURCE_FILE_BYTES_BY_KIND } from "@/lib/competitionArtwork";

/**
 * What a person actually sees when they pick a file — asserted on the
 * rendered output, never on a resolved value, for the same reason
 * `CreateCompetitionForm.test.tsx` gives: an upload that fails while the
 * UI says nothing is the bug worth catching.
 *
 * Three mocks, each at a boundary that cannot run in jsdom, and none of
 * them standing in for logic under test:
 *
 * 1. `react-easy-crop` — needs real layout and pointer events. Replaced
 *    with a stub that reports a fixed crop rect, so the crop dialog's
 *    "Use this crop" button becomes enabled and the flow continues. The
 *    library's own behaviour is not what these tests are about.
 * 2. `@/lib/imageCrop` — `FileReader` plus `<canvas>` image decoding and
 *    `toBlob`, none of which jsdom implements.
 * 3. `@/lib/artworkUpload` — the network. Driven per-test to produce a
 *    success or a failure.
 *
 * `src/lib/competitionArtwork.ts` (validation, the draft id, the storage
 * path) and `src/lib/artworkUploadErrors.ts` (the message wording) both
 * run FOR REAL in every test below.
 */

// The props the dialog last handed the cropper, so a test can pin that the
// logo crop is a plain square frame and not a round mask.
const cropperProps: { current: Record<string, unknown> } = { current: {} };

vi.mock("react-easy-crop", async () => {
  const { useEffect } = await import("react");
  return {
    // Named (and capitalised) so eslint's rules-of-hooks sees a component,
    // which it must be — it uses a hook.
    default: function MockCropper(props: {
      onCropComplete?: (a: unknown, b: { x: number; y: number; width: number; height: number }) => void;
      onCropSizeChange?: (size: { width: number; height: number }) => void;
      [key: string]: unknown;
    }) {
      cropperProps.current = props;
      const { onCropComplete, onCropSizeChange } = props;
      // Reported once on mount, not on every render — the real library
      // emits on interaction, and an unconditional call during render
      // would be a mock-only render loop.
      useEffect(() => {
        onCropComplete?.({}, { x: 0, y: 0, width: 400, height: 400 });
        // The real library reports the on-screen crop frame size; the
        // banner guides are positioned inside a box of exactly this size.
        onCropSizeChange?.({ width: 600, height: 200 });
      }, [onCropComplete, onCropSizeChange]);
      return <div data-testid="cropper" />;
    },
  };
});

vi.mock("@/lib/imageCrop", () => ({
  readFileAsDataUrl: vi.fn(async () => "data:image/png;base64,AAAA"),
  renderCroppedImage: vi.fn(async () => ({
    blob: { size: 4096 } as Blob,
    mimeType: "image/png" as const,
  })),
  // Comfortably above every kind's minimum (banner's is the largest, at
  // 1920x1080) so the soft low-resolution notice stays off by default —
  // tests that want it exercise it explicitly by overriding this mock.
  getImageDimensions: vi.fn(async () => ({ width: 4000, height: 4000 })),
}));

const uploadCompetitionArtwork = vi.fn();
const deleteCompetitionArtwork = vi.fn<(path: string) => Promise<boolean>>(async () => true);
vi.mock("@/lib/artworkUpload", () => ({
  uploadCompetitionArtwork: (args: unknown) => uploadCompetitionArtwork(args),
  deleteCompetitionArtwork: (path: string) => deleteCompetitionArtwork(path),
}));

const DRAFT_ID = "draft-0000-1111";

function renderField(onChange = vi.fn()) {
  render(
    <ArtworkUploadField
      kind="tile"
      label="Competition image"
      helperText="The round badge next to the name."
      draftId={DRAFT_ID}
      value={null}
      onChange={onChange}
    />,
  );
  return { onChange, input: screen.getByLabelText(/drag an image here, or browse/i) };
}

function makeFile({ name = "art.png", type = "image/png", size = 2048 } = {}): File {
  const file = new File(["x"], name, { type });
  // Overridden rather than allocating megabytes of real bytes; validation
  // reads `size`, and this is the only way to reach the cap cheaply.
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function pick(input: HTMLElement, file: File) {
  fireEvent.change(input, { target: { files: [file] } });
}

interface ProgressReport {
  bytesTransferred: number;
  totalBytes: number;
  percent: number;
}

/** Drives the mocked upload to one progress tick and then `outcome`. */
function resolveUploadWith(outcome: unknown) {
  uploadCompetitionArtwork.mockImplementation((args: { onProgress?: (p: ProgressReport) => void }) => {
    args.onProgress?.({ bytesTransferred: 50, totalBytes: 100, percent: 50 });
    return { outcome: Promise.resolve(outcome), cancel: vi.fn() };
  });
}

beforeEach(() => {
  uploadCompetitionArtwork.mockReset();
  deleteCompetitionArtwork.mockClear();
});

describe("ArtworkUploadField — client-side rejection, before anything is uploaded", () => {
  it("rejects an SVG with the reason, and uploads nothing", async () => {
    const { input, onChange } = renderField();
    pick(input, makeFile({ name: "logo.svg", type: "image/svg+xml" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/scripts that run/i);
    expect(uploadCompetitionArtwork).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId("cropper")).not.toBeInTheDocument();
  });

  it("rejects a non-image file type, and uploads nothing", async () => {
    const { input } = renderField();
    pick(input, makeFile({ name: "notes.pdf", type: "application/pdf" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/PNG, JPEG, WebP or GIF/i);
    expect(uploadCompetitionArtwork).not.toHaveBeenCalled();
  });

  it("rejects a file over the size cap for its kind, and uploads nothing", async () => {
    const { input } = renderField();
    pick(input, makeFile({ size: MAX_SOURCE_FILE_BYTES_BY_KIND.tile + 1 }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/over 2 MB/i);
    expect(uploadCompetitionArtwork).not.toHaveBeenCalled();
  });

  it("accepts a dropped file, so drag-and-drop goes through the same validation", async () => {
    const { input } = renderField();
    const zone = input.parentElement as HTMLElement;
    fireEvent.drop(zone, { dataTransfer: { files: [makeFile({ name: "x.svg", type: "image/svg+xml" })] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/scripts that run/i);
  });
});

describe("ArtworkUploadField — low-resolution source, a soft warning that never blocks", () => {
  it("warns when the picked image is smaller than the recommended minimum, without blocking the crop", async () => {
    const { getImageDimensions } = await import("@/lib/imageCrop");
    vi.mocked(getImageDimensions).mockResolvedValueOnce({ width: 300, height: 300 });
    const { input } = renderField();

    pick(input, makeFile());

    // The crop dialog still opens — a low-resolution source is a warning,
    // never a rejection.
    expect(await screen.findByTestId("cropper")).toBeInTheDocument();
    expect(await screen.findByText(/smaller than 512×512px/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says nothing when the picked image already meets the minimum", async () => {
    const { input } = renderField();
    pick(input, makeFile());

    await screen.findByTestId("cropper");
    expect(screen.queryByText(/smaller than/i)).not.toBeInTheDocument();
  });
});

describe("ArtworkUploadField — banner crop guides (COMP-BRAND-1)", () => {
  function renderBannerField() {
    render(
      <ArtworkUploadField
        kind="banner"
        label="Background banner"
        helperText="The banner."
        draftId={DRAFT_ID}
        value={null}
        onChange={vi.fn()}
      />,
    );
    return screen.getByLabelText(/drag an image here, or browse/i);
  }

  it("draws the dashed safe zone and the tinted logo-overlap corner", async () => {
    pick(renderBannerField(), makeFile());

    const safeZone = await screen.findByTestId("banner-safe-zone");
    const overlap = screen.getByTestId("banner-logo-overlap");

    // Insets: 80/1200 each side, 80/400 top and bottom.
    expect(parseFloat(safeZone.style.left)).toBeCloseTo((80 / 1200) * 100, 4);
    expect(parseFloat(safeZone.style.right)).toBeCloseTo((80 / 1200) * 100, 4);
    expect(parseFloat(safeZone.style.top)).toBeCloseTo((80 / 400) * 100, 4);
    expect(parseFloat(safeZone.style.bottom)).toBeCloseTo((80 / 400) * 100, 4);
    expect(safeZone.className).toContain("border-dashed");

    // Bottom-left 300x120 of a 1200x400 banner.
    expect(overlap.className).toContain("bottom-0");
    expect(overlap.className).toContain("left-0");
    expect(parseFloat(overlap.style.width)).toBeCloseTo(25, 4);
    expect(parseFloat(overlap.style.height)).toBeCloseTo(30, 4);

    expect(screen.getByText(/round logo sits over the banner/i)).toBeInTheDocument();
  });

  it("logo crop: a square frame with no round mask, the plate circle as a guide, and the new copy", async () => {
    const { input } = renderField();
    pick(input, makeFile());

    await screen.findByTestId("cropper");
    // Square frame: never the library's round mask.
    expect(cropperProps.current.cropShape).toBe("rect");
    expect(cropperProps.current.aspect).toBe(1);
    // Starts with the whole of a square image inside the frame.
    expect(cropperProps.current.objectFit).toBe("cover");
    expect(cropperProps.current.cropSize).toEqual({
      width: LOGO_PLATE_GUIDE.frameSidePx,
      height: LOGO_PLATE_GUIDE.frameSidePx,
    });

    // The plate's ring is drawn through the frame's corners: diameter = side × √2.
    const ring = screen.getByTestId("logo-plate-ring");
    expect(ring.className).toContain("rounded-full");
    expect(parseFloat(ring.style.width)).toBeCloseTo(LOGO_PLATE_GUIDE.frameSidePx * Math.SQRT2, 4);
    expect(parseFloat(ring.style.height)).toBeCloseTo(LOGO_PLATE_GUIDE.frameSidePx * Math.SQRT2, 4);

    // Exact copy from the ticket; the old "shown as a circle" claim is gone.
    expect(
      screen.getByText(
        "Your logo is shown whole on a round white plate in the app. Keep it inside the square; a transparent PNG works best.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/shown as a circle/i)).not.toBeInTheDocument();
  });

  it("banner crop: rect frame, no plate ring", async () => {
    pick(renderBannerField(), makeFile());
    await screen.findByTestId("banner-safe-zone");
    expect(cropperProps.current.cropShape).toBe("rect");
    expect(cropperProps.current.cropSize).toBeUndefined();
    expect(screen.queryByTestId("logo-plate-ring")).not.toBeInTheDocument();
  });

  it("draws no banner guides on the square logo crop", async () => {
    const { input } = renderField();
    pick(input, makeFile());

    await screen.findByTestId("cropper");
    expect(screen.queryByTestId("banner-safe-zone")).not.toBeInTheDocument();
    expect(screen.queryByTestId("banner-logo-overlap")).not.toBeInTheDocument();
  });
});

describe("ArtworkUploadField — the draft-id upload path", () => {
  it("uploads into competitions/{draftId}/ and hands the download URL up", async () => {
    resolveUploadWith({
      status: "success",
      downloadUrl: "https://storage.example/tile.png",
      storagePath: `competitions/${DRAFT_ID}/tile-1.png`,
    });
    const { input, onChange } = renderField();

    pick(input, makeFile());
    fireEvent.click(await screen.findByRole("button", { name: /use this crop/i }));

    await waitFor(() => expect(uploadCompetitionArtwork).toHaveBeenCalled());
    const args = uploadCompetitionArtwork.mock.calls[0][0];
    // The engine mints the real id only after createCompetition returns, so
    // the object HAS to land under a client-minted folder. Pin that it is
    // the competitions/ prefix the live storage rule grants, and that the
    // draft id is what names the folder.
    expect(args.storagePath).toMatch(new RegExp(`^competitions/${DRAFT_ID}/tile-\\d+\\.png$`));
    expect(args.contentType).toBe("image/png");

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("https://storage.example/tile.png"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a progress bar while the upload runs", async () => {
    let resolveOutcome: (v: unknown) => void = () => {};
    uploadCompetitionArtwork.mockImplementation(
      (args: { onProgress?: (p: ProgressReport) => void }) => {
        args.onProgress?.({ bytesTransferred: 40, totalBytes: 100, percent: 40 });
        return { outcome: new Promise((r) => (resolveOutcome = r)), cancel: vi.fn() };
      },
    );
    const { input } = renderField();

    pick(input, makeFile());
    fireEvent.click(await screen.findByRole("button", { name: /use this crop/i }));

    const bar = await screen.findByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "40");

    resolveOutcome({ status: "success", downloadUrl: "https://x/y.png", storagePath: "p" });
    await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
  });
});

describe("ArtworkUploadField — upload failure is visible, not silent", () => {
  it("surfaces a permission refusal with the admin-permission wording", async () => {
    resolveUploadWith({
      status: "failure",
      failure: { code: "unauthorized", storageCode: "storage/unauthorized" },
    });
    const { input, onChange } = renderField();

    pick(input, makeFile());
    fireEvent.click(await screen.findByRole("button", { name: /use this crop/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/admin permission/i);
    // The field must NOT report a URL it does not have.
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("surfaces a generic failure distinctly from the permission one", async () => {
    resolveUploadWith({ status: "failure", failure: { code: "unknown", storageCode: null } });
    const { input, onChange } = renderField();

    pick(input, makeFile());
    fireEvent.click(await screen.findByRole("button", { name: /use this crop/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't upload that image/i);
    expect(alert).not.toHaveTextContent(/admin permission/i);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ArtworkUploadField — accessibility of the drop zone", () => {
  it("is a real file input with an accessible name, not a drag-only div", () => {
    const { input } = renderField();
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("type", "file");
    // Keyboard users reach it by tab and open the picker with Enter/Space;
    // a div with drag handlers gives them nothing.
    expect(input).not.toHaveAttribute("disabled");
  });

  it("only accepts the raster types the rules allow — SVG is not offered in the picker", () => {
    const { input } = renderField();
    const accept = input.getAttribute("accept") ?? "";
    expect(accept).toContain("image/png");
    expect(accept).toContain("image/jpeg");
    expect(accept).toContain("image/webp");
    expect(accept).toContain("image/gif");
    expect(accept).not.toContain("svg");
  });

  it("offers a remove control once an image is set, and deletes the stored object", async () => {
    resolveUploadWith({
      status: "success",
      downloadUrl: "https://storage.example/tile.png",
      storagePath: `competitions/${DRAFT_ID}/tile-9.png`,
    });
    const onChange = vi.fn();
    const { rerender } = render(
      <ArtworkUploadField
        kind="tile"
        label="Competition image"
        helperText="h"
        draftId={DRAFT_ID}
        value={null}
        onChange={onChange}
      />,
    );

    pick(screen.getByLabelText(/drag an image here, or browse/i), makeFile());
    fireEvent.click(await screen.findByRole("button", { name: /use this crop/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("https://storage.example/tile.png"));

    rerender(
      <ArtworkUploadField
        kind="tile"
        label="Competition image"
        helperText="h"
        draftId={DRAFT_ID}
        value="https://storage.example/tile.png"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /remove competition image/i }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    // Removing clears the bucket object too, so an abandoned form leaves
    // at most what the user left behind, not every attempt.
    await waitFor(() =>
      expect(deleteCompetitionArtwork).toHaveBeenCalledWith(`competitions/${DRAFT_ID}/tile-9.png`),
    );
  });
});
