// @vitest-environment node
import { describe, expect, test } from "vitest";
import {
  AA_NORMAL_TEXT_MIN_CONTRAST,
  compositeOver,
  contrastRatio,
  type HexColor,
} from "./colorContrast";

/**
 * WEB-CR1-FIX2 (28 Oct 2026 independent review). WEB-CR1 darkened
 * `--color-coral-text` to 5.43-5.63:1 against the two backgrounds it was
 * CHECKED against at the time (page/card) — but never against every
 * background a coral text class actually renders on in this codebase, and
 * never against the COMPOSITED colour a Tailwind opacity modifier
 * (`text-coral-text/90`) or a translucent fill (`bg-destructive/10`)
 * actually produces (the browser never shows the raw token colour in
 * either case). This file computes the real composited ratio for every
 * distinct (foreground, background) pairing a coral/destructive text class
 * is actually used with in `src/`, each citing where it's used, and fails
 * under WCAG AA's 4.5:1 for normal text.
 *
 * Three real failures were found and fixed by this same ticket — see the
 * individual test comments below for the fix in each case. Any new coral
 * text use added to this codebase should get a case added here BEFORE
 * shipping, not after a review catches it a second time.
 */

// Hex values duplicated from src/app/globals.css's `@theme inline` block —
// keep in sync by hand; this file cannot import CSS custom properties.
const TOKEN = {
  coralText: "#b83a46" as HexColor, // --color-coral-text
  coralOnNavy: "#ff8a93" as HexColor, // --color-coral-on-navy
  brandCoral: "#d14451" as HexColor, // --color-brand-coral / --color-destructive (same hex)
  mutedForeground: "#44566c" as HexColor, // --color-muted-foreground
  navy: "#192f5f" as HexColor, // --color-primary / --color-brand-navy
  background: "#fafbfb" as HexColor, // --color-background
  card: "#ffffff" as HexColor, // --color-card
  secondary: "#eef0f7" as HexColor, // --color-secondary
  muted: "#e9ebf3" as HexColor, // --color-muted
} as const;

type Case = {
  name: string;
  fg: HexColor;
  bg: HexColor;
  citation: string;
};

const CASES: Case[] = [
  {
    name: "text-coral-text on bg-background (plain eyebrow labels)",
    fg: TOKEN.coralText,
    bg: TOKEN.background,
    citation:
      "e.g. src/app/dashboard/page.tsx:67, src/components/marketing/HowItWorksSection.tsx:31, src/components/account/AccountView.tsx:53",
  },
  {
    name: "text-coral-text on bg-card (plain eyebrow labels / headings)",
    fg: TOKEN.coralText,
    bg: TOKEN.card,
    citation:
      "e.g. src/components/competitions/CompetitionDetail.tsx:237,282,307, src/components/marketing/PricingSection.tsx:18",
  },
  {
    name: "text-coral-text on bg-secondary (plain eyebrow labels)",
    fg: TOKEN.coralText,
    bg: TOKEN.secondary,
    citation:
      "e.g. src/components/marketing/PrivacySection.tsx:26, src/components/marketing/AverageMechanicSection.tsx:42, src/app/about/page.tsx:133",
  },
  {
    name: "text-coral-on-navy on bg-brand-navy (TodayCard eyebrow + lives hearts, HeroSection points label)",
    fg: TOKEN.coralOnNavy,
    bg: TOKEN.navy,
    citation:
      "src/components/competitions/TodayCard.tsx:32,58,96, src/components/marketing/HeroSection.tsx:351 — FIX: previously text-coral-text (2.31:1) / text-brand-coral (2.89:1) directly on this navy background",
  },
  {
    name: "text-coral-text on a bg-destructive/10 chip over bg-background (error banners)",
    fg: TOKEN.coralText,
    bg: compositeOver(TOKEN.brandCoral, TOKEN.background, 0.1),
    citation:
      "src/components/auth/formFields.tsx:20 (ErrorBanner), src/components/EngineBootstrap.tsx:99, src/components/dashboard/CreatedCompetitions.tsx:88, src/components/dashboard/PlayingCompetitions.tsx:84",
  },
  {
    name: "text-coral-text on a bg-brand-coral/10 chip over bg-card (average-mechanic tier chip)",
    fg: TOKEN.coralText,
    bg: compositeOver(TOKEN.brandCoral, TOKEN.card, 0.1),
    citation: "src/components/marketing/AverageMechanicSection.tsx:31 TONE_CLASSES.coral",
  },
  {
    name: "text-coral-text on a bg-brand-coral/10 chip over bg-card (leaderboard 'wrapping up' banner)",
    fg: TOKEN.coralText,
    bg: compositeOver(TOKEN.brandCoral, TOKEN.card, 0.1),
    citation: "src/components/competitions/CompetitionLeaderboard.tsx:308 (inside the bg-card leaderboard panel)",
  },
  {
    name: "text-coral-text on a bg-brand-coral/15 chip over bg-card (leaderboard rank-3 badge)",
    fg: TOKEN.coralText,
    bg: compositeOver(TOKEN.brandCoral, TOKEN.card, 0.15),
    citation: "src/components/competitions/CompetitionLeaderboard.tsx:52 RANK_BADGE_CLASSNAME[3]",
  },
  {
    name: "text-coral-text on a bg-brand-coral/5 chip over bg-background (placeholder app-store badge)",
    fg: TOKEN.coralText,
    bg: compositeOver(TOKEN.brandCoral, TOKEN.background, 0.05),
    citation: "src/app/download/page.tsx:74, src/components/invite/InviteCodeLanding.tsx:208",
  },
  {
    name: "text-coral-text on a bg-muted/40 chip over bg-background ('Get the app' placeholder block)",
    fg: TOKEN.coralText,
    bg: compositeOver(TOKEN.muted, TOKEN.background, 0.4),
    citation: "src/components/invite/InviteCodeLanding.tsx:191 (parent: bg-muted/40 block)",
  },
];

describe("coral text contrast — every real (foreground, background) pairing in src/", () => {
  for (const { name, fg, bg, citation } of CASES) {
    test(`${name} meets WCAG AA 4.5:1 — ${citation}`, () => {
      const ratio = contrastRatio(fg, bg);
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MIN_CONTRAST);
    });
  }
});

describe("fixed regressions — these previously failed and must stay fixed", () => {
  test("text-coral-on-navy, not text-coral-text, on bg-brand-navy (was 2.31:1)", () => {
    expect(contrastRatio(TOKEN.coralText, TOKEN.navy)).toBeLessThan(AA_NORMAL_TEXT_MIN_CONTRAST);
    expect(contrastRatio(TOKEN.coralOnNavy, TOKEN.navy)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MIN_CONTRAST);
  });

  test("text-coral-on-navy, not text-brand-coral, on bg-brand-navy (was 2.89:1)", () => {
    expect(contrastRatio(TOKEN.brandCoral, TOKEN.navy)).toBeLessThan(AA_NORMAL_TEXT_MIN_CONTRAST);
    expect(contrastRatio(TOKEN.coralOnNavy, TOKEN.navy)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MIN_CONTRAST);
  });

  test("text-coral-text/90 composited on a bg-destructive/10 chip over bg-background measured 4.08:1 — the fix drops the opacity modifier or swaps to text-muted-foreground, never ships the /90 composite", () => {
    const chipBackground = compositeOver(TOKEN.brandCoral, TOKEN.background, 0.1);
    const opacityComposited = compositeOver(TOKEN.coralText, chipBackground, 0.9);
    // Pin the exact failure this ticket found, so nobody reintroduces
    // text-coral-text/90 on this fill believing it's fine.
    expect(contrastRatio(opacityComposited, chipBackground)).toBeLessThan(AA_NORMAL_TEXT_MIN_CONTRAST);
    // The two fixes actually shipped (src/components/dashboard/CreatedCompetitions.tsx,
    // PlayingCompetitions.tsx use text-muted-foreground; CompetitionDetail.tsx drops
    // the /90 suffix) both clear the bar on the same chip background.
    expect(contrastRatio(TOKEN.mutedForeground, chipBackground)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT_MIN_CONTRAST,
    );
    expect(contrastRatio(TOKEN.coralText, chipBackground)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MIN_CONTRAST);
  });
});
