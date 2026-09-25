import {
  LegalPlaceholderBanner,
  LegalSection,
} from "@/components/legal/LegalPagePlaceholder";

/**
 * This is a page SKELETON, not a privacy policy. No paragraph on this page
 * is real legal copy — see LegalPagePlaceholder.tsx for why, and the
 * placeholder banner rendered below for the same message on the page
 * itself. The "must cover" lists under each heading are the actually
 * useful output of this ticket: a real checklist of what ileadit's privacy
 * policy needs to address, derived from RULES.md (section 7, "Privacy
 * Principles") and CLAUDE.md's Privacy Rules, given the app reads Health
 * Connect step data and the business has a B2B corporate-wellness side
 * where an employer must never see an individual's steps.
 */
export default function Privacy() {
  return (
    <>
      <section className="bg-background pb-4 pt-16 sm:pt-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-primary">
            Privacy Policy
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            How ileadit collects, uses, and protects your data.
          </p>
        </div>
      </section>

      <LegalPlaceholderBanner pageName="privacy policy" />

      <section className="bg-background py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-5 sm:px-6">
          <LegalSection
            heading="1. Who we are and what this policy covers"
            mustCover={[
              "Data controller identity and contact details (the legal entity operating ileadit)",
              "Which products this policy covers: the mobile app (Android, and iOS once it exists) and this website, including the corporate wellness portal",
              "That this policy applies to individual players and to employees invited into a company's private competition",
            ]}
            placeholder="Placeholder — company name, registered address, and contact details go here, along with a plain-English summary of what the policy covers."
          />

          <LegalSection
            heading="2. Account and profile data we collect"
            mustCover={[
              "Display name, avatar, profile photo, and city (shown to other players)",
              "First name, surname, email address, and country (kept private, not shown to other players)",
              "That email is used for account identification and essential service communication only",
            ]}
            placeholder="Placeholder — description of account/profile fields collected at signup and during use of the app."
          />

          <LegalSection
            heading="3. Step and activity data (Health Connect)"
            mustCover={[
              "That step data is read from Android Health Connect (and HealthKit once an iOS app exists), and exactly which permission scope is requested",
              "That raw step counts are converted into a private points score against the player's own rolling average, and the underlying step count is never shown to other players, competition admins, or ileadit staff on any dashboard",
              "How long raw daily step records are retained, and whether/when they are deleted or aggregated after a competition ends",
              "That step data is never sold, and is never shared with sponsors or employers in raw or per-user form — only aggregated, anonymized competition-level statistics may be shared, and only with consent (RULES.md \u00a77.1\u20137.2)",
              "Whether step data is processed on-device, in Firestore, or both, and what security controls apply to it in transit and at rest",
            ]}
            placeholder="Placeholder — the Health Connect data section. This is the most sensitive category of data ileadit handles and needs its own clearly-flagged subsection, not a buried bullet point."
          />

          <LegalSection
            heading="4. Corporate wellness competitions"
            mustCover={[
              "That an employer/company admin who creates a private competition can see only aggregate participation, points, and leaderboard position — never an individual's step count (RULES.md \u00a77.1: \"HR sees points and leaderboard position only\u2014NEVER step counts\")",
              "What data, if any, is visible to the company admin about who has and hasn't joined",
              "Data retention after an employee leaves the company or the competition ends",
              "Whether competition invites are sent via email, and what happens to that email address once the invite is accepted or expires (CLAUDE.md: invite emails must never be stored after sending)",
            ]}
            placeholder="Placeholder — corporate/B2B-specific privacy terms, written for an audience of both individual employees and the company that invited them."
          />

          <LegalSection
            heading="5. Payments"
            mustCover={[
              "That payment card details are handled entirely by Stripe and never touch ileadit's own servers",
              "What billing data is shared with Stripe versus retained by ileadit (name, email, invoice history)",
            ]}
            placeholder="Placeholder — Stripe as payment processor, what's shared, and a link to Stripe's own privacy policy."
          />

          <LegalSection
            heading="6. Who we share data with"
            mustCover={[
              "Sub-processors: Firebase/Google Cloud (hosting, authentication, database), Stripe (payments), and any analytics or crash-reporting tool actually in use",
              "That individual step counts and PII are never sold or shared for marketing purposes (RULES.md \u00a77.2)",
              "Conditions under which data might be disclosed (legal requirement, safety)",
            ]}
            placeholder="Placeholder — sub-processor list and third-party sharing terms."
          />

          <LegalSection
            heading="7. Cookies and analytics"
            mustCover={[
              "That no analytics or tracking runs before consent is given, per the site's cookie banner",
              "Categories of cookies used (essential/session vs optional analytics) and how to withdraw consent later",
            ]}
            placeholder="Placeholder — cookie categories and consent mechanism, matching whatever the site's actual cookie banner implementation ends up being."
          />

          <LegalSection
            heading="8. International data transfers"
            mustCover={[
              "Where Firebase/Google Cloud data is physically stored and processed",
              "Transfer safeguards if data leaves the UK/EEA (e.g. Standard Contractual Clauses)",
            ]}
            placeholder="Placeholder — data residency and international transfer safeguards, once the actual Firebase region configuration is confirmed."
          />

          <LegalSection
            heading="9. Your rights"
            mustCover={[
              "Right to access, correct, export, and delete your data",
              "A direct link to the account deletion flow (see /account-deletion)",
              "Right to object to or restrict certain processing, and how to withdraw consent for optional data (country)",
              "Right to complain to a supervisory authority (e.g. the ICO in the UK) if unsatisfied with the response",
            ]}
            placeholder="Placeholder — GDPR/UK GDPR rights section with the actual process and response time commitments for each right."
          />

          <LegalSection
            heading="10. Children"
            mustCover={[
              "Minimum age to use ileadit, and what happens if an under-age account is discovered",
            ]}
            placeholder="Placeholder — minimum age policy."
          />

          <LegalSection
            heading="11. Changes to this policy"
            mustCover={[
              "How and where policy changes are announced, and whether material changes require re-consent",
            ]}
            placeholder="Placeholder — change notification process."
          />

          <LegalSection
            heading="12. Contact us"
            mustCover={[
              "A real contact email or address for privacy/data protection queries",
            ]}
            placeholder="Placeholder — contact details for privacy questions and data subject requests."
          />
        </div>
      </section>
    </>
  );
}
