import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Fraunces } from "next/font/google";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import EngineBootstrap from "@/components/EngineBootstrap";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

// Used for exactly one word — "average" in the hero headline. The headline
// puns on it ("an average winner" reads as mediocre; the game means "your own
// average"), so the word is set in a different voice to mark that it is doing
// double duty. Kept to a single weight and italic only, so the extra font
// costs one small file.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600"],
  style: ["italic"],
});

export const metadata: Metadata = {
  title: "ileadit — Are you an average winner?",
  description:
    "Beat yourself to beat the rest. ileadit is a game you play by walking — you compete against your own rolling average, not everyone else's step count. Anyone can win, and that's the whole point.",
};

export const viewport: Viewport = {
  themeColor: "#192f5f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // `suppressHydrationWarning` on these two elements ONLY, and deliberately:
  // browser extensions inject attributes into <html> and <body> before React
  // hydrates, which React then reports as a mismatch the app cannot fix.
  // Observed locally: `data-scribe-recorder-ready` (Scribe) on <html> and
  // `data-testim-main-word-scripts-loaded` (Testim) on <body> - neither string
  // appears anywhere in this repo. React only suppresses one level deep, so
  // this hides the extension noise on these two tags WITHOUT hiding a genuine
  // mismatch in any child. Do not spread it onto app components to quieten a
  // warning; there the warning is real.
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${fraunces.variable} h-full`} suppressHydrationWarning>
      <body
        className="flex min-h-full flex-col bg-background text-foreground antialiased"
        suppressHydrationWarning
      >
        <AuthProvider>
          {/* Skip link (WCAG 2.2 AA, 2.4.1 Bypass Blocks) — first focusable
              element on every page. Visually hidden until it receives
              keyboard focus, so a sighted mouse user never sees it, but a
              keyboard user isn't forced to tab through the full header nav
              (including the auth-state-dependent desktop nav, mobile menu
              button, etc.) on every single page just to reach the actual
              content. */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-brand-navy focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-on-navy-foreground focus:outline-2 focus:outline-offset-2 focus:outline-brand-gold"
          >
            Skip to main content
          </a>
          <EngineBootstrap />
          <Header />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
