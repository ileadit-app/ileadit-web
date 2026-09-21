"use client";

import { useEffect, useRef } from "react";

/**
 * A small, reusable confirmation dialog for actions that need more than a
 * plain `window.confirm()` can offer — specifically, a STYLED destructive
 * action button. `window.confirm`'s browser-native chrome cannot be
 * restyled at all, so it can never carry the coral (`#D14451`)
 * destructive-action colour Lacey's design system requires for a genuinely
 * consequential action (WEB-4 item 3: leaving an ACTIVE competition loses
 * the player's points in it and blocks re-joining — a plain "OK/Cancel"
 * browser prompt undersells that). Built on the same native `<dialog>` +
 * `showModal()` pattern as `ImageCropDialog.tsx` for the same reason: the
 * platform already provides the focus trap, inert background and
 * Escape-to-close behaviour, so there is no reason to hand-rebuild them.
 *
 * Not every confirmation in this codebase needs to be migrated to this —
 * a low-stakes, reversible action (e.g. leaving a SCHEDULED competition,
 * which costs nothing and can be rejoined any time) is left on
 * `window.confirm` deliberately; introducing this component doesn't imply
 * every existing confirm should be swapped in the same ticket.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  pendingLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Coral fill + white text (4.51:1) per the CTA colour decision, instead
   * of the default gold/navy primary button. */
  destructive?: boolean;
  pending?: boolean;
  pendingLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  const confirmClassName = destructive
    ? "inline-flex h-11 items-center justify-center rounded-full bg-destructive px-5 text-sm font-bold text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed disabled:bg-cta-disabled disabled:text-cta-disabled-foreground"
    : "inline-flex h-11 items-center justify-center rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold px-5 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed disabled:border-transparent disabled:bg-cta-disabled disabled:text-cta-disabled-foreground";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-dialog-title"
      onCancel={(e) => {
        e.preventDefault(); // Let React own the open state, not the DOM.
        onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl border border-border bg-card p-0 text-foreground backdrop:bg-brand-navy-deep/70"
    >
      <div className="p-5 sm:p-6">
        <h2 id="confirm-dialog-title" className="text-lg font-extrabold text-foreground">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={pending} className={confirmClassName}>
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
