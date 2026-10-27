"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { PrizeSection } from "@/components/competitions/PrizeSection";
import { PrizeTermsView } from "@/components/competitions/PrizeTerms";
import { OrganiserPrizePanelView } from "@/components/competitions/OrganiserPrizePanel";
import { CompetitionCard } from "@/components/dashboard/CreatedCompetitions";
import { EMPTY_PRIZE_FORM_STATE, validatePrizeForm, type PrizeFormState } from "@/lib/prize";
import type { CompetitionTermsDoc } from "@/lib/competitionTerms";
import type { LeaderboardState } from "@/lib/competitionDetail";
import type { PrizeClaim } from "@/lib/prizeClaims";

/**
 * PRZ-W1 — dev-only visual-check fixture. Renders the real production
 * components introduced by this ticket (W1's `PrizeSection`, W4's
 * `PrizeTermsView`, W5's `OrganiserPrizePanelView`, W7's `CompetitionCard`)
 * against hand-built mock data, with NO Firebase/Firestore involved at all
 * — every hook-coupled component in this ticket has a pure, props-only
 * `*View`/exported sibling for exactly this reason (see `PrizeTerms.tsx`'s
 * and `OrganiserPrizePanel.tsx`'s own header comments).
 *
 * **Never shipped in production.** Gated with a hard `notFound()` whenever
 * `NODE_ENV === "production"`, matching the only two ways this repo already
 * treats "this route must not exist once deployed" (see `not-found.tsx`'s
 * own header comment on when Next calls `notFound()` for real). This file
 * is reached only by `next dev` on a developer's own machine for taking the
 * ticket's required screenshots at 1280px and 390px — it is never linked
 * from any real nav, and the production build tree-shakes nothing special
 * here beyond the guard itself actually firing.
 */
export default function DevPrizesPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-5 py-10 sm:px-6">
      <h1 className="text-xl font-extrabold text-foreground">
        Dev fixture — prizes (PRZ-W1) — not shipped in production
      </h1>

      <Section title="W1 — PrizeSection (create/edit form)">
        <PrizeSectionFixture />
      </Section>

      <Section title="W4 — PrizeTermsView (approved terms)">
        <div className="rounded-2xl border border-border">
          <PrizeTermsView terms={APPROVED_TERMS} />
        </div>
      </Section>

      <Section title="W4 — PrizeTermsView (draft, not approved)">
        <div className="rounded-2xl border border-border">
          <PrizeTermsView terms={DRAFT_TERMS} />
        </div>
      </Section>

      <Section title="W5 — OrganiserPrizePanelView (finished competition)">
        <OrganiserPrizePanelView
          competitionId="dev-comp-1"
          prize={MOCK_PRIZE}
          prizeWinners={MOCK_WINNERS}
          leaderboardState={MOCK_LEADERBOARD}
          claims={MOCK_CLAIMS}
        />
      </Section>

      <Section title="W7 — CompetitionCard (dashboard, prize line + hand-out badge)">
        <div className="grid max-w-sm gap-4">
          <CompetitionCard competition={MOCK_CARD_WITH_PRIZE} />
          <CompetitionCard competition={MOCK_CARD_READY_TO_HAND_OUT} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

/** Thin stateful wrapper so `PrizeSection` (purely controlled) has somewhere
 * to put its state in this fixture — mirrors exactly how `CreateCompetitionForm.tsx`
 * and `PrizeEditPanel.tsx` each own a `PrizeFormState` in real usage. */
function PrizeSectionFixture() {
  const [value, setValue] = useState<PrizeFormState>({
    ...EMPTY_PRIZE_FORM_STATE,
    enabled: true,
    kind: "perk",
    places: 3,
    items: [
      { place: 1, title: "£100 voucher", description: "Any major retailer" },
      { place: 2, title: "£50 voucher", description: "" },
      { place: 3, title: "£25 voucher", description: "" },
    ],
  });

  return <PrizeSection value={value} onChange={setValue} errors={validatePrizeForm(value)} />;
}

const MOCK_PRIZE = {
  kind: "perk" as const,
  places: 3 as const,
  items: [
    { place: 1 as const, title: "£100 voucher", description: "Any major retailer" },
    { place: 2 as const, title: "£50 voucher", description: "" },
    { place: 3 as const, title: "£25 voucher", description: "" },
  ],
  forfeitLoserText: null,
  adultOnly: false,
};

const MOCK_WINNERS = [
  { place: 1, uid: "uid-1", displayName: "Alex Winner", method: "points" as const },
  { place: 2, uid: "uid-2", displayName: "Sam Runner-up", method: "points" as const },
  { place: 3, uid: "uid-3", displayName: "Jo Third", method: "points" as const },
];

const MOCK_LEADERBOARD: LeaderboardState = {
  status: "success",
  players: [
    { id: "uid-1", displayName: "Alex Winner", avatarIndex: null, points: 842, todayPoints: 0, livesRemaining: 3, eliminated: false, frozenRank: 1 },
    { id: "uid-2", displayName: "Sam Runner-up", avatarIndex: null, points: 790, todayPoints: 0, livesRemaining: 2, eliminated: false, frozenRank: 2 },
    { id: "uid-3", displayName: "Jo Third", avatarIndex: null, points: 701, todayPoints: 0, livesRemaining: 1, eliminated: false, frozenRank: 3 },
  ],
};

const MOCK_CLAIMS: PrizeClaim[] = [
  { uid: "uid-1", place: 1, status: "given", givenAt: null },
  { uid: "uid-2", place: 2, status: "ready", givenAt: null },
  { uid: "uid-3", place: 3, status: "waiting", givenAt: null },
];

const APPROVED_TERMS: CompetitionTermsDoc = {
  version: "v2",
  html:
    "<h2>Prize terms</h2><p>Top 3 finishers win a shopping voucher. Winners are notified in-app and the organiser hands over the prize outside ileadit.</p><p>By entering, you confirm the details you provided (including date of birth where relevant) are accurate.</p>",
  generatedAt: null,
  approvedTemplateVersion: "v2",
};

const DRAFT_TERMS: CompetitionTermsDoc = {
  version: "v1",
  html: "<h2>Prize terms (draft)</h2><p>These terms are still being finalised and may change before the competition starts.</p>",
  generatedAt: null,
  approvedTemplateVersion: "DRAFT-NOT-APPROVED",
};

const MOCK_CARD_WITH_PRIZE = {
  id: "dev-comp-1",
  name: "Marketing team step-off",
  status: "active" as const,
  startDate: "2026-11-01",
  endDate: "2026-11-08",
  playerCount: 18,
  timeZone: "Europe/London",
  prize: MOCK_PRIZE,
  prizeState: "pending" as const,
};

const MOCK_CARD_READY_TO_HAND_OUT = {
  id: "dev-comp-2",
  name: "Finance vs Sales",
  status: "finished" as const,
  startDate: "2026-10-01",
  endDate: "2026-10-08",
  playerCount: 24,
  timeZone: "Europe/London",
  prize: { ...MOCK_PRIZE, kind: "forfeit" as const, forfeitLoserText: "Buy the team coffee" },
  prizeState: "ready" as const,
};
