import {
  LegalPlaceholderBanner,
  LegalSection,
} from "@/components/legal/LegalPagePlaceholder";

/**
 * Page SKELETON, not terms of service — see LegalPagePlaceholder.tsx for
 * why every paragraph here is a marked placeholder rather than drafted
 * legal text. The "must cover" lists are drawn from RULES.md (game
 * mechanics, coin economy, corporate wellness tiers, anti-cheat) and
 * CLAUDE.md's pricing table — they're the real, useful part of this page.
 */
export default function Terms() {
  return (
    <>
      <section className="bg-background pb-4 pt-16 sm:pt-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-primary">
            Terms of Service
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            The rules for using ileadit, as a player and — where it applies
            — as a company running a private competition.
          </p>
        </div>
      </section>

      <LegalPlaceholderBanner pageName="terms of service" />

      <section className="bg-background py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-5 sm:px-6">
          <LegalSection
            heading="1. Acceptance and eligibility"
            mustCover={[
              "Minimum age to create an account",
              "That using the app requires accepting both these terms and the privacy policy",
              "Account requirements (one account per person, accurate information)",
            ]}
            placeholder="Placeholder — eligibility and acceptance terms."
          />

          <LegalSection
            heading="2. What ileadit is (and isn't)"
            mustCover={[
              "ileadit is a game that uses walking as an input mechanic — it is explicitly not a medical device, fitness plan, or health advice service (RULES.md \u00a71: \"a game that requires movement, NOT a fitness app\")",
              "A health/medical disclaimer: users should consult a doctor before starting new physical activity, and the game's points/lives system is not a fitness recommendation",
            ]}
            placeholder="Placeholder — product description and health disclaimer. This section needs real legal input, not marketing language, because it's the liability boundary."
          />

          <LegalSection
            heading="3. The points, lives, and average system"
            mustCover={[
              "Plain description that scoring is based on a personal, self-adjusting rolling average, not absolute step counts, and that this can change over time as the player's activity changes (RULES.md \u00a72.4)",
              "That losing all lives in a competition means elimination from that competition, and what that does and doesn't affect (e.g. other competitions, account status)",
            ]}
            placeholder="Placeholder — plain-English restatement of the scoring mechanic for terms-of-service purposes (not a gameplay explainer — that lives on the marketing pages)."
          />

          <LegalSection
            heading="4. Coins and in-app purchases"
            mustCover={[
              "That coins can be earned through gameplay or purchased with real money (RULES.md \u00a72.3)",
              "Refund policy for coin purchases, and whether coins expire or can be transferred",
              "That challenge/tool costs are spent regardless of outcome, with the one stated exception (RULES.md \u00a73.1: a challenge that could not be judged at all is voided and refunded) — this needs to be stated accurately since it's a real money-adjacent mechanic",
            ]}
            placeholder="Placeholder — coin purchase, refund, and expiry terms. Needs sign-off given this covers real payments."
          />

          <LegalSection
            heading="5. Competitions, prizes, and sponsors"
            mustCover={[
              "Rules for joining, being eliminated from, and completing a competition",
              "How prizes (sponsor-provided, for public competitions) are fulfilled, and any eligibility restrictions",
              "That private/corporate competitions are invite-only and not discoverable publicly (RULES.md \u00a74.2)",
            ]}
            placeholder="Placeholder — competition participation and prize terms."
          />

          <LegalSection
            heading="6. Corporate wellness plans and billing"
            mustCover={[
              "Plan tiers, participant limits, and billing cadence (per-competition or subscription, matching whatever pricing model actually ships)",
              "What happens on downgrade/cancellation to active competitions and invited employees",
              "That Stripe handles payment processing and its terms apply to the transaction alongside these",
            ]}
            placeholder="Placeholder — B2B billing terms. Must be reconciled with whatever pricing page copy actually ships, since the two need to match exactly."
          />

          <LegalSection
            heading="7. Fair play and anti-cheat"
            mustCover={[
              "That step manipulation, automated tools, or falsified data are prohibited",
              "What ileadit may do about it: warning, exclusion from a competition, prize forfeiture, or account suspension (RULES.md \u00a76.3, marked TBD there — needs a firm decision before this ships)",
              "An appeals process for anti-cheat decisions (also open in RULES.md \u00a713)",
            ]}
            placeholder="Placeholder — anti-cheat enforcement and appeals terms. Two of the underlying policy decisions are still marked open questions in the product's own rules document and must be resolved before this section is drafted for real."
          />

          <LegalSection
            heading="8. Acceptable use"
            mustCover={[
              "Prohibited conduct: harassment of other players, impersonation, abuse of the challenge/tool system",
              "Consequences for violations up to and including account termination",
            ]}
            placeholder="Placeholder — acceptable use and enforcement."
          />

          <LegalSection
            heading="9. Intellectual property"
            mustCover={[
              "Ownership of the ileadit name, brand, and app content",
              "Licence granted to the user to use the app; restrictions on reverse engineering, scraping leaderboard data, etc.",
            ]}
            placeholder="Placeholder — IP ownership and licence terms."
          />

          <LegalSection
            heading="10. Limitation of liability and termination"
            mustCover={[
              "Standard limitation of liability language, scoped appropriately for a consumer game vs a B2B contract",
              "Grounds and process for ileadit terminating an account, and for a user closing their own account (link to /account-deletion)",
            ]}
            placeholder="Placeholder — liability limitation and termination terms."
          />

          <LegalSection
            heading="11. Governing law and changes to these terms"
            mustCover={[
              "Governing law and jurisdiction",
              "How and when updated terms take effect, and how continued use constitutes acceptance",
            ]}
            placeholder="Placeholder — governing law and change-notification terms."
          />

          <LegalSection
            heading="12. Contact us"
            mustCover={[
              "A real contact email or address for questions about these terms",
            ]}
            placeholder="Placeholder — contact details."
          />
        </div>
      </section>
    </>
  );
}
