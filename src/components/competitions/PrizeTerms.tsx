"use client";

import { AlertCircle } from "lucide-react";
import { isDraftNotApproved, useCompetitionTerms, type CompetitionTermsDoc } from "@/lib/competitionTerms";

/**
 * PRZ-W1 deliverable 3 (W4) — public `/competitions/[id]/prize-terms` page
 * body. Deliberately NOT wrapped in `<ProtectedRoute>` (see that route
 * file's own comment) — anyone with the link, signed in or not, must be
 * able to read a competition's prize terms.
 *
 * **How `terms/current.html` is rendered safely — the decision and why.**
 * `competitions/{cid}/terms/current.html` is engine-generated HTML (spec
 * §3.3) that this portal has never produced and cannot fully trust at
 * render time — it must never be interpolated as `dangerouslySetInnerHTML`
 * directly into this page's own DOM, since that would let ANY markup it
 * contains (a `<script>`, an `onerror=` handler, a form posting elsewhere)
 * execute with this page's own origin, cookies and Firebase session.
 *
 * Two real options exist: (a) pull in an HTML-sanitiser dependency (e.g.
 * DOMPurify) and sanitise before `dangerouslySetInnerHTML`, or (b) render it
 * inside a sandboxed `<iframe sandbox="">` via `srcDoc`, which is a
 * zero-dependency, purely native browser primitive. This file uses **(b)**:
 * an empty `sandbox=""` attribute is the browser's STRICTEST setting — it
 * disables script execution, form submission, popups, top-level navigation,
 * and (critically) same-origin treatment, so even if the HTML smuggled in a
 * `<script>` tag, it would run (if at all) in a unique, opaque origin with
 * no access to this page's cookies, Firebase session, or DOM. This was
 * chosen over a sanitiser library specifically because it adds no new
 * dependency and needs no allow-list of "safe" tags/attributes to maintain
 * and keep correct — the browser's own sandbox model does the containment
 * instead of a maintained list of rules this codebase would otherwise own.
 * The trade-off, stated plainly: the iframe's content cannot inherit this
 * site's Tailwind theme (a separate browsing context has no access to the
 * parent document's stylesheet), so a small, hand-written inline `<style>`
 * block using hardcoded hex values (not Tailwind tokens) is included in the
 * `srcDoc` document itself to keep the terms text legible and on-brand.
 *
 * `terms.html`'s actual content/shape is unverified against engine source
 * (PRZ-E1/E2 not deployed/readable as of 2026-10-27, per `competitionTerms.ts`'s
 * own header comment) — this is built strictly from the spec's field list.
 */
const SANDBOXED_TERMS_STYLE = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #12172A;
    background: #FAFBFB;
    margin: 0;
    padding: 24px;
    line-height: 1.6;
    font-size: 15px;
  }
  h1, h2, h3 { color: #192F5F; }
  a { color: #192F5F; text-decoration: underline; }
  p { margin: 0 0 1em; }
`;

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

/**
 * Pure, props-only render of the "terms loaded successfully" state —
 * extracted so the dev-only visual-check fixture (`src/app/dev/prizes/page.tsx`,
 * never built in production, see that file's own header comment) can render
 * this exact markup with made-up data, without needing a live Firestore
 * listener. `PrizeTerms` above is the only real production caller.
 */
export function PrizeTermsView({ terms }: { terms: CompetitionTermsDoc }) {
  const draftNotApproved = isDraftNotApproved(terms);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-foreground">Prize terms</h1>
      {terms.version ? (
        <p className="mt-1 text-xs font-medium text-muted-foreground">Version {terms.version}</p>
      ) : null}

      {draftNotApproved ? (
        <div
          role="status"
          className="mt-4 flex items-start gap-2 rounded-xl border border-brand-coral/30 bg-brand-coral/10 p-3 text-sm font-medium text-brand-coral"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Draft terms — not yet approved. These may still change before the competition starts.</span>
        </div>
      ) : null}

      {terms.html ? (
        <iframe
          title="Prize terms"
          sandbox=""
          srcDoc={`<!doctype html><html><head><meta charset="utf-8" /><style>${SANDBOXED_TERMS_STYLE}</style></head><body>${terms.html}</body></html>`}
          className="mt-5 h-[70vh] w-full rounded-2xl border border-border bg-background"
        />
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">No terms text is available yet.</p>
      )}
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
