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

All brand assets come from the Android app repo (`ileadit-app/ileadit`).

### Colours

| Name | Hex | Tailwind Token | Usage |
|---|---|---|---|
| Navy Blue | `#192F5F` | `primary` | Main brand colour, headers, dark backgrounds |
| Dark Navy | `#0D1B3D` | `primary-dark` | Cards on dark backgrounds |
| Pink/Accent | `#E91E63` | `accent` | Logo, CTA buttons, highlights |
| Coins Orange | `#F8A92F` | `secondary` | Secondary actions, rewards, coins |
| Purple | `#7755FE` | `purple` | Feature highlights |
| Progress Green | `#4CAF50` | `success` | Success states, progress |
| Error Red | `#F44336` | `error` | Error states |
| Warning Orange | `#FF9800` | `warning` | Warnings |
| Light Gray | `#E7EDF3` | `gray-light` | Backgrounds, borders |
| Text Primary | `#333333` | `text-primary` | Body text on light backgrounds |
| White | `#FFFFFF` | `white` | Text on dark backgrounds |

### Typography

- **Headings:** Inter (Google Fonts) — clean, modern, works well at large sizes
- **Body:** Inter — same family for consistency
- **Fallback:** system-ui, sans-serif

### Logo

The app icon is in the Android repo at:
- `app/src/main/res/drawable/ic_launcher_foreground.xml` (vector)
- `app/src/main/res/drawable/logo_min.xml` (minimal version)
- `app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp` (raster, largest)

The logo is a pink (`#E91E63`) circle mark on navy (`#192F5F`) background.

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
