import { StoreButtons } from "@/components/StoreButtons";
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  storeAvailabilityCopy,
} from "@/lib/storeLinks";

/**
 * Store buttons and the availability sentence both come from
 * `src/lib/storeLinks.ts`. While no listing is public there are no buttons,
 * just the early-access sentence — no dead `#` links and no buttons that
 * lead to another page pretending to be a store.
 */
export function DownloadSection() {
  return (
    <section
      id="download"
      className="relative overflow-hidden bg-brand-navy py-20 text-on-navy-foreground sm:py-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-10%] top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-brand-pink/15 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-5 text-center sm:px-6">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-gold">
          Get the app
        </p>
        <h2 className="mx-auto mt-3 max-w-2xl text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          Your average is waiting. Go find out if you&apos;re a winner.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-on-navy-muted">
          Free to join a public competition. Bring your workplace in
          whenever you&apos;re ready.
        </p>

        <p className="mx-auto mt-4 max-w-xl text-base text-on-navy-muted">
          {storeAvailabilityCopy(PLAY_STORE_URL, APP_STORE_URL)}
        </p>
        <StoreButtons tone="dark" className="mt-8 justify-center" />
      </div>
    </section>
  );
}
