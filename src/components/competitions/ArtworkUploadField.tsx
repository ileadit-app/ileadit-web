"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { ImageCropDialog } from "./ImageCropDialog";
import {
  ARTWORK_FILE_ACCEPT,
  MAX_SOURCE_FILE_BYTES,
  artworkAspect,
  artworkStoragePath,
  bannerSafeAreaFractions,
  losesAnimationOnCrop,
  validateArtworkFile,
  type ArtworkKind,
} from "@/lib/competitionArtwork";
import { deleteCompetitionArtwork, uploadCompetitionArtwork } from "@/lib/artworkUpload";
import { artworkUploadFailureMessage } from "@/lib/artworkUploadErrors";
import { readFileAsDataUrl, renderCroppedImage, type CropArea } from "@/lib/imageCrop";

/**
 * Drag-and-drop (or click-to-browse) upload for one piece of competition
 * artwork, with crop and progress. Replaces the free-text image URL input
 * this form used to have for `imageUrl` and `backgroundImageUrl`.
 *
 * ── Accessibility ─────────────────────────────────────────────────────
 * The drop zone is a real `<label>` wrapping a real, focusable
 * `<input type="file">`, not a `<div>` with drag handlers bolted on.
 * That is deliberate: drag-and-drop alone is unusable with a keyboard,
 * with a screen reader, and on touch, so the pointer-only affordance is
 * layered ON TOP of a control that already works without it. Click,
 * Enter, Space and the mobile file picker all go through the native
 * input; the drag handlers on the wrapper are pure enhancement, and
 * removing them would cost nothing but convenience.
 *
 * Progress and failures are announced through a polite live region;
 * failures additionally render as `role="alert"`. A failure is never only
 * a console message — see `src/lib/artworkUpload.ts`, which resolves
 * rather than rejects so there is no path where an upload dies quietly.
 */

type Phase =
  | { name: "idle" }
  | { name: "cropping"; imageSrc: string; sourceType: string; sourceName: string }
  | { name: "uploading"; percent: number }
  | { name: "preparing" };

export function ArtworkUploadField({
  kind,
  label,
  helperText,
  draftId,
  value,
  onChange,
  disabled,
}: {
  kind: ArtworkKind;
  label: string;
  helperText: string;
  /** The client-minted folder the object is uploaded into — see
   * `createDraftCompetitionId` for why this is not the real id. */
  draftId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const statusId = `${inputId}-status`;
  const helperId = `${inputId}-helper`;

  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelUploadRef = useRef<(() => void) | null>(null);
  // Path of the object currently backing `value`, so replacing or
  // removing the image can delete the one it supersedes instead of
  // leaving it in the bucket forever.
  const uploadedPathRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelUploadRef.current?.();
    };
  }, []);

  const busy = phase.name === "uploading" || phase.name === "preparing";
  const inputsDisabled = disabled || busy;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setNotice(null);

    const rejection = validateArtworkFile(file);
    if (rejection) {
      setError(rejection.message);
      return;
    }

    if (losesAnimationOnCrop(file)) {
      setNotice("Animated GIFs are saved as a single still frame — the frame you crop below.");
    }

    try {
      const imageSrc = await readFileAsDataUrl(file);
      setPhase({ name: "cropping", imageSrc, sourceType: file.type, sourceName: file.name });
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "Could not read that file.");
    }
  }

  async function handleCropConfirm(area: CropArea) {
    if (phase.name !== "cropping") return;
    const { imageSrc, sourceType } = phase;
    setPhase({ name: "preparing" });
    setError(null);

    let blob: Blob;
    let mimeType: string;
    try {
      const rendered = await renderCroppedImage(imageSrc, area, kind, sourceType);
      blob = rendered.blob;
      mimeType = rendered.mimeType;
    } catch (renderError) {
      if (!mountedRef.current) return;
      setPhase({ name: "idle" });
      setError(
        renderError instanceof Error
          ? renderError.message
          : "This browser couldn't prepare the image for upload.",
      );
      return;
    }

    let storagePath: string;
    try {
      storagePath = artworkStoragePath(draftId, kind, mimeType);
    } catch {
      if (!mountedRef.current) return;
      setPhase({ name: "idle" });
      setError("We couldn't work out where to save that image. Reload the page and try again.");
      return;
    }

    setPhase({ name: "uploading", percent: 0 });

    const handle = uploadCompetitionArtwork({
      blob,
      storagePath,
      contentType: mimeType,
      onProgress: (progress) => {
        if (mountedRef.current) setPhase({ name: "uploading", percent: progress.percent });
      },
    });
    cancelUploadRef.current = handle.cancel;

    const outcome = await handle.outcome;
    cancelUploadRef.current = null;
    if (!mountedRef.current) return;

    if (outcome.status === "failure") {
      setPhase({ name: "idle" });
      setError(artworkUploadFailureMessage(outcome.failure));
      return;
    }

    const supersededPath = uploadedPathRef.current;
    uploadedPathRef.current = outcome.storagePath;
    setPhase({ name: "idle" });
    onChange(outcome.downloadUrl);
    if (supersededPath) void deleteCompetitionArtwork(supersededPath);
  }

  function handleRemove() {
    const path = uploadedPathRef.current;
    uploadedPathRef.current = null;
    setError(null);
    setNotice(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
    if (path) void deleteCompetitionArtwork(path);
  }

  const statusText =
    phase.name === "uploading"
      ? `Uploading ${label.toLowerCase()}: ${phase.percent}%`
      : phase.name === "preparing"
        ? "Preparing the image…"
        : value
          ? `${label} uploaded.`
          : "";

  const safeArea = kind === "banner" ? bannerSafeAreaFractions() : undefined;

  return (
    <div>
      <span className="text-sm font-semibold text-foreground">{label}</span>

      <div
        className="mt-1.5"
        onDragEnter={(e) => {
          e.preventDefault();
          if (!inputsDisabled) setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!inputsDisabled) setDragging(true);
        }}
        onDragLeave={(e) => {
          // Only clear when the pointer actually leaves the zone, not when
          // it crosses onto a child element.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (inputsDisabled) return;
          void handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ARTWORK_FILE_ACCEPT}
          disabled={inputsDisabled}
          aria-describedby={`${helperId} ${statusId}`}
          aria-invalid={error ? "true" : undefined}
          className="peer sr-only"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            // Cleared so picking the SAME file again still fires `change`
            // (the browser suppresses it otherwise), which matters after a
            // failed upload the user wants to retry.
            e.target.value = "";
          }}
        />
        <label
          htmlFor={inputId}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-navy ${
            dragging ? "border-brand-gold bg-brand-gold/10" : "border-input bg-background"
          } ${inputsDisabled ? "cursor-not-allowed opacity-60" : "hover:border-primary"} ${
            error ? "border-destructive" : ""
          }`}
        >
          {busy ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : value ? (
            <ImagePlus className="size-6 text-muted-foreground" aria-hidden="true" />
          ) : (
            <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="text-sm font-semibold text-foreground">
            {value ? `Replace ${label.toLowerCase()}` : `Drag an image here, or browse`}
          </span>
          <span className="text-xs text-muted-foreground">
            PNG, JPEG, WebP or GIF, up to {Math.round(MAX_SOURCE_FILE_BYTES / (1024 * 1024))} MB
          </span>
        </label>
      </div>

      {phase.name === "uploading" ? (
        <div className="mt-2">
          <div
            role="progressbar"
            aria-valuenow={phase.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Uploading ${label.toLowerCase()}`}
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-brand-gold transition-[width]"
              style={{ width: `${phase.percent}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => cancelUploadRef.current?.()}
            className="mt-1 text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Cancel upload
          </button>
        </div>
      ) : null}

      {/* Polite, not assertive: progress updates should not interrupt a
          screen reader mid-sentence. The failure below is the assertive
          one. */}
      <p id={statusId} className="sr-only" aria-live="polite">
        {statusText}
      </p>

      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {notice && !error ? <p className="mt-1.5 text-xs text-muted-foreground">{notice}</p> : null}

      <p id={helperId} className="mt-1 text-xs text-muted-foreground">
        {helperText}
      </p>

      {value && !busy ? (
        <button
          type="button"
          onClick={handleRemove}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-destructive underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          Remove {label.toLowerCase()}
        </button>
      ) : null}

      {phase.name === "cropping" ? (
        <ImageCropDialog
          open
          imageSrc={phase.imageSrc}
          aspect={artworkAspect(kind)}
          cropShape={kind === "tile" ? "round" : "rect"}
          title={`Crop the ${label.toLowerCase()}`}
          instructions={
            kind === "tile"
              ? "Drag to reposition, pinch or use the slider to zoom. This one is shown as a circle everywhere in the app, on web and on Android."
              : "Drag to reposition, pinch or use the slider to zoom. This one is stretched across the top of the page, so it is trimmed differently on different screen widths."
          }
          safeArea={safeArea}
          safeAreaNote={
            safeArea
              ? "Everything inside the dashed box is visible on every screen — phone through desktop. Outside it, parts get trimmed depending on the window width. Keep anything that matters (logos, faces, text) inside."
              : undefined
          }
          onCancel={() => setPhase({ name: "idle" })}
          onConfirm={(area) => void handleCropConfirm(area)}
        />
      ) : null}
    </div>
  );
}
