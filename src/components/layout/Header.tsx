"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useUser } from "@/context/AuthContext";
import type { User } from "firebase/auth";

// Nav links point at "/#section" (not "#section") so they resolve correctly
// from every route, not just from the home page itself.
const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#average", label: "Why average wins" },
  { href: "/#teams", label: "Teams" },
  { href: "/#pricing", label: "Pricing" },
];

const authLinkClassName =
  "inline-flex h-10 items-center px-3 text-sm font-semibold text-foreground/70 transition-colors hover:text-foreground";
const mobileAuthLinkClassName =
  "block w-full py-3 text-left text-sm font-semibold text-foreground/70 transition-colors hover:text-foreground";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  // `status`, not `user` — see src/context/AuthContext.tsx for why. Gating
  // this on `user` alone would show "Log in" for one frame to every
  // already-signed-in returning visitor before Firebase resolves the
  // persisted session.
  const { status, user, signOut } = useUser();

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    router.push("/");
  }

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
          {status === "loading" ? (
            // Neutral skeleton, same slot — avoids flashing "Log in" then
            // swapping to the avatar a moment later (spec §6).
            <div className="h-10 w-24 animate-pulse rounded-full bg-muted" aria-hidden="true" />
          ) : status === "signed-in" && user ? (
            <>
              <Link href="/dashboard" className={authLinkClassName}>
                Dashboard
              </Link>
              <AccountMenu user={user} onSignOut={() => void handleSignOut()} />
            </>
          ) : (
            <>
              <Link href="/login" className={authLinkClassName}>
                Log in
              </Link>
              <Link
                href="/#employer"
                className="inline-flex h-10 items-center rounded-full bg-brand-gold px-4 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
              >
                Bring it to your team
              </Link>
            </>
          )}
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

          {status === "loading" ? (
            <div className="my-3 h-10 w-24 animate-pulse rounded-full bg-muted" aria-hidden="true" />
          ) : status === "signed-in" && user ? (
            <div className="border-t border-border pt-3">
              <div className="flex items-center gap-3 pb-2">
                <Avatar user={user} className="size-10" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{user.displayName || user.email}</p>
                </div>
              </div>
              <Link href="/dashboard" className={mobileAuthLinkClassName} onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
              <Link href="/account" className={mobileAuthLinkClassName} onClick={() => setMenuOpen(false)}>
                Account
              </Link>
              <button type="button" className={mobileAuthLinkClassName} onClick={() => void handleSignOut()}>
                Sign out
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="block py-3 text-sm font-semibold text-foreground/70 transition-colors hover:text-foreground"
                onClick={() => setMenuOpen(false)}
              >
                Log in
              </Link>
              <Link
                href="/#employer"
                className="mt-2 block rounded-full bg-brand-gold px-4 py-3 text-center text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
                onClick={() => setMenuOpen(false)}
              >
                Bring it to your team
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}

/** Avatar: `photoURL` from the signed-in provider profile (Google/Microsoft)
 * when present, else an initial-letter badge — falling back from
 * `displayName` to the email local-part so an email/password signup with no
 * name set yet still gets a non-broken avatar (spec §6, decision #4's
 * concrete edge case). Header has no Firestore read of its own, so this
 * deliberately uses the Firebase Auth user's `photoURL`, not the
 * `users/{uid}.profileImageUrl` Firestore field the spec names — the two are
 * usually the same picture for an OAuth sign-in and adding a Firestore query
 * here is out of scope for this ticket. */
function Avatar({ user, className }: { user: User; className: string }) {
  if (user.photoURL) {
    // eslint-disable-next-line @next/next/no-img-element -- external, unknown-dimension provider avatar
    return <img src={user.photoURL} alt="" className={`${className} shrink-0 rounded-full object-cover`} />;
  }
  const initial = (user.displayName?.[0] ?? user.email?.[0] ?? "?").toUpperCase();
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-brand-gold font-bold text-brand-navy`}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

/** Desktop account menu — a native `<details>` disclosure so opening,
 * closing and "click outside to close" all come from the browser for free,
 * with no extra state/listener wiring. */
function AccountMenu({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const name = user.displayName || user.email || "Your account";
  return (
    <details className="relative">
      <summary
        className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full [&::-webkit-details-marker]:hidden"
        aria-label="Account menu"
      >
        <Avatar user={user} className="size-10" />
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-48 rounded-2xl border border-border bg-card p-2 shadow-lg">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          {user.displayName && user.email ? (
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          ) : null}
        </div>
        <div className="my-1 border-t border-border" />
        <Link href="/account" className="block rounded-xl px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary">
          Account
        </Link>
        <button
          type="button"
          onClick={onSignOut}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-secondary"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </details>
  );
}
