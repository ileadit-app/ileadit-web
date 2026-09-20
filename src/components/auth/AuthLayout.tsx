import type { ComponentType, ReactNode } from "react";
import { Lock, Smartphone, Trophy } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

/**
 * Shared shell for `/login` and `/signup` (sign-in design spec §3,
 * automation-hub/docs/ileadit-web-signin-design-20260920.md). Renders inside
 * `<main>` — Header/Footer already wrap every page (`src/app/layout.tsx`),
 * so this deliberately does NOT reimplement any chrome.
 *
 * The desktop-only "brand panel" reuses the exact glow/eyebrow-pill recipe
 * already shipped in `HeroSection.tsx` and the "card wrapping a navy panel"
 * shape from `PricingSection.tsx`, per the spec's explicit call to match
 * those rather than the Figma mobile takeover (see spec §1, point 4).
 */
const COPY = {
  signin: {
    headline: "Good to see you again.",
    subcopy:
      "Sign in and you're straight back to your coins, your lives, and every competition you're in.",
  },
  signup: {
    headline: "Same game. Now on your laptop too.",
    subcopy:
      "One ileadit account works everywhere — sign up here and it's the exact same account you'd get in the app.",
  },
} as const;

export function AuthLayout({
  mode,
  children,
}: {
  mode: "signin" | "signup";
  children: ReactNode;
}) {
  const copy = COPY[mode];

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-6 sm:py-20 lg:py-24">
      <div className="overflow-hidden rounded-3xl border border-border bg-card lg:grid lg:grid-cols-[1fr_1.15fr]">
        {/* Brand panel — hidden below lg, not shrunk: at phone width the
            global Header already carries logo/brand context, so repeating a
            navy hero above the form would just push the actual task (signing
            in) below the fold (spec §3, "Mobile (< lg)"). */}
        <div className="relative hidden overflow-hidden bg-brand-navy p-10 text-on-navy-foreground lg:flex lg:flex-col lg:justify-between">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-pink/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-20 left-[-10%] h-72 w-72 rounded-full bg-brand-gold/15 blur-3xl"
          />

          <div className="relative">
            <Logo variant="light" />
            <span className="mt-8 inline-flex items-center rounded-full border border-on-navy-border bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-gold">
              One account, every device
            </span>
            <h2 className="mt-4 text-2xl font-extrabold leading-tight text-on-navy-foreground sm:text-3xl">
              {copy.headline}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-on-navy-muted">{copy.subcopy}</p>

            <div className="mt-8 space-y-4">
              <ReassuranceRow icon={Smartphone} text="Same coins, lives and competitions as the app" />
              <ReassuranceRow icon={Lock} text="Your step count stays private, always" />
              <ReassuranceRow icon={Trophy} text="Jump straight back into your leaderboards" />
            </div>
          </div>

          <p className="relative text-xs text-on-navy-muted/80">
            Building competitions for your team? You&apos;ll set that up right after this.
          </p>
        </div>

        {/* Form panel — always shown */}
        <div className="p-8 sm:p-12">{children}</div>
      </div>
    </div>
  );
}

function ReassuranceRow({ icon: Icon, text }: { icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-brand-gold" aria-hidden="true" />
      <span className="text-sm font-medium text-on-navy-foreground">{text}</span>
    </div>
  );
}
