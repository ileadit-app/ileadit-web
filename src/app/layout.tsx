import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import EngineBootstrap from "@/components/EngineBootstrap";
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
  return (
    <html lang="en" className={`${plusJakartaSans.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-background text-foreground antialiased">
        <EngineBootstrap />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
