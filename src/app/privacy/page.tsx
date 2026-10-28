import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Rich, RichList, RichP } from "@/components/legal/RichText";

export const metadata: Metadata = {
  title: "Privacy Policy | ileadit",
  description: "How ileadit collects, uses, and protects your data.",
};

/**
 * WEB-LEGAL-1. The approved privacy policy, published word-for-word from
 * `.ticket-refs/privacy-policy-APPROVED-20261026.md` (Paul, 26 Oct 2026).
 * Every paragraph/bullet/table cell below is copied verbatim (via the
 * `Rich`/`RichP`/`RichList` helpers in `RichText.tsx`, which turn the
 * approved markdown-ish source strings into real `<strong>`/`<a>`/`<Link>`
 * elements without the wording being retyped by hand) — do not reword,
 * shorten, or "improve" any sentence here without going back to Paul for a
 * new approval, per this ticket's instructions.
 *
 * Replaces the placeholder skeleton (LegalPagePlaceholder-based) that
 * previously lived at this route. `/terms` now has the approved Terms of Use.
 */
export default function Privacy() {
  return (
    <>
      <section className="bg-background pb-4 pt-16 sm:pt-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-primary">Privacy Policy</h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            How ileadit collects, uses, and protects your data.
          </p>
        </div>
      </section>

      <section className="bg-background py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-5 sm:px-6">
          <p className="text-sm font-semibold text-muted-foreground">
            <Rich text="**Last updated:** 28 October 2026" keyPrefix="last-updated" />
          </p>

          <PolicySection id="short-version" title="The short version">
            <RichList
              keyPrefix="short-version"
              items={[
                "ileadit is a **game**. Your daily steps are how you play. It is not a fitness tracker.",
                "We read **only your daily step count** from Health Connect, and only with your permission.",
                "**Nobody else ever sees your step count**: not other players and not competition organisers. They see your **points**, **lives** and **leaderboard position**.",
                "We don't sell your data, we don't show ads, and we don't use your data for advertising.",
                "You must be **16 or over** to play.",
                "You can delete your account at any time, in the app or by email.",
              ]}
            />
          </PolicySection>

          <PolicySection id="who-we-are" title="1. Who we are">
            <RichP
              keyPrefix="s1-p1"
              text={`ileadit is run by **Kranthews Ltd**, a company registered in England and Wales (company number **14373131**), registered office **1 Westbrook Avenue, Hampton, England, TW12 2RE**. We decide how your personal data is used, which makes us the "controller" under UK data protection law. We are registered with the Information Commissioner's Office (registration **ZB616290**).`}
            />
            <RichP
              keyPrefix="s1-p2"
              text="This policy covers the ileadit Android app and the ileadit website (ileadit.co.uk). When the iPhone app is released we will update this policy to cover it."
            />
            <RichP keyPrefix="s1-p3" text="**Contact us about anything in this policy:** hello@ileadit.co.uk" />
          </PolicySection>

          <PolicySection id="what-we-collect" title="2. What we collect, and why">
            <SubHeading>Your account</SubHeading>
            <RichList
              keyPrefix="s2-account"
              items={[
                "**Email address.** If you sign in with Google, Google gives us the email address and name on your Google account. We use your email address to sign you in and keep your account secure. It is never shown to other players.",
                "**Password**, if you sign up with email. We never see it: our sign-in provider (Google Firebase) stores only a scrambled version.",
                "**Confirmation that you are 16 or over.** We ask you to confirm this when you sign up. We don't ask for your date of birth.",
                `**Your time zone**, taken from your phone, so that "today" in the game matches your own day.`,
              ]}
            />

            <SubHeading>Your player profile</SubHeading>
            <RichList
              keyPrefix="s2-profile"
              items={[
                "**Your first name and surname.** These stay private to you.",
                `**Display name.** This is how other players see you. We show your first name and the first letter of your surname, for example "Sam T".`,
                "**Avatar or profile photo.** You choose one of our avatars or upload a photo. Before a photo is uploaded, the app removes hidden information such as where and when it was taken and the camera used. When you replace your photo, the old one is deleted.",
                "**Your town or city.** You choose it from our own list of real places. What you type in the search box goes only to our servers, to find matching places.",
              ]}
            />
            <RichP
              keyPrefix="s2-profile-who"
              text="**Who can see your profile:** your display name, avatar or photo, and town or city can be seen by **other signed-in ileadit players**. Anyone who has the web link to your profile photo can also open that photo. Your email address and full name are never shown to other players."
            />
            <RichP keyPrefix="s2-profile-no" text="We do not collect your date of birth, gender or country." />

            <SubHeading>Your steps (health data)</SubHeading>
            <RichP
              keyPrefix="s2-steps-p1"
              text="Your daily step count is **health data**, which the law treats as especially sensitive, so we only use it with your explicit permission."
            />
            <RichP
              keyPrefix="s2-steps-p2"
              text="**What we read.** With your permission, the app reads from **Health Connect** on your phone:"
            />
            <RichList
              keyPrefix="s2-steps-read"
              items={[
                "your **total steps for each day**; and",
                "whether any steps were **typed in by hand** rather than counted by a device. We use this only to keep the game fair.",
              ]}
            />
            <RichP
              keyPrefix="s2-steps-p3"
              text="We do **not** read distance, calories, heart rate, sleep, location or any other health information."
            />
            <RichP
              keyPrefix="s2-steps-p4"
              text={`**When we read it.** When you first set up, the app reads up to 30 days of your past daily step totals once, to work out your normal daily level. We keep only that single "normal" figure, not the individual days. After that, the app sends us your step total for today regularly through the day, **including when the app is closed**. That is why we ask for Health Connect's background permission: without it, a quiet day with the app shut would unfairly cost you points or a life.`}
            />
            <RichP
              keyPrefix="s2-steps-p5"
              text="**What we do with it.** Your steps are compared with **your own** normal level to work out your **points** and whether you **lose a life**. Your normal level adjusts as you play. We also run automatic checks for step counts that look implausible, such as sudden huge jumps or lots of hand-entered steps. Only the ileadit team can see those checks, and they don't change your score or your account on their own."
            />
            <RichP
              keyPrefix="s2-steps-p6"
              text={`**What we store.** For each day: your step total, the points you scored, and when your phone last sent an update. We also store your "normal" level and, for your last 10 competitions, your average daily steps during each one, which we use to set a fair target in your next competition.`}
            />
            <RichP
              keyPrefix="s2-steps-p7"
              text="**Our legal basis.** We use your step data because it is needed to run the game you signed up for (UK GDPR Article 6(1)(b)), and because you give us your **explicit consent** when you allow ileadit to read your steps in Health Connect (Article 9(2)(a))."
            />
            <RichP
              keyPrefix="s2-steps-p8"
              text={`**Changing your mind.** You can withdraw consent at any time: open **Health Connect → App permissions → ileadit** and turn off step access, or uninstall the app. We stop reading your steps straight away. Without new steps you can't score points, and you will lose lives in any competition you're in. The daily step records we already hold are deleted automatically on the normal schedule (section 6). Your "normal" level and competition averages stay until you delete your account, which you can do at any time (section 7).`}
            />

            <SubHeading>Playing the game</SubHeading>
            <RichList
              keyPrefix="s2-playing"
              items={[
                "**Competitions you join.** Other players in the competition, and its organiser, can see your display name, avatar or photo, your points (including today's points so far), how many lives you have left, whether you are out, and your final position.",
                "**Challenges.** The players involved in a challenge can see who challenged whom, the target that was set and the result.",
                "**Coins.** We keep a record of the game coins you earn and spend. Coins are game currency only: they can't be bought and have no cash value.",
                `**Notifications.** We keep the messages we send you, such as "You've been challenged!", in your in-app inbox, and a **device token** so we can send notifications to your phone. Notification text can appear on your lock screen. You can turn notifications off in the app's settings or in your phone's settings.`,
              ]}
            />

            <SubHeading>Keeping the app working and secure</SubHeading>
            <RichList
              keyPrefix="s2-security"
              items={[
                "**Crash reports** (Firebase Crashlytics): what went wrong, your phone model and Android version, and an ID for your installation of the app. We use these only to fix faults.",
                "**App integrity checks** (Firebase App Check), which confirm that requests come from the genuine ileadit app or website. On Android this uses Google Play Integrity, and on iPhone it uses Apple App Attest. On our website it uses Google reCAPTCHA v3, which looks at technical signals from your browser, such as your IP address and how the page is used, to tell people apart from automated bots. Google's privacy policy applies to reCAPTCHA, and it may set cookies in your browser for this purpose.",
                "**Signing in on our website.** When you sign in on ileadit.co.uk, your browser stores a sign-in token so you stay signed in. We don't use advertising or analytics cookies on the website.",
                `**Server logs.** Our servers record technical events, such as "player X's day was closed on date Y", so we can find and fix faults. These contain your account ID, never your step count.`,
              ]}
            />
            <RichP
              keyPrefix="s2-no-analytics"
              text="We don't use analytics or advertising tools, and there is no advertising ID in the app."
            />
          </PolicySection>

          <PolicySection
            id="what-others-can-see"
            title="3. What other players and organisers can and can't see"
          >
            <RichP keyPrefix="s3-can-p" text="**Other players in your competition, and its organiser, CAN see:**" />
            <RichList
              keyPrefix="s3-can"
              items={[
                "your display name, avatar or photo, and town or city;",
                "your points, and today's points so far;",
                "how many lives you have left, and whether you are out;",
                "your position on the leaderboard and your final ranking.",
              ]}
            />
            <RichP keyPrefix="s3-cannot-p" text="**They can NEVER see:**" />
            <RichList
              keyPrefix="s3-cannot"
              items={[
                "your step count, for any day;",
                `your "normal" level or your targets;`,
                "your email address, full name or other private details;",
                "our anti-cheat checks.",
              ]}
            />
            <RichP
              keyPrefix="s3-aware"
              text="**Please be aware:** points and lives are worked out from your steps compared with **your own** usual level, so someone looking at a leaderboard can tell roughly whether you had a good day or a quiet one. They can't tell how many steps that was."
            />
            <RichP
              keyPrefix="s3-else"
              text="We don't give organisers anything else: there are no reports about individual players."
            />
          </PolicySection>

          <PolicySection id="who-we-share-data-with" title="4. Who we share data with">
            <RichP
              keyPrefix="s4-p1"
              text="We don't sell your personal data, and we don't share it with advertisers or data brokers. Your step data is used only to run the game."
            />
            <RichP
              keyPrefix="s4-p2"
              text="We use Google as our service provider. Google handles data only on our instructions, under its data processing terms:"
            />
            <ScrollTable
              caption="Google services ileadit uses, and what each is for"
              head={["Google service", "What we use it for"]}
              rows={[
                ["Firebase Authentication", "Signing you in (Google or email)"],
                ["Cloud Firestore", "Storing your profile, game and step data"],
                ["Cloud Storage for Firebase", "Profile photos"],
                ["Cloud Functions for Firebase", "Running the game engine"],
                ["Firebase Cloud Messaging", "Sending notifications to your phone"],
                ["Firebase App Check (Play Integrity, App Attest, reCAPTCHA)", "Blocking fake apps and bots"],
                ["Firebase Crashlytics", "Crash reports"],
                ["Firebase Hosting", "The ileadit website"],
                ["Cloud Logging", "Server logs"],
              ]}
            />
            <RichP
              keyPrefix="s4-p3"
              text="**Health Connect** is part of Android on your phone. It is where your steps come from, and its own privacy terms apply to the data it holds."
            />
            <RichP
              keyPrefix="s4-p4"
              text="**Legal reasons:** we may share information if the law requires it, or to protect the safety of our players or the service."
            />
          </PolicySection>

          <PolicySection id="where-your-data-is-stored" title="5. Where your data is stored">
            <RichP
              keyPrefix="s5-p1"
              text="Your account, profile and game data is stored by Google Cloud in the **United States**, and our game engine runs in **London**. Some Google services, such as sign-in, notifications and crash reporting, may also process data in other countries. Where data leaves the UK, Google's data processing terms include the legal safeguards UK law requires for international transfers (standard contractual clauses with the UK addendum)."
            />
          </PolicySection>

          <PolicySection id="how-long-we-keep-your-data" title="6. How long we keep your data">
            <ScrollTable
              caption="How long ileadit keeps each kind of data"
              head={["Data", "How long"]}
              rows={[
                ["Account, profile, coins and game history", "Until you delete your account"],
                [
                  "Daily step totals and daily points",
                  "Deleted automatically 30 days after the day, or 30 days after the end of a competition that day counted towards, whichever is later",
                ],
                [
                  "Your starting 30 days of steps",
                  `Not stored: we keep only the single "normal" figure worked out from it`,
                ],
                ["Your average steps per competition", "Your last 10 competitions only"],
                ["Anti-cheat checks", "A rolling 30 days"],
                ["Notification inbox", "Until you delete a message or your account"],
                ["Device tokens for notifications", "Until they stop working or you delete your account"],
                ["Server logs", "30 days"],
                ["Crash reports", "90 days"],
              ]}
            />
          </PolicySection>

          <PolicySection id="deleting-your-account" title="7. Deleting your account">
            <RichP
              keyPrefix="s7-p1"
              text="**In the app:** go to **Settings → Delete account**. Deletion happens straight away and can't be undone."
            />
            <RichP
              keyPrefix="s7-p2"
              text="**Without the app:** email **hello@ileadit.co.uk** from the address on your account and ask us to delete it. We will do it within one month. See also ileadit.co.uk/account-deletion."
            />
            <RichP
              keyPrefix="s7-p3"
              text="When your account is deleted, we delete your profile, photo, private details, step and points history, coins, notifications, device tokens and sign-in account, and we remove you from your competitions. Any challenge you were part of is cancelled, and coins held for it are returned to the other player."
            />
            <RichP keyPrefix="s7-p4" text="**What we keep, and why:**" />
            <RichList
              keyPrefix="s7-keep"
              items={[
                `**Finished competitions:** your place in the final results stays, so other players' rankings don't change, but your name and picture are removed and you appear as "A former player". Our internal record of each competition's final scores keeps your old account ID, with no name, email or steps.`,
                `**Challenge records:** your account ID is replaced with "deleted-user".`,
                `**Other players' messages:** notifications other players already received, such as "Sam T challenged you", keep your display name until they delete them.`,
                "**Welcome bonus record:** a scrambled, one-way version of your email address, the date and your old account ID, so the same email can't claim the welcome coins twice. It can't be turned back into your email address.",
              ]}
            />
          </PolicySection>

          <PolicySection id="your-rights" title="8. Your rights">
            <RichP keyPrefix="s8-p1" text="Under UK data protection law you have the right to:" />
            <RichList
              keyPrefix="s8-rights"
              items={[
                "**Access:** get a copy of the personal data we hold about you.",
                "**Correct:** have wrong data corrected. You can edit your name, photo and town in the app.",
                "**Delete:** have your data deleted (section 7).",
                "**Restrict:** ask us to limit how we use your data.",
                "**Portability:** receive the data you gave us, including your step history, in a common machine-readable format.",
                "**Object:** object to anything we do on the basis of our legitimate interests, such as crash reports or security logs.",
                "**Withdraw consent** at any time, including for step data (section 2). This doesn't affect anything we did before you withdrew.",
              ]}
            />
            <RichP
              keyPrefix="s8-automated"
              text="ileadit doesn't make decisions about you that have legal or similarly significant effects based only on automated processing. Points, lives and rankings are simply the rules of the game."
            />
            <RichP
              keyPrefix="s8-use-rights"
              text="To use any of these rights, email **hello@ileadit.co.uk**. It's free, and we will reply within one month."
            />
            <RichP
              keyPrefix="s8-complaints"
              text="**Complaints:** if you're unhappy with how we've handled your data, please tell us first. You can also complain to the **Information Commissioner's Office (ICO)** at ico.org.uk/make-a-complaint or on 0303 123 1113."
            />
          </PolicySection>

          <PolicySection id="age-limit" title="9. Age limit">
            <RichP
              keyPrefix="s9-p1"
              text="ileadit is for people aged **16 and over**, and you must confirm that you are 16 or older when you sign up. If we learn that someone under 16 has an account, we will delete it. If you think a child is using ileadit, please contact us."
            />
          </PolicySection>

          <PolicySection id="keeping-your-data-secure" title="10. Keeping your data secure">
            <RichList
              keyPrefix="s10-list"
              items={[
                "Your data is encrypted when it travels over the internet and when Google stores it.",
                "Security rules control who can read what. For example, only you can read your step records, and only our game engine can change scores, lives and coins.",
                "Only a small number of ileadit staff can see anti-cheat information.",
                "If a data breach is likely to put you at risk, we will tell you and the ICO as the law requires.",
              ]}
            />
            <RichP
              keyPrefix="s10-p2"
              text="No system is perfectly secure, but we work to protect your information and review our safeguards regularly."
            />
          </PolicySection>

          <PolicySection id="changes-to-this-policy" title="11. Changes to this policy">
            <RichP
              keyPrefix="s11-p1"
              text="If we make important changes, such as collecting new kinds of data or using it in new ways, we will tell you in the app before they take effect, and ask for your consent again where the law requires it. The date at the top shows when this policy last changed."
            />
          </PolicySection>

          <PolicySection id="contact-us" title="12. Contact us">
            <RichP keyPrefix="s12-p1" text="**Kranthews Ltd**, 1 Westbrook Avenue, Hampton, England, TW12 2RE" />
            <RichP keyPrefix="s12-p2" text="Email: **hello@ileadit.co.uk**" />
          </PolicySection>
        </div>
      </section>
    </>
  );
}

function PolicySection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border py-10 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-extrabold tracking-tight text-foreground">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="pt-2 text-base font-bold text-foreground">{children}</h3>;
}

function ScrollTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border bg-card">
            {head.map((label) => (
              <th key={label} scope="col" className="px-4 py-2.5 font-bold text-foreground">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row[0]} className="border-b border-border last:border-b-0">
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-2.5 align-top text-muted-foreground">
                  <Rich text={cell} keyPrefix={`${caption}-${ri}-${ci}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
