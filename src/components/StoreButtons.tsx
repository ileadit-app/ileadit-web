import { Apple, PlayCircle } from "lucide-react";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/storeLinks";

/**
 * Real store buttons for whichever listings exist (WEB-SHOP-LINK). Renders
 * one `<a>` per non-null URL in `src/lib/storeLinks.ts` and NOTHING at all
 * when both are null — no placeholder, no disabled button, no empty wrapper.
 *
 * `tone` picks the button palette for the background it sits on (gold on
 * light, translucent white on navy), mirroring the existing focus-ring
 * convention: the outline colour depends on what is BEHIND the button.
 */
export function StoreButtons({
  tone = "light",
  className = "",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  if (!PLAY_STORE_URL && !APP_STORE_URL) return null;

  const base =
    "inline-flex h-12 items-center gap-2 rounded-full px-6 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";
  const palette =
    tone === "dark"
      ? "border border-on-navy-border bg-white/5 text-on-navy-foreground hover:bg-white/10 focus-visible:outline-white"
      : "border border-[rgba(25,47,95,0.15)] bg-brand-gold text-brand-navy hover:bg-brand-gold/90 focus-visible:outline-brand-navy";

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {PLAY_STORE_URL ? (
        <a href={PLAY_STORE_URL} className={`${base} ${palette}`}>
          <PlayCircle className="size-5" aria-hidden="true" />
          Get it on Google Play
        </a>
      ) : null}
      {APP_STORE_URL ? (
        <a href={APP_STORE_URL} className={`${base} ${palette}`}>
          <Apple className="size-5" aria-hidden="true" />
          Download on the App Store
        </a>
      ) : null}
    </div>
  );
}
