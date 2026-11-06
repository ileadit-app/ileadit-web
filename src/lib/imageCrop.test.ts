import { afterEach, describe, expect, it, vi } from "vitest";
import { renderCroppedImage } from "./imageCrop";

/**
 * jsdom decodes no images and draws no canvas, so `Image` and the canvas
 * are stubbed. That is deliberate and narrow: what this pins is the
 * contract that matters for COMP-BRAND-1 — the output canvas is the full
 * `ARTWORK_OUTPUT_SIZE` for the kind (banner 2400 x 800) and the chosen
 * source rect is drawn into all of it — not the browser's own rendering.
 */

function stubBrowser() {
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal("Image", FakeImage);

  const drawImage = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage, imageSmoothingEnabled: false, imageSmoothingQuality: "low" }),
    toBlob: (cb: (blob: Blob | null) => void) => cb(new Blob(["x"])),
  };
  const realCreateElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) =>
    tag === "canvas" ? (canvas as unknown as HTMLCanvasElement) : realCreateElement(tag),
  );
  return { canvas, drawImage };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("renderCroppedImage — output size", () => {
  it("renders the banner at 2400 x 800 (3:1), filling the canvas with the chosen source rect", async () => {
    const { canvas, drawImage } = stubBrowser();
    const area = { x: 100, y: 50, width: 3000, height: 1000 };

    const { mimeType } = await renderCroppedImage("data:image/png;base64,AAAA", area, "banner", "image/png");

    expect(canvas.width).toBe(2400);
    expect(canvas.height).toBe(800);
    expect(canvas.width / canvas.height).toBe(3);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 100, 50, 3000, 1000, 0, 0, 2400, 800);
    expect(mimeType).toBe("image/jpeg");
  });

  it("renders the logo square at 512 x 512, unchanged", async () => {
    const { canvas } = stubBrowser();

    await renderCroppedImage("data:image/png;base64,AAAA", { x: 0, y: 0, width: 600, height: 600 }, "tile", "image/png");

    expect(canvas.width).toBe(512);
    expect(canvas.height).toBe(512);
  });
});
