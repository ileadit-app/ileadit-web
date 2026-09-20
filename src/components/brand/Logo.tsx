/**
 * The real ileadit mark, reconciled against Figma (2026-09-20, ticket
 * "brand-figma-reconcile") now that the shared Figma token has been rotated
 * and file access confirmed working (`GET /v1/images` returns real PNGs).
 *
 * PREVIOUS STATE (superseded by this reconciliation): this file used to be a
 * hand translation of the shipped Android app's `splash_logo_circle.xml` —
 * an opaque gold-to-pink gradient circle with three sharp navy parallelogram
 * "steps" drawn on top of it — built that way because the Figma token was
 * returning `403 Token expired` at the time and the Android asset was the
 * best real source available. That translation turned out to be wrong, not
 * just approximate:
 *
 * The authoritative mark (fetched directly as vector, not raster, from the
 * "Black Logo" (node 1:22835) and "White Logo" (node 1:22837) frames — both
 * render correctly and are pixel-identical in shape to each other, just
 * inverted fill) is a SINGLE flattened path using `fill-rule="evenodd"`: one
 * rounded outer badge outline, with **five** diagonal rounded-capsule shapes
 * (not three sharp parallelograms) cut out of it as true negative space —
 * not drawn on top in a second colour. That construction is deliberate: the
 * cutouts are transparent, so whatever sits behind the badge (a white
 * header, a navy footer, print on paper) shows through automatically. The
 * old implementation's opaque navy shapes would visually disappear if the
 * badge were ever placed on a navy background — this version can't have
 * that failure mode by construction. Exact path data below is the literal
 * `d` attribute Figma returned for this shape (`GET /v1/images?...&format=svg`
 * on the icon subnode), not redrawn or approximated.
 *
 * The "Logo / Colour" variant (node 1:22819) — which is what would have told
 * us definitively whether the colour mark uses a gradient fill on this same
 * cutout geometry — could NOT be verified: its only content is a flattened
 * raster (`Asset 9@2x`, imageRef `195092d882b9cea210e3a65acce7f7107543ad74`)
 * that is orphaned in the Figma file itself. Confirmed two ways: (1) that
 * imageRef is absent from all 54 entries `GET /v1/files/:key/images` returns
 * for this file, and (2) exporting the node at both scale=1 and scale=3
 * (`GET /v1/images?ids=1:22819&format=png`) both return a real, valid,
 * blank-white PNG — a genuine broken/missing source asset, not a fetch
 * failure on our end. So the gradient stop colours below are NOT re-derived
 * from that broken node; they're independently confirmed exact via the
 * "Fill Gradient Colors" swatch on the Colors style guide page (node
 * 1:22296): `#bd1063` → `#f8a92f`, a 1-hex-unit correction from the previous
 * Android-sourced `#BC1062` / `#F7A82F` (both essentially identical colours —
 * this is a precision snap-to-source, not a visible colour change). The
 * diagonal direction (gold at the top-left, pink at the bottom-right) is
 * preserved from the previous implementation as-is, since Figma's swatch is
 * a flat left-to-right demo of the two colours, not evidence of the real
 * mark's gradient angle — inventing a specific angle correction would be
 * exactly the kind of unverifiable guess this reconciliation is meant to
 * avoid.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 62 62"
      className={className ?? "h-8 w-8"}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="ileadit-logo-gradient"
          x1="0"
          y1="0"
          x2="62"
          y2="62"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#F8A92F" />
          <stop offset="1" stopColor="#BD1063" />
        </linearGradient>
      </defs>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="url(#ileadit-logo-gradient)"
        d="M1.16165 22.6096C4.92359 9.23905 17.118 0.00131127 31.0076 0C47.8561 0.377933 61.318 14.1435 61.3201 30.9961C61.3223 47.8488 47.8639 61.6178 31.0155 62H29.9705C24.6182 61.8294 19.4029 60.2664 14.8392 57.465C2.98804 50.2212 -2.6003 35.9801 1.16165 22.6096ZM27.0602 13.1635L20.4469 20.2618C19.7855 20.9808 19.8314 22.0996 20.5494 22.762L22.9155 24.9546C23.6302 25.6201 24.7489 25.5813 25.4157 24.8678L32.029 17.7695C32.6945 17.0548 32.6557 15.9362 31.9422 15.2693L29.5761 13.0767C29.2321 12.7522 28.7727 12.5788 28.3 12.5951C27.8274 12.6114 27.381 12.816 27.0602 13.1635ZM38.8395 37.5817L27.4663 49.783C27.1473 50.1263 26.7047 50.3285 26.2362 50.3448C25.7678 50.3611 25.3122 50.1901 24.9701 49.8697L22.604 47.6771C21.8915 47.0104 21.851 45.8935 22.5133 45.177L33.914 32.9757C34.5795 32.2627 35.6969 32.2239 36.4102 32.8889L38.7764 35.0815C39.1167 35.4045 39.3146 35.8495 39.3264 36.3186C39.3383 36.7876 39.1631 37.242 38.8395 37.5817ZM14.78 49.8579L39.1904 23.6611C39.514 23.319 39.688 22.8622 39.6739 22.3915C39.6599 21.9209 39.4589 21.4752 39.1155 21.153L36.7494 18.9604C36.0347 18.2949 34.9161 18.3337 34.2492 19.0472L9.82699 45.2519C9.16147 45.9666 9.20029 47.0852 9.91374 47.7521L12.2799 49.9447C12.9946 50.6102 14.1132 50.5714 14.78 49.8579ZM40.3498 19.8241L37.9837 17.6275C37.6404 17.3085 37.4382 16.8658 37.4219 16.3974C37.4056 15.929 37.5766 15.4734 37.897 15.1313L42.3334 10.3675C43.0003 9.65405 44.1189 9.61524 44.8336 10.2808L47.1997 12.4733C47.9132 13.1402 47.952 14.2588 47.2865 14.9735L42.85 19.7176C42.1855 20.4324 41.0685 20.4764 40.3498 19.8162V19.8241ZM45.6933 27.6362C46.408 28.3017 47.5266 28.2629 48.1935 27.5494L54.8107 20.455C55.473 19.7384 55.4325 18.6216 54.72 17.9548L52.3539 15.7622C52.0118 15.4419 51.5562 15.2709 51.0878 15.2872C50.6193 15.3035 50.1767 15.5056 49.8576 15.849L43.2404 22.9473C42.5753 23.6607 42.6142 24.7781 43.3272 25.4436L45.6933 27.6362Z"
      />
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
