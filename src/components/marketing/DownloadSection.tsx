/**
 * WEB-HONEST-1. The apps are not publicly listed yet, so this section must
 * not show store buttons. The two constants below are the ONE place the
 * homepage learns about a live listing: while they are `null` there are no
 * buttons at all (no dead links, no buttons that lead to another page
 * pretending to be a store). Set each to its real store URL when that
 * listing goes public.
 *
 * NOTE for whoever merges feat/shop-links (WEB-SHOP-LINK): that branch
 * replaces this file with a version driven by `src/lib/storeLinks.ts`. Take
 * that version on conflict and delete the two constants here; they exist
 * only because that module is not on main yet.
 */
const PLAY_STORE_URL: string | null = null;
const APP_STORE_URL: string | null = null;

const buttonClassName =
  "inline-flex h-12 items-center rounded-full border border-on-navy-border bg-white/5 px-6 text-sm font-bold text-on-navy-foreground transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export function DownloadSection() {
  const hasListing = Boolean(PLAY_STORE_URL || APP_STORE_URL);

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
          The app
        </p>
        <h2 className="mx-auto mt-3 max-w-2xl text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          Your average is waiting. Go find out if you&apos;re a winner.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-on-navy-muted">
          Free to join a public competition. Bring your workplace in
          whenever you&apos;re ready.
        </p>

        {hasListing ? (
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {APP_STORE_URL ? (
              <a href={APP_STORE_URL} className={buttonClassName}>
                Download on the App Store
              </a>
            ) : null}
            {PLAY_STORE_URL ? (
              <a href={PLAY_STORE_URL} className={buttonClassName}>
                Get it on Google Play
              </a>
            ) : null}
          </div>
        ) : (
          <p className="mx-auto mt-8 max-w-xl text-base font-semibold text-on-navy-foreground">
            ileadit isn&apos;t in the app stores yet. Store links will appear
            here as soon as it is.
          </p>
        )}
      </div>
    </section>
  );
}
