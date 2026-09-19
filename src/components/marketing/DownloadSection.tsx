import Link from "next/link";
import { Apple, PlayCircle } from "lucide-react";

/**
 * Deviation from the design spec: the spec pointed both store buttons at
 * `href="#"` (dead links). This repo has a real `/download` page (App
 * Store / Play Store links land there once they exist), so both CTAs go
 * there instead — a `#` link that does nothing fails "no non-functional
 * control presented as working."
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
          Free to download, free to join a public competition. Bring your
          workplace in whenever you&apos;re ready.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/download"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-on-navy-border bg-white/5 px-6 text-sm font-bold text-on-navy-foreground transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Apple className="size-5" aria-hidden="true" />
            Download on the App Store
          </Link>
          <Link
            href="/download"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-on-navy-border bg-white/5 px-6 text-sm font-bold text-on-navy-foreground transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <PlayCircle className="size-5" aria-hidden="true" />
            Get it on Google Play
          </Link>
        </div>
      </div>
    </section>
  );
}
