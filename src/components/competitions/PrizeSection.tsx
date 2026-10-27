"use client";

import { useId } from "react";
import { TextField, TextAreaField, ToggleField } from "@/components/forms/fields";
import {
  FORFEIT_LOSER_TEXT_MAX_LENGTH,
  FREE_TO_ENTER_LINE,
  PRIZE_DESCRIPTION_MAX_LENGTH,
  PRIZE_TITLE_MAX_LENGTH,
  resizePrizeItems,
  type PrizeFieldErrors,
  type PrizeFormState,
  type PrizeKind,
  type PrizePlaces,
} from "@/lib/prize";

/**
 * Shared editable prize form section (PRZ-W1, W1-mobile). Used by BOTH the
 * creation wizard (`CreateCompetitionForm.tsx`) and the scheduled-competition
 * editor (`PrizeEditPanel.tsx`) — a single source of markup so the two can
 * never drift. Purely controlled: all state lives in the caller's
 * `PrizeFormState`, this component only renders it and reports changes.
 *
 * **Phase 1 scope — deliberately absent from this UI**: digital codes and
 * physical/sponsored prizes (`PrizeKind` values `"code"`/`"physical"`) are
 * Phase 2 (PRZ-W2/W3) and have no control here at all — not disabled, not
 * greyed out, simply never rendered. The kind choice below offers exactly
 * two options: forfeit, perk.
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
}: {
  value: PrizeFormState;
  onChange: (next: PrizeFormState) => void;
  errors: PrizeFieldErrors;
  disabled?: boolean;
}) {
  const kindGroupId = useId();
  const placesGroupId = useId();

  function setKind(kind: PrizeKind) {
    onChange({ ...value, kind });
  }

  function setPlaces(places: PrizePlaces) {
    onChange({ ...value, places, items: resizePrizeItems(value.items, places) });
  }

  function setItemField(place: 1 | 2 | 3, field: "title" | "description", text: string) {
    onChange({
      ...value,
      items: value.items.map((item) => (item.place === place ? { ...item, [field]: text } : item)),
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Prize (optional)</p>
        <p className="text-xs font-medium text-muted-foreground">{FREE_TO_ENTER_LINE}</p>
      </div>

      <div className="mt-3">
        <ToggleField
          label="Offer a prize for this competition"
          description="Players always enter for free — a prize is an extra incentive, never a cost."
          checked={value.enabled}
          onChange={(enabled) => onChange({ ...value, enabled })}
          disabled={disabled}
        />
      </div>

      {value.enabled ? (
        <div className="mt-5 space-y-5">
          <fieldset>
            <legend className="text-sm font-semibold text-foreground">What kind of prize?</legend>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {(
                [
                  { kind: "forfeit" as const, label: "Forfeit", hint: "The loser does something fun." },
                  { kind: "perk" as const, label: "Perk", hint: "The winner gets something." },
                ] satisfies { kind: PrizeKind; label: string; hint: string }[]
              ).map((option) => (
                <label
                  key={option.kind}
                  htmlFor={`${kindGroupId}-${option.kind}`}
                  className="flex items-start gap-3 rounded-xl border border-input bg-background px-4 py-3 has-[:checked]:border-primary"
                >
                  <input
                    id={`${kindGroupId}-${option.kind}`}
                    type="radio"
                    name={kindGroupId}
                    checked={value.kind === option.kind}
                    onChange={() => setKind(option.kind)}
                    disabled={disabled}
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold text-foreground">Who wins?</legend>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {(
                [
                  { places: 1 as const, label: "Winner only", hint: "Just 1st place." },
                  { places: 3 as const, label: "Top 3", hint: "1st, 2nd and 3rd place." },
                ] satisfies { places: PrizePlaces; label: string; hint: string }[]
              ).map((option) => (
                <label
                  key={option.places}
                  htmlFor={`${placesGroupId}-${option.places}`}
                  className="flex items-start gap-3 rounded-xl border border-input bg-background px-4 py-3 has-[:checked]:border-primary"
                >
                  <input
                    id={`${placesGroupId}-${option.places}`}
                    type="radio"
                    name={placesGroupId}
                    checked={value.places === option.places}
                    onChange={() => setPlaces(option.places)}
                    disabled={disabled}
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-4">
            {value.items.slice(0, value.places).map((item) => (
              <div key={item.place} className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.place === 1 ? "1st place" : item.place === 2 ? "2nd place" : "3rd place"}
                </p>
                <div className="mt-2 space-y-3">
                  <TextField
                    label={value.kind === "forfeit" ? "Forfeit title" : "Prize title"}
                    value={item.title}
                    onChange={(text) => setItemField(item.place, "title", text.slice(0, PRIZE_TITLE_MAX_LENGTH))}
                    error={errors.items?.[item.place]?.title}
                    helperText={`${item.title.length}/${PRIZE_TITLE_MAX_LENGTH}`}
                    disabled={disabled}
                    required={item.place === 1}
                    maxLength={PRIZE_TITLE_MAX_LENGTH}
                    placeholder={value.kind === "forfeit" ? "Wear the chicken suit to work" : "£25 coffee voucher"}
                  />
                  <TextAreaField
                    label="Description (optional)"
                    value={item.description}
                    onChange={(text) =>
                      setItemField(item.place, "description", text.slice(0, PRIZE_DESCRIPTION_MAX_LENGTH))
                    }
                    error={errors.items?.[item.place]?.description}
                    helperText={`${item.description.length}/${PRIZE_DESCRIPTION_MAX_LENGTH}`}
                    disabled={disabled}
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </div>

          {value.kind === "forfeit" ? (
            <TextField
              label="Forfeit text (optional)"
              value={value.forfeitLoserText}
              onChange={(text) =>
                onChange({ ...value, forfeitLoserText: text.slice(0, FORFEIT_LOSER_TEXT_MAX_LENGTH) })
              }
              error={errors.forfeitLoserText}
              helperText={`${value.forfeitLoserText.length}/${FORFEIT_LOSER_TEXT_MAX_LENGTH} — shown to the whole group, e.g. "Last place buys the coffees"`}
              disabled={disabled}
              maxLength={FORFEIT_LOSER_TEXT_MAX_LENGTH}
            />
          ) : null}

          <ToggleField
            label="Winner must be 18 or over"
            description="We'll check this against the winner's own account before revealing the prize."
            checked={value.adultOnly}
            onChange={(adultOnly) => onChange({ ...value, adultOnly })}
            disabled={disabled}
          />
        </div>
      ) : null}
    </div>
  );
}
