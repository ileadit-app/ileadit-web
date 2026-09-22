"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useCanCreateCompetitions } from "@/lib/useCanCreateCompetitions";
import { CreateCompetitionForm } from "./CreateCompetitionForm";

/**
 * Renders inside `<ProtectedRoute>` on `/competitions/new` — so by the time
 * this mounts, the visitor is definitely signed in, but sign-in alone is
 * NOT enough to create a competition (Paul's 2026-09-20 decision: only org
 * admins and ileadit admins may create competitions — see
 * `src/lib/adminClaim.ts`'s `canCreateCompetitions()` header comment).
 *
 * This is the "gated, not merely protected" behaviour the P1.4 ticket asks
 * for: a signed-in player who lacks the capability sees a clear refusal
 * screen, never the form — the form component below is only ever mounted
 * once the check resolves to `"allowed"`.
 */
export function CreateCompetitionGate() {
  const capability = useCanCreateCompetitions();

  if (capability === "checking") {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6" role="status" aria-live="polite">
        <div className="h-4 w-40 animate-pulse rounded-full bg-muted" />
        <div className="mt-6 h-64 animate-pulse rounded-3xl bg-muted" aria-hidden="true" />
        <span className="sr-only">Checking your permissions…</span>
      </div>
    );
  }

  if (capability === "denied") {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center sm:px-6" role="alert">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-coral/10 text-brand-coral">
          <Lock className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          You don&apos;t have permission to create competitions
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Creating a competition is limited to organisation admins and ileadit admins right now.
          If your team should be able to run competitions on ileadit,{" "}
          <a href="mailto:hello@ileadit.co.uk" className="font-semibold text-foreground underline">
            email hello@ileadit.co.uk
          </a>{" "}
          and we&apos;ll get you set up.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">New competition</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        Set up a competition
      </h1>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Fill in the basics — you can invite people once it&apos;s created.
      </p>

      <div className="mt-8">
        <CreateCompetitionForm />
      </div>
    </div>
  );
}
