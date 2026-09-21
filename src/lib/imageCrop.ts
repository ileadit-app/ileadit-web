import { ARTWORK_OUTPUT_SIZE, artworkOutputMimeType, type ArtworkKind } from "./competitionArtwork";

/**
 * The browser-only half of the crop: everything that needs an
 * `Image`, a `<canvas>` or a `FileReader`.
 *
 * Kept out of `competitionArtwork.ts` so that module's validation and
 * path logic stays testable under plain Node. Nothing here is unit
 * tested — jsdom implements neither canvas rendering nor image decoding,
 * so a test of `renderCroppedImage` would only pin the mock. Its
 * behaviour is verified by using it; its INPUTS (which mime type, which
 * output size, which pixel rect) all come from functions that are tested.
 */

/** The pixel rectangle `react-easy-crop` reports via `onCropComplete`'s
 * second argument. Same shape as its exported `Area`, redeclared so this
 * module does not depend on the library's types. */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Reads a picked `File` into a data URL for the cropper to display.
 * A data URL rather than `URL.createObjectURL` deliberately: there is no
 * revoke to forget, and the same string feeds both the cropper and the
 * `<img>` the canvas draws from. */
export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read that file."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That image couldn't be opened. It may be damaged."));
    image.src = src;
  });
}

/**
 * Decodes just enough of the picked file to read its pixel dimensions, for
 * the soft "this is smaller than recommended" warning
 * (`isBelowMinimumResolution`/`lowResolutionWarning` in
 * `competitionArtwork.ts`). Not unit tested, for the same reason as
 * `renderCroppedImage` above — jsdom does not implement image decoding, so
 * a test here would only pin a mock of `Image`, not real behaviour.
 */
export async function getImageDimensions(imageSrc: string): Promise<{ width: number; height: number }> {
  const image = await loadImage(imageSrc);
  return { width: image.naturalWidth, height: image.naturalHeight };
}

/**
 * Draws `area` (source pixels) of `imageSrc` into a canvas at the output
 * size for `kind`, and returns it as an encoded blob.
 *
 * The canvas is always the full `ARTWORK_OUTPUT_SIZE`, so a small source
 * is upscaled and a large one downscaled to the same target — the
 * uploaded object has a predictable size regardless of what was dragged
 * in. `imageSmoothingQuality = "high"` because a downscale of a phone
 * photo to 512px with the default is visibly rough.
 */
export async function renderCroppedImage(
  imageSrc: string,
  area: CropArea,
  kind: ArtworkKind,
  sourceMimeType: string,
): Promise<{ blob: Blob; mimeType: "image/png" | "image/jpeg" }> {
  const image = await loadImage(imageSrc);
  const { width, height } = ARTWORK_OUTPUT_SIZE[kind];
  const mimeType = artworkOutputMimeType(kind, sourceMimeType);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser couldn't prepare the image for upload.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    // 0.9 for JPEG; the quality argument is ignored for PNG.
    canvas.toBlob(resolve, mimeType, 0.9),
  );
  if (!blob) throw new Error("This browser couldn't prepare the image for upload.");

  return { blob, mimeType };
}
