"use client";

import { useId } from "react";
import { FileText, Info, Smile, Sun, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { TextField, TextAreaField, ToggleField } from "@/components/forms/fields";
import {
  PRIZE_DESCRIPTION_MAX_LENGTH,
  PRIZE_NAME_SHOWN_HINT,
  PRIZE_TITLE_MAX_LENGTH,
  resizePrizeItems,
  type PrizeFieldErrors,
  type PrizeFormState,
  type PrizeKind,
  type PrizePlaces,
} from "@/lib/prize";

/**
 * Shared editable prize form section (PRZ-W1, W1-mobile; re-ported from the
 * approved v0 design in PRZ-W1-FIX1 — `.ticket-refs/prizes/v0-web/components/
 * competitions/PrizeSection.tsx`). Used by BOTH the creation wizard
 * (`CreateCompetitionForm.tsx`) and the scheduled-competition editor
 * (`PrizeEditPanel.tsx`) — a single source of markup so the two can never
 * drift. Purely controlled: all state lives in the caller's `PrizeFormState`,
 * this component only renders it and reports changes.
 *
 * **Phase 1 scope — deliberately absent from this UI**: digital codes and
 * physical/sponsored prizes (`PrizeKind` values `"code"`/`"physical"`), and
 * the admin-only sponsor section, are Phase 2 (PRZ-W2/W3) and have no control
 * here at all — not disabled, not greyed out, simply never rendered. The
 * kind choice below offers exactly two cards, laid out as the design's
 * 2-column row (the design's own 4-card grid becomes 2 once digital/physical
 * are dropped).
 *
 * **Design kind `bragging` -> engine kind `forfeit`.** The approved design
 * calls this option "Bragging rights"; the engine/Firestore value for it is
 * `"forfeit"` (unchanged from Phase 1's original contract). Only the label
 * changed, not the wire value.
 *
 * **No separate "forfeit loser text" field.** The approved design's bragging
 * state (`BraggingPanel`, no input, just a note) has no field of its own for
 * this — the SAME "Prize name" field used for every kind doubles as the
 * forfeit's description (its own default/placeholder is "Last place buys the
 * first round"). `forfeitLoserText` is therefore derived automatically from
 * the place-1 item's title at submission time (`@/lib/prize`'s
 * `prizeInputFromFormState`), never edited directly here.
 *
 * **Prize photo intentionally omitted.** The design shows an optional
 * "Prize photo" upload field; Phase 1's `Prize` contract (`@/lib/prize.ts`)
 * has no `photoUrl` yet, so rather than build a control that can't be wired
 * to anything real, it's left out entirely — re-add once the engine contract
 * grows a photo field.
 *
 * **Top-3 naming vs. the design.** The design's top-3 state only ever shows
 * ONE shared "Short description" field below the three name fields — it
 * never shows the combination of three names + three descriptions. Since
 * this portal's real `Prize.items[]` carries one description PER place, and
 * collapsing that into a single shared field would silently throw away
 * per-place detail a future reader might reasonably expect to be real,
 * top-3 keeps one description field per place (flagged here, not hidden,
 * per this codebase's usual "unverified/extrapolated, say so" discipline)
 * rather than inventing new shared-field behaviour the design never
 * actually specified for this case.
 *
 * Once a competition has started, the caller must NOT render this component
 * at all — `PrizeEditPanel.tsx` renders a separate read-only summary in that
 * case instead of passing `readOnly` down through every field here, since a
 * disabled-but-still-interactive-looking form is a worse signal than a plain
 * summary card.
 */
export function PrizeSection({
  value,
  onChange,
  errors,
  disabled,
  previewTermsHref,
}: {
  value: PrizeFormState;
  onChange: (next: PrizeFormState) => void;
  errors: PrizeFieldErrors;
  disabled?: boolean;
  /** Link to this competition's own `/prize-terms` preview page. Only
   * available once the competition exists (the edit panel, not the
   * create-new-competition wizard, which has no id yet to link to) — when
   * omitted, the preview row is left out entirely rather than linking
   * somewhere that can't possibly resolve. */
  previewTermsHref?: string;
}) {
  const headingId = useId();
  const who: "winner" | "top3" = value.places === 3 ? "top3" : "winner";

  function setKind(kind: PrizeKind) {
    onChange({ ...value, kind });
  }

  function setWho(nextWho: "winner" | "top3") {
    const places: PrizePlaces = nextWho === "top3" ? 3 : 1;
    onChange({ ...value, places, items: resizePrizeItems(value.items, places) });
  }

  function setItemField(place: 1 | 2 | 3, field: "title" | "description", text: string) {
    onChange({
      ...value,
      items: value.items.map((item) => (item.place === place ? { ...item, [field]: text } : item)),
    });
  }

  const namePlaceholder = value.kind === "forfeit" ? "Last place buys the first round" : "An extra day off";

  return (
    // PRZ-W1-FIX3: the top-3 name/description fields (below) are stacked in
    // ONE column at every width, full stop — no `sm:`/`@min-[...]` breakpoint
    // at all. FIX2 used a Tailwind v4 CONTAINER query
    // (`@min-[640px]:grid-cols-3`, needing the `@container` class on this
    // `<section>`) on the theory that three columns were fine once the
    // SURROUNDING CARD (not the viewport) had the room. In practice, inside
    // the real create-competition form's card width, three name fields plus
    // three description fields side-by-side read as genuinely cramped even
    // at 1280px — see the visual-gate finding and
    // `.ticket-refs/shots/prizes/r3/crop-names-1280.png`. Each place's name
    // field and description field are now grouped together, one place per
    // row, matching the single-winner field style. Don't reintroduce a
    // multi-column grid here without a fresh design sign-off.
    <section aria-labelledby={headingId} className="space-y-5 border-t border-border pt-6">
      <div>
        <h2 id={headingId} className="text-sm font-bold uppercase tracking-wide text-brand-coral">
          Prize
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Entry is always free. A prize never costs players anything.
        </p>
      </div>

      <SwitchField
        label="Add a prize for the winner"
        description="Optional. Leave it off and the competition is just for the glory."
        checked={value.enabled}
        onChange={(enabled) => onChange({ ...value, enabled })}
        disabled={disabled}
      />

      {value.enabled ? (
        <>
          <OptionCards
            legend="What kind of prize is it?"
            value={value.kind}
            onChange={setKind}
            disabled={disabled}
            options={[
              {
                value: "forfeit",
                label: "Bragging rights",
                hint: "Glory or a forfeit. Nothing is delivered.",
                icon: Smile,
              },
              {
                value: "perk",
                label: "A perk",
                hint: "Something you arrange, like an extra day off.",
                icon: Sun,
              },
            ]}
          />

          {who === "winner" ? (
            <TextField
              label="Prize name"
              value={value.items[0]?.title ?? ""}
              onChange={(text) => setItemField(1, "title", text.slice(0, PRIZE_TITLE_MAX_LENGTH))}
              error={errors.items?.[1]?.title}
              required
              maxLength={PRIZE_TITLE_MAX_LENGTH}
              helperText={`${(value.items[0]?.title ?? "").length}/${PRIZE_TITLE_MAX_LENGTH} · ${PRIZE_NAME_SHOWN_HINT}`}
              placeholder={namePlaceholder}
              disabled={disabled}
            />
          ) : (
            <div className="space-y-5">
              {([1, 2, 3] as const).map((place) => {
                const item = value.items.find((candidate) => candidate.place === place);
                const title = item?.title ?? "";
                const description = item?.description ?? "";
                return (
                  <div key={place} className="space-y-5">
                    <TextField
                      label={`${place === 1 ? "1st" : place === 2 ? "2nd" : "3rd"} place prize name`}
                      value={title}
                      onChange={(text) => setItemField(place, "title", text.slice(0, PRIZE_TITLE_MAX_LENGTH))}
                      error={errors.items?.[place]?.title}
                      required={place === 1}
                      maxLength={PRIZE_TITLE_MAX_LENGTH}
                      helperText={`${title.length}/${PRIZE_TITLE_MAX_LENGTH} · ${PRIZE_NAME_SHOWN_HINT}`}
                      placeholder={place === 1 ? namePlaceholder : "Optional"}
                      disabled={disabled}
                    />
                    <TextAreaField
                      label="Description (optional)"
                      value={description}
                      onChange={(text) =>
                        setItemField(place, "description", text.slice(0, PRIZE_DESCRIPTION_MAX_LENGTH))
                      }
                      error={errors.items?.[place]?.description}
                      helperText={`${description.length}/${PRIZE_DESCRIPTION_MAX_LENGTH}`}
                      disabled={disabled}
                      rows={2}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {who === "winner" ? (
            <TextAreaField
              label="Short description"
              value={value.items[0]?.description ?? ""}
              onChange={(text) => setItemField(1, "description", text.slice(0, PRIZE_DESCRIPTION_MAX_LENGTH))}
              error={errors.items?.[1]?.description}
              placeholder="What does the winner get?"
              disabled={disabled}
            />
          ) : null}

          <OptionCards
            legend="Who wins it?"
            value={who}
            onChange={setWho}
            disabled={disabled}
            options={[
              { value: "winner", label: "The winner", hint: "Whoever finishes first." },
              { value: "top3", label: "The top 3", hint: "Each place can have its own prize." },
            ]}
          />

          {value.kind === "forfeit" ? (
            <PanelNote icon={Smile}>
              Nothing is delivered. The leaderboard settles it, and the forfeit is between friends.
            </PanelNote>
          ) : null}
          {value.kind === "perk" ? (
            <PanelNote icon={Sun}>
              You&apos;ll arrange this yourself. After the result is checked you&apos;ll see who won here
              and can mark it as given.
            </PanelNote>
          ) : null}

          <ToggleField
            label="Winner must be 18 or over"
            description="We'll check this against the winner's own account before revealing the prize."
            checked={value.adultOnly}
            onChange={(adultOnly) => onChange({ ...value, adultOnly })}
            disabled={disabled}
          />

          {previewTermsHref ? <PreviewTermsLink href={previewTermsHref} /> : null}
        </>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Building blocks, ported verbatim (markup + classes) from the approved
 * v0 design, minus the parts Phase 1 doesn't offer (icons on cards stay
 * optional since the "Who wins it?" cards have none, same as the design).
 * ------------------------------------------------------------------ */

function SwitchField({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-xl border border-input bg-background px-4 py-3 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-navy"
    >
      <span>
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
      <span className="relative inline-flex h-7 w-12 shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="peer sr-only"
        />
        <span
          className="absolute inset-0 rounded-full bg-muted-foreground/60 transition-colors peer-checked:bg-primary"
          aria-hidden="true"
        />
        <span
          className="absolute left-1 top-1 size-5 rounded-full bg-card shadow transition-transform peer-checked:translate-x-5"
          aria-hidden="true"
        />
      </span>
    </label>
  );
}

function OptionCards<T extends string>({
  legend,
  value,
  onChange,
  options,
  disabled,
}: {
  legend: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; hint: string; icon?: LucideIcon }[];
  disabled?: boolean;
}) {
  const groupName = useId();
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-foreground">{legend}</legend>
      <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <label
              key={option.value}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-input bg-background px-4 py-3 transition-colors hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:checked]:ring-1 has-[:checked]:ring-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-navy"
            >
              <input
                type="radio"
                name={groupName}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                disabled={disabled}
                className="mt-1 size-4 shrink-0 accent-primary"
              />
              {Icon ? (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-brand-navy">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              ) : null}
              <span>
                <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function PanelNote({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-brand-navy">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <p className="text-sm leading-relaxed text-foreground">{children}</p>
    </div>
  );
}

function PreviewTermsLink({ href }: { href: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-border bg-card px-4 py-1">
      <Link
        href={href}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-navy underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
      >
        <FileText className="size-4" aria-hidden="true" />
        Preview prize terms
      </Link>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Info className="size-3.5 shrink-0" aria-hidden="true" />
        Written for you from this form. Check them before you publish.
      </span>
    </div>
  );
}
