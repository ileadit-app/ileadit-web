"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Check, Coins, LogOut, Trophy } from "lucide-react";
import type { User } from "firebase/auth";
import { useUser } from "@/context/AuthContext";
import { ErrorBanner } from "@/components/auth/formFields";
import { TextField, ToggleField } from "@/components/forms/fields";
import { providerLabelForMethod } from "@/lib/authCopy";
import {
  updatePrivateProfile,
  updatePublicProfile,
  useAccountProfile,
  type GameSummary,
  type PrivateProfile,
  type PublicProfile,
} from "@/lib/accountProfile";

/**
 * /account (P1.6). Mounted by `src/app/account/page.tsx` inside
 * `<ProtectedRoute>`, so by the time this renders `status === "signed-in"`
 * is already guaranteed and `useUser().user` is non-null.
 *
 * See `src/lib/accountProfile.ts`'s header comment for the full rule
 * citations behind every read here, and for exactly which fields are
 * deliberately excluded (the step-derived `average`) or shown read-only
 * despite being rules-writable (`avatarIndex`, `profileImageUrl`,
 * `profileCompleted`).
 */
export function AccountView() {
  const { user } = useUser();
  if (!user) return null; // Unreachable under ProtectedRoute — narrows the type below.
  return <AccountContent user={user} />;
}

function AccountContent({ user }: { user: User }) {
  const router = useRouter();
  const { signOut } = useUser();
  const profileState = useAccountProfile(user.uid);

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  const providerId = user.providerData[0]?.providerId ?? "password";

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">Account</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        Your account
      </h1>
      <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">
        What ileadit knows about you, and what you can change.
      </p>

      {/* Firebase Auth's own user object — not a Firestore read, so there is
          no rule to cite here. */}
      <Card>
        <CardHeading>Signed in as</CardHeading>
        <p className="mt-2 text-base font-semibold text-foreground">{user.email}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          via {providerLabelForMethod(providerId)}
        </p>
      </Card>

      {profileState.status === "loading" ? <LoadingCard /> : null}
      {profileState.status === "error" ? (
        <Card>
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div>
              <p className="text-base font-bold text-destructive">
                We couldn&apos;t load your account details
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Try reloading the page. If this keeps happening, email{" "}
                <a href="mailto:hello@ileadit.app" className="font-semibold underline">
                  hello@ileadit.app
                </a>
                .
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {profileState.status === "success" ? (
        <>
          <PublicProfileCard uid={user.uid} initial={profileState.publicProfile} />
          <PrivateProfileCard uid={user.uid} initial={profileState.privateProfile} />
          <GameStatsCard game={profileState.game} />
        </>
      ) : null}

      <Card>
        <CardHeading>Data &amp; privacy</CardHeading>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Read how ileadit handles your data, or ask us to delete your account.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/privacy"
            className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Privacy policy
          </Link>
          <Link
            href="/account-deletion"
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-destructive/40 px-4 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            Delete my account
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </Card>

      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="mt-8 inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
      >
        <LogOut className="size-4" aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 rounded-3xl border border-border bg-card p-6 sm:p-7">{children}</div>;
}

function CardHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-foreground">{children}</h2>;
}

function LoadingCard() {
  return (
    <div className="mt-6 rounded-3xl border border-border bg-card p-6 sm:p-7" role="status" aria-live="polite">
      <div className="h-4 w-32 animate-pulse rounded-full bg-muted" />
      <div className="mt-4 h-11 w-full animate-pulse rounded-xl bg-muted" />
      <div className="mt-3 h-11 w-full animate-pulse rounded-xl bg-muted" />
      <span className="sr-only">Loading your account…</span>
    </div>
  );
}

function SaveOutcomeBanner({ outcome }: { outcome: "success" | { message: string } | null }) {
  if (!outcome) return null;
  if (outcome === "success") {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-primary" role="status">
        <Check className="size-4" aria-hidden="true" />
        Saved.
      </p>
    );
  }
  return <div className="mt-3"><ErrorBanner message={outcome.message} /></div>;
}

/**
 * `users/{uid}` — public profile. Read: firestore.rules:71 (`allow read: if
 * signedIn();`). Write of displayName/city: firestore.rules:73-103.
 *
 * Seeded from `initial` via `useState`'s lazy initializer ONLY (no
 * `useEffect` syncing it back in on every snapshot) — this component is
 * mounted for the first time once `useAccountProfile` already resolved to
 * `"success"` in the parent, so `initial` is real data on first render, and
 * a LATER live update to the same document (e.g. edited in another tab)
 * deliberately does not clobber an in-progress, unsaved edit here.
 */
function PublicProfileCard({ uid, initial }: { uid: string; initial: PublicProfile }) {
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<"success" | { message: string } | null>(null);
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setOutcome(null);

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setNameError("Give yourself a display name.");
      return;
    }
    if (trimmedName.length > 40) {
      // firestore.rules:76-77 — displayName.size() <= 40.
      setNameError("Keep it under 40 characters.");
      return;
    }
    setNameError(undefined);

    setSaving(true);
    const result = await updatePublicProfile(uid, { displayName: trimmedName, city: city.trim() });
    setSaving(false);
    setOutcome(result.status === "success" ? "success" : { message: result.message });
  }

  return (
    <Card>
      <CardHeading>Your profile</CardHeading>
      <p className="mt-1 text-sm text-muted-foreground">
        Shown to other players on leaderboards — never your steps, just your name.
      </p>
      <form onSubmit={(e) => void handleSave(e)} className="mt-4 space-y-4">
        <TextField
          label="Display name"
          value={displayName}
          onChange={setDisplayName}
          maxLength={40}
          error={nameError}
          required
        />
        <TextField label="City" value={city} onChange={setCity} placeholder="Optional" />
        <p className="text-xs text-muted-foreground">
          Avatar picker is coming soon — for now your avatar slot is #{initial.avatarIndex ?? 0}.
        </p>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-11 items-center rounded-full bg-brand-gold px-5 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
        <SaveOutcomeBanner outcome={outcome} />
      </form>
    </Card>
  );
}

/**
 * `users/{uid}/private/profile`. Read: firestore.rules:126 (`allow read: if
 * isOwner(userId);`). Write: firestore.rules:127-136, validated against
 * `profileFieldsValid()` (firestore.rules:116-125) — every `maxLength`
 * below mirrors that function's own size checks exactly. `profileCompleted`
 * is read here (for the badge) but never offered as an editable field — see
 * `updatePrivateProfile`'s comment in `src/lib/accountProfile.ts` for why.
 */
function PrivateProfileCard({ uid, initial }: { uid: string; initial: PrivateProfile }) {
  const [firstName, setFirstName] = useState(initial.firstName ?? "");
  const [surname, setSurname] = useState(initial.surname ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(initial.dateOfBirth ?? "");
  const [gender, setGender] = useState(initial.gender ?? "");
  const [country, setCountry] = useState(initial.country ?? "");
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    initial.notificationsEnabled ?? true,
  );
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<"success" | { message: string } | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setOutcome(null);
    setSaving(true);
    const result = await updatePrivateProfile(uid, {
      firstName: firstName.trim(),
      surname: surname.trim(),
      dateOfBirth,
      gender: gender.trim(),
      country: country.trim(),
      notificationsEnabled,
    });
    setSaving(false);
    setOutcome(result.status === "success" ? "success" : { message: result.message });
  }

  return (
    <Card>
      <CardHeading>Personal details</CardHeading>
      <p className="mt-1 text-sm text-muted-foreground">
        Only you can see this. Never shown to other players, employers, or on any leaderboard.
      </p>
      <form onSubmit={(e) => void handleSave(e)} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="First name" value={firstName} onChange={setFirstName} maxLength={50} />
          <TextField label="Surname" value={surname} onChange={setSurname} maxLength={50} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Date of birth"
            type="date"
            value={dateOfBirth}
            onChange={setDateOfBirth}
          />
          <TextField label="Gender" value={gender} onChange={setGender} maxLength={16} />
        </div>
        <TextField label="Country" value={country} onChange={setCountry} maxLength={56} />
        <ToggleField
          label="Notifications"
          description="Reminders and challenge updates from ileadit."
          checked={notificationsEnabled}
          onChange={setNotificationsEnabled}
        />
        {initial.profileCompleted === false ? (
          <p className="text-xs font-semibold text-brand-coral">
            Your profile isn&apos;t marked complete yet — finish setup in the app.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-11 items-center rounded-full bg-brand-gold px-5 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save details"}
        </button>
        <SaveOutcomeBanner outcome={outcome} />
      </form>
    </Card>
  );
}

/**
 * `users/{uid}/private/game` — coins and lifetime points ONLY. Read:
 * firestore.rules:144. Write: `if false` for every client
 * (firestore.rules:145) — there is nothing editable here, deliberately: no
 * form, no inputs, just two numbers and a note explaining why.
 */
function GameStatsCard({ game }: { game: GameSummary }) {
  return (
    <Card>
      <CardHeading>Your game stats</CardHeading>
      <p className="mt-1 text-sm text-muted-foreground">
        Managed automatically by ileadit as you play — nothing here is editable.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <StatTile
          icon={<Coins className="size-5" aria-hidden="true" />}
          label="Coins"
          value={game.coins}
        />
        <StatTile
          icon={<Trophy className="size-5" aria-hidden="true" />}
          label="Lifetime points"
          value={game.lifetimePoints}
        />
      </div>
    </Card>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | null }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-brand-navy">
        {icon}
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-lg font-extrabold text-foreground">{value ?? "—"}</p>
      </div>
    </div>
  );
}
