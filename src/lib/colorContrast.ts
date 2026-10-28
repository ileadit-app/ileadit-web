/**
 * Pure WCAG contrast-ratio math — no DOM, no browser, no rendering. Exists
 * so `colorContrast.test.ts` can compute the REAL composited ratio for a
 * token used with a Tailwind opacity modifier (`text-coral-text/90`) or
 * sitting on a translucent fill (`bg-destructive/10`), rather than eyeballing
 * hex values or checking only the base, undiluted token pairing.
 *
 * `relativeLuminance`/`contrastRatio` implement the WCAG 2.x formulas
 * (https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio) directly — deliberately
 * no new dependency for this, it's ~15 lines of real arithmetic.
 */

export type HexColor = `#${string}`;

function srgbChannelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function parseHex(hex: HexColor): { r: number; g: number; b: number } {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function toHex(r: number, g: number, b: number): HexColor {
  const clamp = (n: number) => Math.round(Math.min(255, Math.max(0, n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG relative luminance (0 = black, 1 = white) for an opaque sRGB hex colour. */
export function relativeLuminance(hex: HexColor): number {
  const { r, g, b } = parseHex(hex);
  const [lr, lg, lb] = [r, g, b].map(srgbChannelToLinear);
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** WCAG contrast ratio between two OPAQUE colours, in the range [1, 21]. */
export function contrastRatio(a: HexColor, b: HexColor): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Standard "over" alpha compositing: paints `fg` at `alpha` (0-1, matching a
 * Tailwind `/NN` opacity suffix) on top of the OPAQUE `bg`, returning the
 * resulting opaque colour. This is what a Tailwind `text-x/90` or `bg-x/10`
 * class actually renders as — the browser never shows the undiluted token
 * colour, so contrast must be checked against this composited result, not
 * the raw token.
 */
export function compositeOver(fg: HexColor, bg: HexColor, alpha: number): HexColor {
  const f = parseHex(fg);
  const b = parseHex(bg);
  return toHex(
    f.r * alpha + b.r * (1 - alpha),
    f.g * alpha + b.g * (1 - alpha),
    f.b * alpha + b.b * (1 - alpha),
  );
}

/** WCAG 2.2 AA minimum for normal-weight/size text. */
export const AA_NORMAL_TEXT_MIN_CONTRAST = 4.5;
