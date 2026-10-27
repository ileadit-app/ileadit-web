import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Rich, RichList, RichP } from "@/components/legal/RichText";

export const metadata: Metadata = {
  title: "Terms of Use | ileadit",
  description: "The rules for playing ileadit.",
};

/**
 * The approved Terms of Use (version 1), published word-for-word from
 * docs/ileadit-terms-of-use-APPROVED-20261027.md (Paul, 27 Oct 2026). Same
 * `Rich`/`RichP`/`RichList` rendering as /privacy. Do not reword, shorten or
 * "improve" any sentence without a new approval from Paul. The apps link
 * here (version id "terms-v1"); bump that id when this text changes.
 */
export default function Terms() {
  return (
    <>
      <section className="bg-background pb-4 pt-16 sm:pt-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-primary">Terms of Use</h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            The rules for playing ileadit.
          </p>
        </div>
      </section>

      <section className="bg-background py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-5 sm:px-6">
          <p className="text-sm font-semibold text-muted-foreground">
            <Rich text="**Version 1. Last updated:** 27 October 2026" keyPrefix="last-updated" />
          </p>

          <PolicySection id="the-short-version" title="The short version">
            <RichList
              keyPrefix="the-short-version-0"
              items={[
                "ileadit is a **game**. Your daily steps are how you play. It is not a fitness, health or medical service.",
                "You must be **16 or over** to play.",
                "ileadit is **free to play**. Entering a competition never costs money, and never will.",
                "Play fair. Faking steps, or using more than one account, can get your points removed or your account closed.",
                "Be kind. Your name and photo are seen by other players.",
                "Your privacy is covered by our Privacy Policy (ileadit.co.uk/privacy).",
              ]}
            />
          </PolicySection>

          <PolicySection id="about-these-terms" title="1. About these terms">
            <RichP keyPrefix="about-these-terms-0" text={"These terms are an agreement between you and **Kranthews Ltd**, which runs ileadit. Kranthews Ltd is a company registered in England and Wales (company number **14373131**), registered office **1 Westbrook Avenue, Hampton, England, TW12 2RE**."} />
            <RichP keyPrefix="about-these-terms-1" text={"They cover the ileadit apps and the ileadit website (ileadit.co.uk). By creating an account or playing, you agree to them. If you don't agree, please don't use ileadit."} />
            <RichP keyPrefix="about-these-terms-2" text={"How we use your personal data is explained in our **Privacy Policy** (ileadit.co.uk/privacy). When a competition has a prize, that competition's **prize terms** also apply (section 8)."} />
          </PolicySection>

          <PolicySection id="who-can-play" title="2. Who can play">
            <RichList
              keyPrefix="who-can-play-0"
              items={[
                "You must be **16 or over**. We ask you to confirm this when you sign up. If we learn that someone under 16 has an account, we will close it.",
                "Some prizes are only for people aged 18 or over. The prize terms will say so.",
                "You may have **one account**. It is personal to you: don't share it, sell it or let anyone else play on it.",
                "The information you give us, such as your name, must be true. Your name must be your own.",
              ]}
            />
          </PolicySection>

          <PolicySection id="your-account" title="3. Your account">
            <RichList
              keyPrefix="your-account-0"
              items={[
                "You sign in with Google or with an email address and password. Keep your sign-in details safe. Tell us straight away at hello@ileadit.co.uk if you think someone else has used your account.",
                "You can **delete your account** at any time in the app (**Settings → Delete account**) or by emailing us. What happens to your data is explained in the Privacy Policy.",
              ]}
            />
          </PolicySection>

          <PolicySection id="how-the-game-works" title="4. How the game works">
            <RichList
              keyPrefix="how-the-game-works-0"
              items={[
                "Each day, ileadit compares your steps with **your own** normal daily level. You score points and keep or lose lives based on that. Nobody is compared on raw step counts, and other players never see yours.",
                "Your normal level adjusts as you play, so the game stays fair as your habits change.",
                "**Points** are scored in competitions. **Lives** decide whether you stay in. **Coins** are earned for finishing competitions and spent in the game, for example on challenges.",
                "We keep the game's rules up to date and may adjust them, for example to make scoring fairer or stop cheating. We will explain important changes in the app. We won't change the rules of a competition that is already running in a way that unfairly affects its result, unless we must to fix a fault or stop cheating.",
                "The game engine on our servers decides points, lives, coins and results. If a fault or a late sync makes a result wrong, we may correct it.",
              ]}
            />
          </PolicySection>

          <PolicySection id="look-after-yourself" title="5. Look after yourself">
            <RichList
              keyPrefix="look-after-yourself-0"
              items={[
                "ileadit is a game. It is not medical advice and does not replace advice from a doctor. If you have a health condition, or you're not sure how much activity is right for you, ask a doctor first.",
                "Walk safely. Watch where you're going, keep to safe routes, and never use the app while driving or cycling.",
                "Stop if you feel unwell. No point is worth an injury.",
              ]}
            />
          </PolicySection>

          <PolicySection id="play-fair" title="6. Play fair">
            <RichP keyPrefix="play-fair-0" text={"You must not:"} />
            <RichList
              keyPrefix="play-fair-1"
              items={[
                "fake or inflate your steps, for example by shaking your phone, using a device or app that generates steps, or typing in steps you didn't take;",
                "create or use more than one account, or play on someone else's account;",
                "use bots, scripts, modified apps or any other way to interfere with the game;",
                "deliberately use a fault in the game to gain an advantage (please tell us about it instead);",
                "team up with others to fix the result of a competition or challenge.",
              ]}
            />
            <RichP keyPrefix="play-fair-2" text={"We run automatic checks for step counts that look implausible, and the ileadit team may review them. If we reasonably believe you have broken these rules, we may remove points, coins or results, remove you from a competition or a prize, or suspend or close your account. Where we can, we will tell you why and give you a chance to explain."} />
          </PolicySection>

          <PolicySection id="coins" title="7. Coins">
            <RichList
              keyPrefix="coins-0"
              items={[
                "Coins are game currency. They have **no cash value**, can't be exchanged for money or anything outside the game, and can't be transferred to another player except through the game itself (for example, a challenge).",
                "At present coins can't be bought. If that changes, we will update these terms first, and any purchase will also be covered by the rules of the app store you buy through.",
                "Coins are lost when your account is deleted or closed.",
              ]}
            />
          </PolicySection>

          <PolicySection id="competitions-and-prizes" title="8. Competitions and prizes">
            <RichList
              keyPrefix="competitions-and-prizes-0"
              items={[
                "Competitions are set up by ileadit or by an organiser, such as an employer or a group of friends. The organiser chooses the name, dates and any prize.",
                "**Entry is always free.** No competition or prize will ever require you to pay or buy anything.",
                "When a competition has a prize, it has its own **prize terms**, shown in the app and on ileadit.co.uk. They say who provides the prize, how the winner is chosen, how ties are decided, and how the prize is handed over. If the prize terms and these terms disagree about a prize, the prize terms apply.",
                "Unless the prize terms say otherwise, the prize is provided by the organiser, not by ileadit. ileadit runs the game, decides the result and tells the winner.",
                "Before a prize is released we check the result for 48 hours, to allow late syncs and fair-play checks.",
                "**Apple and Google are not sponsors of, and are not involved in, any ileadit competition or prize.**",
              ]}
            />
          </PolicySection>

          <PolicySection id="your-name-photo-and-other-content" title="9. Your name, photo and other content">
            <RichList
              keyPrefix="your-name-photo-and-other-content-0"
              items={[
                "You keep ownership of anything you add, such as your profile photo. You give us permission to store it and show it to other ileadit players for as long as it's on your account, so the game can work.",
                "Your display name, photo and town must not be offensive, hateful, sexual, misleading or someone else's, and must not include anything you don't have the right to use.",
                "We may remove content that breaks these rules, and replace it with a standard avatar or name.",
              ]}
            />
          </PolicySection>

          <PolicySection id="treat-other-players-well" title="10. Treat other players well">
            <RichP keyPrefix="treat-other-players-well-0" text={"Don't harass, threaten or abuse other players, organisers or the ileadit team, inside or outside the game. If someone is making ileadit unpleasant for you, email hello@ileadit.co.uk."} />
          </PolicySection>

          <PolicySection id="the-app-itself" title="11. The app itself">
            <RichList
              keyPrefix="the-app-itself-0"
              items={[
                "We work hard to keep ileadit running and accurate, but we can't promise it will always be available or free of faults. Sometimes we need to pause it for maintenance or updates.",
                "We may change, add or remove features. If we ever decide to close ileadit, we will give you at least 30 days' notice in the app.",
                "ileadit relies on your phone counting your steps (through Health Connect on Android or Apple Health on iPhone). We can't control how accurate your phone is.",
                "The ileadit name, logo, app, website and game design belong to Kranthews Ltd. You may use the app for your own personal play, but don't copy, sell or reverse-engineer it.",
              ]}
            />
          </PolicySection>

          <PolicySection id="our-responsibility-to-you" title="12. Our responsibility to you">
            <RichList
              keyPrefix="our-responsibility-to-you-0"
              items={[
                "If we fail to meet these terms, we are responsible for loss or damage you suffer that is a foreseeable result of that failure. We are not responsible for loss or damage that isn't foreseeable.",
                "ileadit is free and provided for personal, non-commercial use. We are not responsible for any loss of business, income or opportunity.",
                "Nothing in these terms limits our responsibility for death or personal injury caused by our negligence, for fraud, or for anything else the law doesn't allow us to limit. Your legal rights as a consumer are not affected.",
              ]}
            />
          </PolicySection>

          <PolicySection id="apple-and-google" title="13. Apple and Google">
            <RichList
              keyPrefix="apple-and-google-0"
              items={[
                "You download ileadit through Apple's App Store or Google Play, and their own terms also apply to that download.",
                "This agreement is between you and Kranthews Ltd only, not Apple or Google. Kranthews Ltd, not Apple or Google, is responsible for the app, its content, support and maintenance, and for dealing with any claim about it.",
                "If you downloaded ileadit from Apple's App Store, Apple and its subsidiaries are third-party beneficiaries of these terms and may enforce them against you.",
              ]}
            />
          </PolicySection>

          <PolicySection id="changes-to-these-terms" title="14. Changes to these terms">
            <RichP keyPrefix="changes-to-these-terms-0" text={"We may update these terms, for example when we add features or the law changes. If we make an important change, we will tell you in the app before it takes effect. If you don't agree, you can stop playing and delete your account. The version and date at the top show when these terms last changed."} />
          </PolicySection>

          <PolicySection id="law-and-disputes" title="15. Law and disputes">
            <RichP keyPrefix="law-and-disputes-0" text={"These terms are governed by the law of England and Wales. If you have a dispute with us, the courts of England and Wales can hear it; if you live in Scotland or Northern Ireland, you can also bring proceedings there."} />
            <RichP keyPrefix="law-and-disputes-1" text={"If something goes wrong, please contact us first. We'll try to sort it out quickly."} />
          </PolicySection>

          <PolicySection id="contact-us" title="16. Contact us">
            <RichP keyPrefix="contact-us-0" text={"**Kranthews Ltd**, 1 Westbrook Avenue, Hampton, England, TW12 2RE"} />
            <RichP keyPrefix="contact-us-1" text={"Email: **hello@ileadit.co.uk**"} />
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
