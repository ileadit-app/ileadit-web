"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import type { BannerGuides } from "@/lib/competitionArtwork";
import type { CropArea } from "@/lib/imageCrop";

/**
 * Interactive crop/reframe, wrapping `react-easy-crop` (v6).
 *
 * The library rather than a hand-rolled cropper because the hard parts —
 * pinch-zoom, pointer capture across the whole gesture, wheel zoom,
 * keyboard nudging, and keeping the crop rect inside the image at every
 * zoom level — are exactly where a hand-rolled one goes subtly wrong on
 * touch. It is the maintained, dependency-free option (its only peers are
 * react and react-dom, both already here) and it needs no other library
 * to work; `package.json` had nothing that fit, so this is the one
 * dependency this feature adds.
 *
 * Input modalities, all three of which work:
 *  - mouse: drag to pan, wheel to zoom, or the zoom slider;
 *  - touch: drag to pan, pinch to zoom, or the zoom slider;
 *  - keyboard: the crop surface is focusable (the library renders it with
 *    `tabIndex={0}`) and arrow keys nudge the image; the zoom slider is a
 *    native `<input type="range">`, so it is arrow-key operable too.
 *
 * Rendered in a native `<dialog>` opened with `showModal()`, which is
 * what provides the focus trap, the inert background and the Escape-to-
 * close behaviour. Hand-rolling those is the usual source of modal
 * accessibility bugs, and the platform already has them.
 */

const LOGO_OVERLAP_NOTE =
  "The tinted corner is where the round logo sits over the banner in the app. Keep anything important out of it.";

export function ImageCropDialog({
  open,
  imageSrc,
  aspect,
  cropShape = "rect",
  title,
  instructions,
  guides,
  guidesNote,
  confirmLabel = "Use this crop",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  imageSrc: string;
  aspect: number;
  cropShape?: "rect" | "round";
  title: string;
  instructions: string;
  /** When given, draws the banner guides over the crop frame: a dashed
   * safe-zone box plus a tinted bottom-left logo-overlap area. See
   * `BANNER_GUIDES` in `src/lib/competitionArtwork.ts`. */
  guides?: BannerGuides;
  /** Plain-words legend for the two guides, shown under the cropper. */
  guidesNote?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (area: CropArea) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropSize, setCropSize] = useState<{ width: number; height: number } | null>(null);
  const [areaPixels, setAreaPixels] = useState<CropArea | null>(null);

  // A new image starts from a clean pan/zoom rather than inheriting the
  // previous one's, which would land the crop somewhere arbitrary.
  //
  // Done with React's adjust-state-during-render pattern, NOT a
  // `useEffect([imageSrc])`. The effect version also fires on mount, and
  // child effects commit before parent ones — so the cropper's first
  // `onCropComplete` (which sets `areaPixels`) was immediately undone by
  // this reset, leaving "Use this crop" permanently disabled until the
  // user happened to touch the image. Caught by
  // `ArtworkUploadField.test.tsx`, where the stub cropper reports its
  // rect on mount and nothing ever touches it again.
  const [lastImageSrc, setLastImageSrc] = useState(imageSrc);
  if (lastImageSrc !== imageSrc) {
    setLastImageSrc(imageSrc);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAreaPixels(null);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // `showModal` is guarded for environments without the dialog API
    // (jsdom before 26, very old Safari) — there the dialog still renders
    // and is operable, just without the platform focus trap.
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const onCropComplete = useCallback((_area: Area, croppedAreaPixels: Area) => {
    // Only writes state when the rect actually moved. `react-easy-crop`
    // can emit the same area more than once (it re-emits on resize and on
    // any prop change), and an unconditional `setState` there turns a
    // benign duplicate into a re-render loop.
    setAreaPixels((previous) =>
      previous &&
      previous.x === croppedAreaPixels.x &&
      previous.y === croppedAreaPixels.y &&
      previous.width === croppedAreaPixels.width &&
      previous.height === croppedAreaPixels.height
        ? previous
        : croppedAreaPixels,
    );
  }, []);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="crop-dialog-title"
      onCancel={(e) => {
        e.preventDefault(); // Let React own the open state, not the DOM.
        onCancel();
      }}
      className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-3xl border border-border bg-card p-0 text-foreground backdrop:bg-brand-navy-deep/70"
    >
      <div className="p-5 sm:p-6">
        <h2 id="crop-dialog-title" className="text-lg font-extrabold text-foreground">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{instructions}</p>

        <div className="relative mt-4 h-64 overflow-hidden rounded-xl bg-brand-navy-deep sm:h-80">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={cropShape === "rect"}
            restrictPosition
            minZoom={1}
            maxZoom={4}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropSizeChange={setCropSize}
            onCropComplete={onCropComplete}
          />
          {guides && cropSize ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className="relative"
                data-testid="banner-guides"
                style={{ width: cropSize.width, height: cropSize.height }}
              >
                {/* Logo-overlap area: bottom-left, where the round logo
                    sits over the banner in the app. Tinted, not dashed, so
                    the two guides read as different things. */}
                <div
                  data-testid="banner-logo-overlap"
                  className="absolute bottom-0 left-0 border border-brand-coral/80 bg-brand-coral/35"
                  style={{
                    width: `${guides.logoOverlap.width * 100}%`,
                    height: `${guides.logoOverlap.height * 100}%`,
                  }}
                />
                <div
                  data-testid="banner-safe-zone"
                  className="absolute rounded-sm border-2 border-dashed border-brand-gold/90"
                  style={{
                    left: `${guides.safeZone.insetX * 100}%`,
                    right: `${guides.safeZone.insetX * 100}%`,
                    top: `${guides.safeZone.insetY * 100}%`,
                    bottom: `${guides.safeZone.insetY * 100}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>

        {guides && guidesNote ? (
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span
                className="mt-0.5 inline-block h-3 w-5 shrink-0 rounded-sm border-2 border-dashed border-brand-gold/90"
                aria-hidden="true"
              />
              <span>{guidesNote}</span>
            </li>
            <li className="flex items-start gap-2">
              <span
                className="mt-0.5 inline-block h-3 w-5 shrink-0 border border-brand-coral/80 bg-brand-coral/35"
                aria-hidden="true"
              />
              <span>{LOGO_OVERLAP_NOTE}</span>
            </li>
          </ul>
        ) : null}

        <div className="mt-4">
          <label htmlFor="crop-zoom" className="text-sm font-semibold text-foreground">
            Zoom
          </label>
          <input
            id="crop-zoom"
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-valuetext={`${zoom.toFixed(1)} times`}
            className="mt-1.5 w-full accent-brand-gold"
          />
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!areaPixels}
            onClick={() => areaPixels && onConfirm(areaPixels)}
            className="inline-flex h-11 items-center justify-center rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold px-5 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed disabled:border-transparent disabled:bg-cta-disabled disabled:text-cta-disabled-foreground"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
