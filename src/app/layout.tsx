import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import EngineBootstrap from "@/components/EngineBootstrap";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ileadit — Are you an average winner?",
  description:
    "ileadit is a step-count game where you compete against your own rolling average, not everyone else's step count. Anyone can win — that's the whole point.",
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
    <html lang="en" className={`${plusJakartaSans.variable} h-full`} suppressHydrationWarning>
      <body
        className="flex min-h-full flex-col bg-background text-foreground antialiased"
        suppressHydrationWarning
      >
        <AuthProvider>
          <EngineBootstrap />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
