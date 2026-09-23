"use client";

import { useId } from "react";
import { Globe, Info, Lock } from "lucide-react";
import type { CompetitionVisibility } from "@/components/status/CompetitionVisibilityChip";

export type { CompetitionVisibility };

/**
 * The Public/Private choice on /competitions/new (ticket PC-9). Two radio
 * cards inside one <fieldset>, PRIVATE FIRST and pre-checked by default per
 * Paul's decision: never hidden, never silently defaulted server-side — the
 * value sent to `createCompetition` is always whatever is checked here,
 * starting from "private". `createCompetition`'s `visibility` field is
 * REQUIRED with no server-side default (engine contract, PC-9) — this
 * component's job is to guarantee a real value is always selected, so there
 * is no "unset" state to validate against on submit.
 *
 * Not editable after creation in v1 — this component has no "disabled
 * because already created" mode; it is only ever mounted on the create
 * form. `CompetitionDetail.tsx` renders visibility read-only via
 * `CompetitionVisibilityChip` instead.
 *
 * `lockedToPrivate` is an unused extension point for a future paid/purchase
 * creation mode (out of scope for PC-9 — see CLAUDE.md's Pricing Tiers):
 * when a caller ever passes `lockedToPrivate`, the Public card should render
 * disabled with a caps/upgrade note. Do not wire this up as part of PC-9; it
 * exists so that future ticket doesn't have to touch this file's structure.
 */
export function VisibilitySelector({
  value,
  onChange,
  disabled,
  lockedToPrivate,
}: {
  value: CompetitionVisibility;
  onChange: (value: CompetitionVisibility) => void;
  disabled?: boolean;
  lockedToPrivate?: boolean; // unused in PC-9 — see doc comment above
}) {
  const name = useId();
  const helperId = `${name}-helper`;

  return (
    <fieldset aria-describedby={helperId}>
      <legend className="text-sm font-semibold text-foreground">
        Who can join?
        <span className="text-brand-coral" aria-hidden="true"> *</span>
      </legend>

      <div className="mt-2 space-y-3">
        <VisibilityCard
          name={name}
          id="private"
          icon={<Lock className="size-4" aria-hidden="true" />}
          title="Private"
          description="Not listed in the app. Only people with an invite link can join."
          checked={value === "private"}
          onSelect={() => onChange("private")}
          disabled={disabled}
        />
        <VisibilityCard
          name={name}
          id="public"
          icon={<Globe className="size-4" aria-hidden="true" />}
          title="Public"
          description="Anyone in the app can find and join it during the join window."
          checked={value === "public"}
          onSelect={() => onChange("public")}
          disabled={disabled || lockedToPrivate}
        />
      </div>

      <p id={helperId} className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        You can&apos;t change this after you create the competition.
      </p>
    </fieldset>
  );
}

function VisibilityCard({
  name,
  id,
  icon,
  title,
  description,
  checked,
  onSelect,
  disabled,
}: {
  name: string;
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const inputId = `${name}-${id}`;
  return (
    <label
      htmlFor={inputId}
      className={`flex items-start gap-3 rounded-2xl border-2 p-4 sm:p-5 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-navy ${
        checked ? "border-brand-navy bg-[rgba(25,47,95,0.04)]" : "border-border bg-card"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-brand-navy/40"}`}
    >
      <input
        id={inputId}
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        disabled={disabled}
        // WCAG 1.4.11 non-text contrast: the browser's native checked-radio
        // dot uses `accent-color`. `accent-primary` (gold, #F8A92F) on the
        // card's white/near-white fill measures ~1.9:1 — below the 3:1 floor
        // for a UI-state indicator. `accent-brand-navy` (#192F5F) measures
        // ~12.6:1. The navy 2px card border already marks selection too, but
        // the dot itself must independently pass on its own.
        className="mt-0.5 size-5 shrink-0 accent-brand-navy"
      />
      <span className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-brand-navy">
          {icon}
        </span>
        <span>
          <span className="block text-sm font-bold text-foreground">{title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        </span>
      </span>
    </label>
  );
}
