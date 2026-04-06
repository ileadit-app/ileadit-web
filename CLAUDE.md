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

### `users/{userId}`
Key fields: `uid`, `firstName`, `surname`, `email`, `lives`, `coins`, `points`, `todaySteps`, `dailyAverageSteps`, `profileImageUrl`, `isAdmin`

### `competitions/{competitionId}`
Key fields: `name`, `description`, `startTime` (Timestamp), `durationDays`, `playerCount`, `creatorId`

New fields added by the web portal (backwards-compatible):
- `visibility`: `"public"` or `"private"`
- `inviteCode`: 8-char alphanumeric
- `maxPlayers`: int
- `tier`: `"free"`, `"pro"`, `"enterprise"`
- `branding`: `{ color, logoUrl }` (Pro tier only)
- `createdVia`: `"web"`

### `competitions/{competitionId}/players/{userId}`
Key fields: `userId`, `firstName`, `lastName`, `joinedAt`, `points`, `livesRemaining`, `eliminated`

### `subscriptions/{userId}` (NEW — web portal only)
Fields: `stripeCustomerId`, `stripeSubscriptionId`, `tier`, `status`, `currentPeriodEnd`, `maxCompetitions`, `maxPlayersPerCompetition`

### `invites/{inviteCode}` (NEW — web portal only)
Fields: `competitionId`, `createdBy`, `createdAt`, `maxUses`, `useCount`, `expiresAt`

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
