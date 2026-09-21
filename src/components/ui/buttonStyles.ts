/**
 * Shared secondary (outline) CTA button style — Lacey's colour decision
 * (automation-hub/docs/ileadit-cta-colour-decision-20260921.md, 21 Sep
 * 2026): "Secondary CTA (both): outline/ghost, 2px stroke + text, no fill.
 * On light surfaces: Navy #192F5F stroke+text. On navy surfaces: White
 * #FFFFFF stroke+text." Contrast verified in that doc: 12.56:1 (navy on
 * light) and 13.02:1 (white on navy).
 *
 * No shared secondary-button style existed anywhere in this codebase before
 * WEB-4 item 1 — every outline-style button (`HeroSection.tsx`'s "See how
 * it works", `ImageCropDialog.tsx`'s Cancel, `ProviderButton.tsx`'s OAuth
 * pills) was its own bespoke inline className, none matching the decision's
 * 2px-stroke spec exactly. This is the first reusable one. Adopt it for any
 * NEW secondary button. Retrofitting the pre-existing bespoke ones is
 * deliberately left alone by this ticket — that would be an unreviewed
 * visual diff on pages nobody asked to touch; do it opportunistically, file
 * by file, not as a batch rename.
 *
 * Sizing (h-*, px-*, w-*) is deliberately NOT baked in here, matching every
 * other shared className constant in this codebase (see
 * `BoundaryCard.tsx`'s `BOUNDARY_PRIMARY_CTA_CLASSES`) — callers compose
 * their own layout classes alongside these, e.g.:
 *   `${SECONDARY_BUTTON_LIGHT_CLASSNAME} h-12 w-full px-6 text-base`
 *
 * Disabled state uses the same --color-cta-disabled/--color-cta-disabled-
 * foreground tokens as the primary gold button (globals.css) — never
 * opacity-faded, per the same decision doc.
 */
export const SECONDARY_BUTTON_LIGHT_CLASSNAME =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 border-brand-navy bg-transparent font-bold text-brand-navy transition-colors hover:bg-brand-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed disabled:border-cta-disabled disabled:bg-transparent disabled:text-cta-disabled-foreground";

export const SECONDARY_BUTTON_NAVY_CLASSNAME =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 border-white bg-transparent font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:border-cta-disabled disabled:bg-transparent disabled:text-cta-disabled-foreground";

/**
 * 1px border for a gold-fill button sitting directly on a light/white
 * section — never on navy. The colour decision doc measured gold fill vs.
 * the page background at only 1.89:1 on `#FAFBFB` (below the 3:1 non-text
 * / component-boundary minimum), vs. 6.64:1 on navy (`#192F5F`, already
 * well clear). Kept as one named export so every light-section usage stays
 * in sync if the value is ever revisited.
 */
export const GOLD_BUTTON_LIGHT_BORDER_CLASSNAME = "border border-[rgba(25,47,95,0.15)]";
