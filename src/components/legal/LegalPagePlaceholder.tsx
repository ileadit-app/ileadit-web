import { AlertTriangle, ListChecks } from "lucide-react";

/**
 * Shared building blocks for /privacy and /terms.
 *
 * Neither page has real legal copy yet — an agent should never draft legal
 * text and let it pass as final, because a placeholder that LOOKS finished
 * is the one that accidentally ships. Every block of body copy here is
 * unmissably marked as a placeholder (dashed border, coral placeholder
 * label, explicit "must be replaced" instruction) and is deliberately
 * generic/short so it can't be mistaken for reviewed legal text.
 *
 * The "must cover" bullet lists ARE real content, not placeholder — they're
 * this page's actual value: a genuine checklist of what ileadit's privacy
 * policy / terms need to address, given the app reads Health Connect step
 * data and the business has a corporate-wellness (B2B) side. Whoever
 * drafts the real copy should treat these lists as a brief, not filler.
 */

export function LegalPlaceholderBanner({ pageName }: { pageName: string }) {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-8 sm:px-6">
      <div className="flex items-start gap-3 rounded-2xl border-2 border-dashed border-brand-coral/50 bg-brand-coral/10 p-5">
        <AlertTriangle
          className="mt-0.5 size-5 shrink-0 text-brand-coral"
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wide text-brand-coral">
            Placeholder page — not reviewed, not legal advice, not for
            production
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            This {pageName} is layout and structure only. Every paragraph
            marked &ldquo;PLACEHOLDER&rdquo; below must be replaced with copy
            drafted and reviewed by a qualified legal professional before
            this page is linked from anywhere real. Do not ship this as-is.
          </p>
        </div>
      </div>
    </div>
  );
}

export function LegalSection({
  heading,
  mustCover,
  placeholder,
}: {
  heading: string;
  mustCover: string[];
  placeholder: string;
}) {
  return (
    <div className="border-t border-border py-10 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-extrabold tracking-tight text-foreground">
        {heading}
      </h2>

      <div className="mt-4 rounded-2xl border border-border bg-card p-5">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <ListChecks className="size-4 text-primary" aria-hidden="true" />
          What this section needs to cover
        </p>
        <ul className="mt-3 space-y-2">
          {mustCover.map((item) => (
            <li
              key={item}
              className="text-sm leading-relaxed text-muted-foreground before:mr-2 before:content-['\2022']"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-2xl border-2 border-dashed border-brand-coral/40 bg-brand-coral/5 p-5">
        <p className="text-xs font-extrabold uppercase tracking-wide text-brand-coral">
          Placeholder text — replace before publishing
        </p>
        <p className="mt-2 text-sm italic leading-relaxed text-muted-foreground">
          {placeholder}
        </p>
      </div>
    </div>
  );
}
