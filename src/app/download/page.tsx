import type { Metadata } from "next";
import { Apple, PlayCircle } from "lucide-react";
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  storeAvailabilityCopy,
} from "@/lib/storeLinks";

export const metadata: Metadata = {
  title: "Get the app — ileadit",
  description: "Download ileadit and start competing on points, not step counts. Free to download.",
};

/**
 * Store buttons come from `src/lib/storeLinks.ts` (the one place the listing
 * URLs live). A null URL means no card and no button for that store — never
 * a dead link or a placeholder on a public page. With both null the page
 * shows just the early-access sentence.
 */
export default function Download() {
  return (
    <>
      <section className="relative overflow-hidden bg-brand-navy text-on-navy-foreground">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 left-[-10%] h-96 w-96 rounded-full bg-brand-gold/15 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
          <span className="inline-flex items-center rounded-full border border-on-navy-border bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-gold">
            Get the app
          </span>
          <h1 className="mt-4 max-w-2xl text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
            Download ileadit
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-on-navy-muted sm:text-xl">
            Free to download, free to join a public competition.{" "}
            {storeAvailabilityCopy(PLAY_STORE_URL, APP_STORE_URL)}
          </p>
        </div>
      </section>

      {PLAY_STORE_URL || APP_STORE_URL ? (
        <section className="bg-background py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <div className="grid gap-6 sm:grid-cols-2">
              {PLAY_STORE_URL ? (
                <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <PlayCircle className="size-5" aria-hidden="true" />
                  </div>
                  <h2 className="mt-5 text-lg font-bold text-foreground">Android</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Requires Health Connect.
                  </p>
                  <a
                    href={PLAY_STORE_URL}
                    className="mt-6 inline-flex h-12 items-center gap-2 rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold px-6 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
                  >
                    <PlayCircle className="size-5" aria-hidden="true" />
                    Get it on Google Play
                  </a>
                </div>
              ) : null}
              {APP_STORE_URL ? (
                <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <Apple className="size-5" aria-hidden="true" />
                  </div>
                  <h2 className="mt-5 text-lg font-bold text-foreground">iPhone</h2>
                  <a
                    href={APP_STORE_URL}
                    className="mt-6 inline-flex h-12 items-center gap-2 rounded-full border border-[rgba(25,47,95,0.15)] bg-brand-gold px-6 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
                  >
                    <Apple className="size-5" aria-hidden="true" />
                    Download on the App Store
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
