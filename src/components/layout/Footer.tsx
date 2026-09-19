import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const FOOTER_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#average", label: "Why average wins" },
  { href: "/#teams", label: "Teams" },
  { href: "/#privacy", label: "Privacy" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/download", label: "Download" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms" },
  { href: "/account-deletion", label: "Account deletion" },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 sm:flex-row sm:justify-between sm:px-6">
        <Logo />
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
        >
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} ileadit. Average is the whole
          point.
        </p>
      </div>
    </footer>
  );
}
