import { AlertTriangle, PlayCircle, Smartphone } from "lucide-react";

/**
 * PLACEHOLDER STATE — read before editing.
 *
 * Android is the only platform that exists today. There is no live iOS app
 * (Gerald is building it — no ship date yet), so this page must not present
 * an App Store link or imply "download on iOS" is possible right now.
 *
 * There is also no real Play Store URL yet (the app isn't listed). The
 * button below is deliberately styled as a non-functional placeholder
 * (dashed border, "PLACEHOLDER" tag, not a real <Link>/<a>) rather than a
 * finished-looking store badge pointing at "#" — a dead link that looks
 * real is worse than an honest placeholder. Swap PLAY_STORE_URL below for
 * the real listing URL and turn this into a proper <a> once it exists.
 */
const PLAY_STORE_URL = null; // e.g. "https://play.google.com/store/apps/details?id=..."

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
            Free to download, free to join a public competition. Available
            on Android today.
          </p>
        </div>
      </section>

      <section className="bg-background py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Android — placeholder link, real listing not live yet */}
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <PlayCircle className="size-5" aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-lg font-bold text-foreground">
                Android
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The live platform. Requires Health Connect.
              </p>

              {PLAY_STORE_URL ? (
                <a
                  href={PLAY_STORE_URL}
                  className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-brand-gold px-6 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold/90"
                >
                  <PlayCircle className="size-5" aria-hidden="true" />
                  Get it on Google Play
                </a>
              ) : (
                <div
                  role="note"
                  aria-label="Placeholder — Play Store link not yet available"
                  className="mt-6 inline-flex h-12 cursor-not-allowed items-center gap-2 rounded-full border-2 border-dashed border-brand-coral/50 bg-brand-coral/5 px-6 text-sm font-bold text-brand-coral"
                >
                  <PlayCircle className="size-5" aria-hidden="true" />
                  Get it on Google Play — PLACEHOLDER LINK
                </div>
              )}
              <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-brand-coral">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                Placeholder: the real Play Store listing URL must be swapped
                in here before this page ships.
              </p>
            </div>

            {/* iOS — genuinely doesn't exist, say so plainly */}
            <div className="rounded-3xl border border-dashed border-border bg-muted/40 p-6 opacity-80 sm:p-8">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Smartphone className="size-5" aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-lg font-bold text-foreground">
                iOS
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Not built yet. There is no iOS app to download today, and no
                date to announce — this section will be replaced with a real
                App Store link once one exists.
              </p>
              <div
                aria-disabled="true"
                className="mt-6 inline-flex h-12 items-center gap-2 rounded-full border-2 border-dashed border-border px-6 text-sm font-bold text-muted-foreground"
              >
                Coming later — no link yet
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
