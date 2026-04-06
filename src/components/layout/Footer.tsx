import Link from "next/link";

const footerLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/account-deletion", label: "Account Deletion" },
  { href: "/download", label: "Download" },
];

export default function Footer() {
  return (
    <footer className="bg-primary-dark text-white">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <nav className="flex flex-wrap gap-6 text-sm">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="mt-6 text-xs text-white/60">
          &copy; {new Date().getFullYear()} ileadit. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
