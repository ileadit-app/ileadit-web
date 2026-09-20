# ileadit Web Portal

## What This Is

Marketing website and competition creation portal for the ileadit mobile game. Hosted at `ileadit.app`.

ileadit is a game where walking/steps is the input mechanic — "a game that requires movement, NOT a fitness app." Players compete on points, never on step counts. Step counts are private.

## Tech Stack

- **Framework:** Next.js 14 (App Router) with TypeScript
- **Styling:** Tailwind CSS
- **Auth:** Firebase Auth (shared with the Android app)
- **Database:** Firestore (shared with the Android app — project `ileadit-app`)
- **Payments:** Stripe Checkout + Billing Portal
- **Hosting:** Firebase Hosting
- **CI/CD:** GitHub Actions → Firebase Hosting on merge to main

## Firebase Project

- **Project ID:** `ileadit-app`
- **Project Number:** `783478543765`
- The web portal uses the SAME Firebase project as the Android app. Same auth, same Firestore collections.

## Brand System

> **Rewritten 2026-09-19 (ticket W-2).** This replaces the pink/Inter palette below, which was the
> pre-rebuild brand. Paul approved Lacey Bedspread's design system (see
> `automation-hub/docs/ileadit-web-landing-design-20260919.md`, the approved landing page spec) as
> the current brand direction for the web portal. The Android app's own in-app colours have **not**
> been re-themed as part of this change — this table describes the web portal only. If the two ever
> diverge further, treat this file as the source of truth for `ileadit-web`.

All brand tokens are wired as CSS custom properties in `src/app/globals.css` (`@theme inline`),
which auto-generates the matching Tailwind utility classes (`bg-primary`, `text-brand-gold`, etc).

### Colours

| Name | Hex | Tailwind Token | Usage |
|---|---|---|---|
| Navy | `#192F5F` | `primary` / `brand-navy` | Main brand colour, hero/footer dark sections, headings |
| Deep Navy | `#101F42` | `brand-navy-deep` | Darkest navy, rarely used directly |
| Light Navy | `#2A4478` | `brand-navy-light` | Lighter navy accents |
| Gold | `#F8A92F` | `accent` / `brand-gold` | Primary CTA colour, rewards, the energetic accent |
| Coral | `#D14451` | `destructive` / `brand-coral` | Warnings, lives lost, eyebrow labels |
| Pink/Magenta | `#E94F8A` | `brand-pink` | Decorative accent (hero background glow) |
| Cream | `#FBF6EC` | `brand-cream` | Warm off-white, spot usage |
| Background | `#FAFBFB` | `background` | Page background |
| Foreground | `#12172A` | `foreground` | Body text on light backgrounds |
| Muted text | `#44566C` | `muted-foreground` | Secondary/body copy on light backgrounds — passes 4.5:1 on `#FAFBFB` (7.25:1 measured). **Do not use `#8A97AC`** for body text on light backgrounds; it fails contrast (2.85:1). |
| On-navy text | `#FFFFFF` | `on-navy-foreground` | Primary text on navy backgrounds |
| On-navy muted | `#AAB4D1` | `on-navy-muted` | Secondary text on navy backgrounds (6.3:1 on `#192F5F`) |
| Border | `#DFE2EE` | `border` | Card/input borders on light backgrounds |

### Typography

- **Headings & body:** Plus Jakarta Sans (Google Fonts, via `next/font/google`) — one family for the
  whole site, matches the approved design spec.
- **Fallback:** ui-sans-serif, system-ui, sans-serif.

### Logo

**The real, shipped ileadit mark** — not a placeholder or an invented graphic — is reproduced in
`src/components/brand/Logo.tsx`. It's sourced from the Android app repo's
`app/src/main/res/drawable/splash_logo_circle.xml`: a circular badge with a gold-to-pink diagonal
gradient (`#F7A82F` → `#BC1062`) and three navy (`#192F5F`) parallelogram "steps" climbing across
it. The path data and gradient stops in `Logo.tsx` are copied 1:1 from that vector.

The Figma file (colour logo node `1:22819` and variants) is the canonical source per the Figma style
guide, but the shared Figma API token was expired (`403 Token expired`) at the time this page was
built — re-pull from Figma and swap into `Logo.tsx` when the token is refreshed, rather than treating
the current SVG as permanent. The Android app's launcher icon (a separate asset,
`app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp`, pink-on-transparent "steps" foreground over a
solid pink adaptive-icon background) is a different mark from the splash badge used here — don't
conflate the two when asked for "the app icon" specifically.

For the website, export or recreate the logo as SVG. Place in `public/logo.svg` and `public/logo-white.svg` (for dark backgrounds).

## Firestore Collections (Shared with Android App)

> **This section was rewritten 2026-09-19 against the rebuilt engine at commit `c91f9e3`
> (`admin-web/firestore.rules`, `functions/src/services/{accounts,competitions,ledger}.ts` in the
> sibling `ileadit` repo). The version before this rewrite described a pre-rebuild (phase-1) schema
> that the current rules actively reject — see
> `automation-hub/docs/ileadit-web-gap-audit-20260919.md` for the full diff and reasoning. The
> headline fact that does not change with any future edit to this file:
> **the web portal never writes Firestore game state directly — every mutation goes through an
> engine Cloud Functions callable (`src/lib/functions.ts`, region `europe-west2`).** Reads below are
> marked per-field with who may read them; "portal: no" means genuinely no client-side read path
> exists, not just "we choose not to."**

### `users/{userId}` — public profile ONLY
Fields: `displayName`, `avatarIndex`, `profileImageUrl`, `city`, `createdAt`.
Portal may **read** (any signed-in user) and the *owner* may **update** `displayName`/`avatarIndex`/
`profileImageUrl`/`city` directly (client SDK, rules-permitted — this is the one place a direct
client write of this collection is legal). `create` is engine-only (`ensureAccount` callable) —
the portal must never attempt `setDoc`/`addDoc` here.
**Removed from this doc since the last version of this file:** `uid`, `firstName`, `surname`,
`email`, `lives`, `coins`, `points`, `todaySteps`, `dailyAverageSteps`, `isAdmin` — none of these
exist at this path any more. See below for where they actually live, and note two of them
(`todaySteps`, `dailyAverageSteps`) must never be read/displayed by the portal even at their real
location (Privacy Rules, below).

### `users/{userId}/private/profile` — real name/PII fields
Fields: `firstName`, `surname`, `dateOfBirth`, `gender`, `country`, `notificationsEnabled`,
`profileCompleted`, plus `email` (engine-written, copied from the auth token at account creation —
**never** client-writable, deliberately excluded from the owner's own write list).
Portal: **owner-read only**, owner-write restricted to the seven fields listed (not `email`). Not
readable by anyone else, including an admin-claim holder.

### `users/{userId}/private/game` — engine game state
Fields include `coins`, `lifetimePoints`, `competitionHistory`, `activeCompetitionIds`, `timeZone`,
`average`, warm-up/close bookkeeping (`warmupEndsOn`, `nextCloseAt`, `lastClosedDate`,
`closeFailures`, …), `reminder`. **There is no `lives` field here or anywhere else at account
level** — lives are per-competition (see `players/{userId}` below).
Portal: **owner-read only. Write: `if false` for every client, always** — this is the coin/points
source of truth and it is engine-only by design (ledger invariant, see Stripe note below). Any code
path that would `updateDoc` here to reflect a coin purchase or similar is invalid at the rules
level, full stop.

### `users/{userId}/days/{date}` — raw step/point records
Portal: **must not read or display, ever**, even though the rules technically allow the *owner* to
read their own day record (Privacy Rules, below — this is a project-level ban stricter than the
rules). Engine-write only.

### `users/{userId}/private/trust` — anti-cheat flags
Portal: **no read path at all** for a normal user, even the account owner. Admin-claim read only.
Engine-write only. The portal has no legitimate reason to touch this.

### Admin identity — NOT a Firestore field
`isAdmin` does not exist anywhere in the data model. Admin identity is the custom Firebase Auth
claim `request.auth.token.admin`, set out-of-band. **Claims only reach the client on token
refresh** — any admin-gated UI must force `getIdToken(true)` after sign-in (see `src/lib/adminClaim.ts`
below) or a freshly-granted claim will appear absent.

### `competitions/{competitionId}`
**Engine fields** (derived by the `onCompetitionWritten` trigger / `competitionLifecycle` job —
**unwritable by any client, including the admin claim, ever**): `status`, `startDate`, `endDate`,
`timeZone`, `playerCount`, `finalisedAt`, `winnerIds`, `configVersion`.

**Admin fields** (writable only by the doc's `creatorId` or the `admin` custom claim, and — critical
— **`create` is currently gated to the `admin` claim ONLY, not "creator or admin"**; there is no
creator UI today and this is a deliberate, documented engine decision, not an oversight):
`name`, `description`, `imageUrl`, `backgroundImageUrl`, `startTime` (Timestamp), `durationDays`
(positive int), `updatedAt`. `creatorId` and `createdAt` may only be set at create time (`creatorId`
must equal the caller's own uid) and are immutable afterwards.

**PROPOSED — not backed by the engine, do not build against these:** `visibility`, `inviteCode`,
`maxPlayers`, `tier`, `branding`, `createdVia`. These six fields have **no server-side home at all**
— a client document containing any of them is rejected outright at the rules door (not silently
dropped). They require engine tickets E4-web-1 (`createCompetition` callable), E4-web-3
(organisation/tenant model — foundational, nothing B2B-shaped can be scoped without it first), and
E4-web-4 (bulk invite) before any web UI can be built against them. See the gap audit §2.1–§3 for
the full reasoning; do not reintroduce these as "real" schema fields until one of those tickets
ships.

### `competitions/{competitionId}/players/{userId}`
Fields (written only by the `joinCompetition` callable, never by a client): `displayName`,
`avatarIndex`, `points`, `todayPoints`, `livesRemaining` (seeded to a starting value at join,
decremented by the engine's daily close job), `eliminated`.
Portal: **read requires the reader to be a member of that same competition themselves** (proven via
an `exists()` check on the reader's own player doc) — an org admin who isn't personally playing has
**no read path to this today**. This is a known gap (audit §2.4/§4.1, ticket E4-web-2), not a bug
to work around client-side.
**Removed from this doc since the last version of this file:** `userId`, `firstName`, `lastName`,
`joinedAt` — none of these are the real field names; use `displayName`/`joinedOn` (on the nested
`private/state` doc, owner-read only) instead.

### `subscriptions/{userId}` and `invites/{inviteCode}` — REMOVED, no server-side home
Both collections from the previous version of this file have **no rules block at all** in the
engine's `firestore.rules` — every unmatched path denies both read and write by default. Neither is
engine-owned (nothing in `functions/src` writes them) nor portal-writable (default deny). Do not
create these collections from the portal, directly or via any admin SDK code path, until an engine
ticket (E4-web-5/6 for subscriptions, E4-web-4 for invites) gives them a real, engine-aware home —
see the gap audit §2.2, §2.5, §5.

## Privacy Rules — ABSOLUTE

- **NEVER expose step counts on the website.** Leaderboards show points only.
- **NEVER use the word "fitness" in marketing copy.** ileadit is a game.
- **NEVER store email addresses from invite forms** after sending.
- **No tracking pixels or analytics without GDPR consent.**
- Corporate admins see engagement/points, never step counts.
- The `todaySteps` and `dailyAverageSteps` fields in Firestore must never be read or displayed by the web portal.

## Pricing Tiers

> **STALE as of Paul's 2026-09-20 billing decision.** The table below describes a monthly
> SUBSCRIPTION. Billing is now **per competition**, transactional, with the organisation's price
> band setting the price — an org that runs nothing pays nothing. See the DECISIONS block (Q5) in
> `automation-hub/docs/ileadit-org-model-design-20260920.md`, and `src/lib/billing/priceBands.ts`,
> which holds the live band→price table sourced from `ileadit/RULES.md` §8.2. This section is left
> in place rather than rewritten here because the surrounding org model is being built on the
> `feat/org-model` branch; whoever lands that should replace this table.

| Feature | Free | Pro (GBP 9.99/mo) | Enterprise (Contact Us) |
|---|---|---|---|
| Active competitions | 1 | Unlimited | Unlimited |
| Players per competition | 10 | 50 | 250+ |
| Competition duration | Up to 7 days | Any duration | Any duration |
| Custom branding | No | Yes | Yes |

## Pages

### Public
- `/` — Landing page
- `/pricing` — Tier comparison + Stripe checkout
- `/about` — Story and mission
- `/privacy` — Privacy policy
- `/terms` — Terms of service
- `/account-deletion` — Account deletion (Play Store requirement)
- `/download` — App store links
- `/invite/[code]` — Public invite page → deep link to app

### Authenticated
- `/dashboard` — Your competitions
- `/competitions/new` — Creation wizard (4 steps: basics, players, branding, review)
- `/competitions/[id]` — Detail + leaderboard (points only)
- `/competitions/[id]/invite` — Manage invites
- `/competitions/[id]/settings` — Edit (creator only)
- `/account` — Profile + subscription
- `/account/billing` — Redirect to Stripe Billing Portal

## Standards

- **WCAG 2.2 AA** — 4.5:1 contrast, keyboard navigation, screen reader support, 44px touch targets
- **GDPR** — Cookie consent banner, essential-only without consent, privacy policy, right to deletion
- **Mobile-first** — All layouts designed for mobile first, then scale up
- **Security** — Firebase Auth for sessions, Stripe Checkout for payments (no card data), CSP headers

## What NOT to Do

- Do not create a separate Firebase project
- Do not modify existing Firestore security rules without approval
- Do not expose step counts anywhere
- Do not add analytics without GDPR consent mechanism
- Do not position ileadit as a fitness app
- Do not deploy to production without Paul's approval

## Full Specification

See `docs/ileadit-web-spec.md` in the `automation-hub` repo for the complete technical specification including data models, auth flows, Stripe integration details, and task breakdown.
