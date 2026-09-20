/**
 * Stand-in for the illustrated `avatarIndex` set. That asset set is
 * referenced everywhere in the schema (`avatarIndex: number` on both
 * `users/{uid}` and every `players/{uid}` doc) but, per the competition
 * surfaces design doc §7, it "is not located in this repo — likely lives in
 * the Android app's drawable set; needs porting to SVG/web." `AccountView`
 * hit the exact same gap and shipped a text fallback ("your avatar slot is
 * #N") rather than inventing artwork — this component follows the same
 * discipline: a deterministic initial-letter circle, never a broken image,
 * never a fabricated illustration standing in for a real asset nobody has
 * approved. Swap the render body for the real illustrated set once it's
 * ported; every call site below already keys off `avatarIndex` so that swap
 * is contained to this one file.
 */

const PALETTE = [
  "bg-brand-navy",
  "bg-brand-coral",
  "bg-brand-pink",
  "bg-brand-navy-light",
  "bg-accent",
] as const;

function paletteClassName(avatarIndex: number | null): string {
  const index = avatarIndex !== null && avatarIndex >= 0 ? avatarIndex % PALETTE.length : 0;
  return PALETTE[index];
}

function initial(displayName: string | null): string {
  const trimmed = displayName?.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

export function PlayerAvatar({
  displayName,
  avatarIndex,
  size = 40,
  grayscale = false,
  className,
}: {
  displayName: string | null;
  avatarIndex: number | null;
  size?: number;
  grayscale?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${paletteClassName(avatarIndex)} ${grayscale ? "grayscale" : ""} ${className ?? ""}`}
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.4) }}
    >
      {initial(displayName)}
    </span>
  );
}
