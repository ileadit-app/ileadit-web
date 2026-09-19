"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

// Nav links point at "/#section" (not "#section") so they resolve correctly
// from every route, not just from the home page itself.
const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#average", label: "Why average wins" },
  { href: "/#teams", label: "Teams" },
  { href: "/#pricing", label: "Pricing" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
        <Link href="/#top" className="shrink-0">
          <Logo />
          <span className="sr-only">ileadit home</span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-foreground/70 transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center px-3 text-sm font-semibold text-foreground/70 transition-colors hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            href="/#employer"
            className="inline-flex h-10 items-center rounded-full bg-brand-gold px-4 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
          >
            Bring it to your team
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex h-11 w-11 items-center justify-center text-foreground sm:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav aria-label="Primary" className="border-t border-border px-5 pb-4 sm:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block py-3 text-sm font-semibold text-foreground/70 transition-colors hover:text-foreground"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            className="block py-3 text-sm font-semibold text-foreground/70 transition-colors hover:text-foreground"
            onClick={() => setMenuOpen(false)}
          >
            Log in
          </Link>
          <Link
            href="/#employer"
            className="mt-2 block rounded-full bg-brand-gold px-4 py-3 text-center text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold/90"
            onClick={() => setMenuOpen(false)}
          >
            Bring it to your team
          </Link>
        </nav>
      )}
    </header>
  );
}
