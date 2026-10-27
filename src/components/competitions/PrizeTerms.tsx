"use client";

import DOMPurify from "dompurify";
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
        <div
          className="mt-5 text-sm leading-relaxed text-foreground [&_a]:text-brand-navy [&_a]:underline [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:text-brand-navy [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-brand-navy [&_li]:mt-1 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-3 [&_strong]:font-semibold [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5"
          // Sanitised above with a strict allow-list — see this file's
          // header comment. This is the ONLY `dangerouslySetInnerHTML` in
          // this component.
          dangerouslySetInnerHTML={{ __html: sanitizeTermsHtml(terms.html) }}
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
