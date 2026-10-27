"use client";

import DOMPurify from "dompurify";
import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { isDraftNotApproved, useCompetitionTerms, type CompetitionTermsDoc } from "@/lib/competitionTerms";

/**
 * PRZ-W1-FIX1 deliverable 3 (W4) — public `/competitions/[id]/prize-terms`
 * page body. Deliberately NOT wrapped in `<ProtectedRoute>` (see that route
 * file's own comment) — anyone with the link, signed in or not, must be
 * able to read a competition's prize terms.
 *
 * **How `terms/current.html` is rendered safely — the decision and why
 * this changed from the original PRZ-W1 build.** `competitions/{cid}/
 * terms/current.html` is engine-generated HTML (spec §3.3) that this portal
 * has never produced and cannot fully trust at render time. The original
 * PRZ-W1 build rendered it inside a sandboxed `<iframe sandbox="">`
 * specifically to avoid adding a sanitiser dependency — but the approved
 * v0 design renders terms as normal page content in the site's own
 * typography, which an opaque-origin iframe structurally cannot do (it has
 * no access to this document's stylesheet). PRZ-W1-FIX1 switches to
 * **DOMPurify**, sanitising `terms.html` with a strict, explicit allow-list
 * before `dangerouslySetInnerHTML` — this is what `sanitizeTermsHtml` below
 * does, and it is the ONLY place in this file HTML is ever interpolated.
 *
 * Allow-listed tags: `p, h2, h3, ul, ol, li, strong, em, a`. Allow-listed
 * attributes: `href` only, and only on `a` (enforced further by DOMPurify's
 * `ALLOWED_URI_REGEXP`, restricted to `http:`/`https:`/`mailto:` schemes —
 * blocks `javascript:`/`data:` link injection). No `class`/`id`/`style`/
 * `on*` attribute survives on anything. `FORBID_TAGS`/`FORBID_ATTR` are kept
 * as an explicit, documented belt-and-braces layer on top of the allow-list
 * rather than relying on the allow-list alone, since a future edit widening
 * `ALLOWED_TAGS` should not silently also re-admit `<script>`/`on*` unless
 * someone deliberately also removes the forbid list.
 *
 * `terms.html`'s actual content/shape is unverified against engine source
 * (PRZ-E1/E2 not deployed/readable as of 2026-10-27, per `competitionTerms.ts`'s
 * own header comment) — this is built strictly from the spec's field list.
 */
const TERMS_SANITIZE_CONFIG = {
  ALLOWED_TAGS: ["p", "h2", "h3", "ul", "ol", "li", "strong", "em", "a"],
  ALLOWED_ATTR: ["href"],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
  FORBID_ATTR: ["style", "class", "id", "onerror", "onclick", "onload"],
};

function sanitizeTermsHtml(html: string): string {
  // DOMPurify's default export needs a real `window`/`document` to create a
  // sanitizer instance (it ships no bundled jsdom) — calling `.sanitize`
  // during Next's SERVER render throws. This is never actually hit by the
  // real production caller (`PrizeTerms` above): `useCompetitionTerms`'s
  // `status` always starts as `"loading"` and only ever reaches
  // `"success"` (the only state with `terms.html`) from inside a
  // `useEffect`'s `onSnapshot` callback, which cannot run during SSR — so
  // this branch is reachable only by directly SSR-ing `PrizeTermsView` with
  // hand-built data (e.g. a dev-only fixture route). Returning an empty
  // string there is correct and safe: no raw HTML ever reaches the DOM, and
  // the client re-render after hydration produces the real sanitised
  // content.
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html, TERMS_SANITIZE_CONFIG);
}

export function PrizeTerms({ competitionId }: { competitionId: string }) {
  const state = useCompetitionTerms(competitionId);

  if (state.status === "loading") {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-6" role="status" aria-live="polite">
        <div className="h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-6 h-96 animate-pulse rounded-2xl bg-muted" />
        <span className="sr-only">Loading prize terms…</span>
      </div>
    );
  }

  if (state.status === "not-found") {
    return (
      <StatusMessage
        title="No prize terms for this competition"
        body="This competition doesn't have a prize, or its terms haven't been generated yet."
      />
    );
  }

  if (state.status === "error") {
    return (
      <StatusMessage
        title="We couldn't load these terms"
        body="Something went wrong talking to ileadit. Try reloading the page."
        isError
      />
    );
  }

  return <PrizeTermsView terms={state.terms} />;
}

/** Lowercase, hyphenated, de-duplicated anchor id from a heading's own text —
 * used only to build the "On this page" sidebar below; never fed back into
 * sanitisation or written to the raw HTML string. */
function slugify(text: string, seen: Set<string>): string {
  const base =
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";
  let candidate = base;
  let n = 2;
  while (seen.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  seen.add(candidate);
  return candidate;
}

/**
 * Pure, props-only render of the "terms loaded successfully" state —
 * extracted so the dev-only visual-check fixture (`src/app/dev/prizes/page.tsx`,
 * never built in production, see that file's own header comment) can render
 * this exact markup with made-up data, without needing a live Firestore
 * listener. `PrizeTerms` above is the only real production caller.
 *
 * **Porting note (PRZ-W1-FIX1 deliverable 1).** The approved v0 reference
 * (`.ticket-refs/prizes/v0-web/components/competitions/PrizeTerms.tsx`)
 * renders a hardcoded competition name as the H1, a fixed 10-entry section
 * list, and an "On this page" sidebar built from that same hardcoded list.
 * None of that is available here: `CompetitionTermsDoc` (`competitionTerms.ts`)
 * has no competition name and no structured section data — `terms.html` is
 * one opaque, engine-generated blob. Two DOCUMENTED, DELIBERATE deviations
 * from the v0 source follow from that: (1) the H1 reads the literal string
 * "Prize terms", not the competition's name; (2) the "On this page" sidebar
 * and its numbering are derived by parsing the SANITISED HTML's own
 * already-rendered `<h2>` elements after the fact (via `contentRef` below),
 * not by consuming a fixed section list — so it stays accurate for whatever
 * the engine actually generates, including fewer/more than 10 sections. The
 * coral "Official prize terms" kicker and the H1/intro-paragraph typography
 * are ported verbatim from v0.
 */
export function PrizeTermsView({ terms }: { terms: CompetitionTermsDoc }) {
  const draftNotApproved = isDraftNotApproved(terms);

  // Deferred, client-only sanitisation — NOT the `set-state-in-effect`
  // anti-pattern a lazy `useState` initializer would normally fix (see the
  // project memory on that rule): a lazy initializer runs during SSR too,
  // where `window` is undefined and `sanitizeTermsHtml` must return `""`.
  // If we called `sanitizeTermsHtml` directly in this render instead, a
  // caller that already has `terms.html` on the very FIRST render (e.g. the
  // real `useCompetitionTerms` hook never does this, but a props-driven
  // caller that passes already-resolved `terms` synchronously would) hits a
  // genuine SSR/hydration mismatch: the server renders `""` while the
  // client's first hydration pass renders the real sanitised string. React
  // does not patch up a `dangerouslySetInnerHTML` mismatch during hydration
  // the way it does for plain text — it leaves the DOM exactly as
  // server-rendered, i.e. permanently blank. Deferring the real value to a
  // `useEffect` (which never runs during SSR and never runs as part of the
  // hydration commit itself) guarantees the server-rendered markup and the
  // client's first render are byte-identical — nothing for hydration to
  // mismatch on — and the real content then appears via a normal, later
  // client-side state update.
  //
  // `react-hooks/set-state-in-effect` flags both effects below for calling
  // `setState` directly in their body. The rule's usual fix in this codebase
  // (a lazy `useState` initializer, see `AuthContext.tsx`) is NOT available
  // here — a lazy initializer also runs during SSR, which is exactly the
  // case this deferral exists to avoid (see the long comment above). This is
  // a deliberate, justified exception, not an oversight.
  const [sanitizedHtml, setSanitizedHtml] = useState<string | null>(null);
  const [tocSections, setTocSections] = useState<{ id: string; title: string }[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see the justification comment above the two useState calls
    setSanitizedHtml(terms.html ? sanitizeTermsHtml(terms.html) : null);
  }, [terms.html]);

  // Runs AFTER the sanitised HTML has actually committed to the DOM (it
  // depends on `sanitizedHtml`, which only flips non-null post-mount — see
  // the comment above). Walking `contentRef.current` rather than re-parsing
  // the raw string keeps this a read of the one trusted, already-sanitised
  // render output, never a second, independent HTML-parsing code path.
  useEffect(() => {
    const container = contentRef.current;
    if (!container || sanitizedHtml === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see the justification comment above the two useState calls
      setTocSections([]);
      return;
    }
    const seen = new Set<string>();
    const headings = Array.from(container.querySelectorAll("h2"));
    const sections = headings.map((heading) => {
      const title = heading.textContent?.trim() || "Section";
      const id = slugify(title, seen);
      heading.id = id;
      return { id, title };
    });
    setTocSections(sections);
  }, [sanitizedHtml]);

  return (
    // `@container`: establishes a containment context so the `@min-[Npx]:`
    // (Tailwind v4 CONTAINER query) classes below actually activate against
    // this element's own real rendered width — see the matching comment in
    // `OrganiserPrizePanel.tsx` for the full story (same gotcha, same fix,
    // found while verifying this file's own ported `@min-[1024px]:` TOC
    // layout against a real browser width).
    <div className="@container mx-auto max-w-5xl px-5 py-10 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">Official prize terms</p>
      <h1 className="mt-1 text-3xl font-extrabold text-foreground @min-[640px]:text-4xl">Prize terms</h1>
      {terms.version ? (
        <p className="mt-1 text-xs font-medium text-muted-foreground">Version {terms.version}</p>
      ) : null}
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        These are the official terms for the prize in this competition. Entry is free, and nothing
        is ever charged to enter or to claim the prize.
      </p>

      {draftNotApproved ? (
        <div
          role="status"
          className="mt-4 flex items-start gap-2 rounded-xl border border-brand-coral/30 bg-brand-coral/10 p-3 text-sm font-medium text-brand-coral"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Draft terms — not yet approved. These may still change before the competition starts.</span>
        </div>
      ) : null}

      <div className="mt-6 grid gap-8 @min-[1024px]:grid-cols-[220px_1fr]">
        {tocSections.length > 0 ? (
          <nav aria-label="On this page" className="hidden @min-[1024px]:block">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-coral">On this page</p>
            <ol role="list" className="mt-3 space-y-2 text-sm">
              {tocSections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-muted-foreground hover:text-brand-navy hover:underline"
                  >
                    <span className="tabular-nums text-brand-coral">{index + 1}.</span>{" "}
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <article>
          {terms.html ? (
            sanitizedHtml !== null ? (
              <div
                ref={contentRef}
                className="text-sm leading-relaxed text-foreground [&_a]:text-brand-navy [&_a]:underline [&_h2]:mt-6 [&_h2]:scroll-mt-6 [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:text-brand-navy [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-brand-navy [&_li]:mt-1 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-3 [&_strong]:font-semibold [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5"
                // Sanitised above with a strict allow-list — see this file's
                // header comment. This is the ONLY `dangerouslySetInnerHTML` in
                // this component.
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            ) : (
              <div
                className="h-24 animate-pulse rounded-xl bg-muted"
                aria-hidden="true"
                data-testid="prize-terms-sanitising"
              />
            )
          ) : (
            <p className="text-sm text-muted-foreground">No terms text is available yet.</p>
          )}
        </article>
      </div>
    </div>
  );
}

function StatusMessage({ title, body, isError }: { title: string; body: string; isError?: boolean }) {
  return (
    <div className="mx-auto max-w-lg px-5 py-20 text-center sm:px-6">
      {isError ? <AlertCircle className="mx-auto size-8 text-destructive" aria-hidden="true" /> : null}
      <h1 className="mt-3 text-2xl font-extrabold text-foreground">{title}</h1>
      <p className="mt-2 text-base text-muted-foreground">{body}</p>
    </div>
  );
}
