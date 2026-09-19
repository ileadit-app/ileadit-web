/**
 * The real ileadit mark, not a generated placeholder.
 *
 * Sourced from the shipped Android app's `splash_logo_circle.xml`
 * (`AndroidStudioProjects/ileadit/app/src/main/res/drawable/splash_logo_circle.xml`):
 * a circular badge with a gold-to-pink diagonal gradient and three navy
 * parallelogram "steps" climbing across it. The path data and gradient stops
 * below are copied directly from that vector (coordinates translated 1:1
 * from Android's pathData syntax, which is SVG-path-compatible), not
 * redrawn from a text description. It reads the same on light or dark
 * backgrounds because the badge carries its own background colour, so there
 * is no separate "light"/"dark" variant of the mark itself — only of the
 * wordmark text next to it.
 *
 * The Figma file (node 1:22819 etc.) could not be reached for this build —
 * the shared Figma token returned `403 Token expired`. This SVG is the next
 * best real source: it's the actual production app icon's badge artwork.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className ?? "h-8 w-8"}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="ileadit-logo-gradient"
          x1="10"
          y1="10"
          x2="90"
          y2="90"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#F7A82F" />
          <stop offset="1" stopColor="#BC1062" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill="url(#ileadit-logo-gradient)" />
      <path d="M30,30L15,45L25,55L40,40L30,30Z" fill="#192F5F" />
      <path d="M45,45L30,60L40,70L55,55L45,45Z" fill="#192F5F" />
      <path d="M60,30L45,45L55,55L70,40L60,30Z" fill="#192F5F" />
    </svg>
  );
}

/** Icon mark + wordmark lockup, used in the header and footer. */
export function Logo({
  className,
  markClassName,
  variant = "dark",
}: {
  className?: string;
  markClassName?: string;
  variant?: "dark" | "light";
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 ${className ?? ""}`.trim()}
    >
      <LogoMark className={markClassName ?? "h-8 w-8 shrink-0"} />
      <span
        className={`font-sans text-xl font-extrabold tracking-tight lowercase ${
          variant === "light" ? "text-on-navy-foreground" : "text-brand-navy"
        }`}
      >
        ileadit
      </span>
    </span>
  );
}
