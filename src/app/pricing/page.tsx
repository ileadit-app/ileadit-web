export default function Pricing() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <h1 className="text-4xl font-bold text-primary">Pricing</h1>
      {/* WEB-3 item 4: was `text-text-primary`, a token that does not exist
          in globals.css's `@theme inline` block — it rendered with no
          colour at all (falls back to `currentColor`, which happened to be
          close to invisible against the page background here). Swapped to
          the real `muted-foreground` token already used for secondary body
          copy elsewhere on the site. This page remains an intentionally
          minimal stub — the fully-built, linked-to pricing content lives at
          `/#pricing` (see PricingSection.tsx) — no other content was added
          here as part of this fix. */}
      <p className="mt-4 text-lg text-muted-foreground">
        Choose the plan that fits your competition needs.
      </p>
    </div>
  );
}
