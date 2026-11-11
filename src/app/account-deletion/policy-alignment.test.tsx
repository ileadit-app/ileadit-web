import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import AccountDeletion from "./page";
import Privacy from "../privacy/page";

/**
 * WEB-DELETION-PAGE-ALIGN-1. Drift guard between `/privacy` section 7
 * ("Deleting your account") and `/account-deletion`. Google Play checks the
 * deletion URL, so the two pages must say the same thing about what is
 * deleted and what is kept.
 *
 * Approach: render both real pages (no copy duplicated into a shared list).
 *  1. Every "what we keep" bullet in policy section 7 is found by its bold lead
 *     label, read live from the policy, so a NEW policy bullet fails this test
 *     until the deletion page gets it too.
 *  2. The policy's "we delete ..." sentence is prose, so each deleted item is a
 *     key phrase in DELETED_ITEMS. The test first proves every phrase is in the
 *     policy's section 7 (so the table cannot drift from the policy), then that
 *     the deletion page's own "What gets deleted" list says it too.
 */

vi.mock("@/context/AuthContext", () => ({
  useUser: () => ({ status: "signed-out", user: null }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/** [what the policy sentence says, what the deletion page's bullet must say] */
const DELETED_ITEMS: Array<[string, RegExp]> = [
  ["profile", /your profile/i],
  ["photo", /profile photo/i],
  ["private details", /first name and surname/i],
  ["step and points history", /daily step and points history/i],
  ["coins", /your coins and points/i],
  ["notifications", /your notifications/i],
  ["device tokens", /registered devices/i],
  ["block list", /your block list/i],
  ["prize claim record", /your prize claim record/i],
  ["terms and policy versions you accepted", /which terms and policy versions you accepted/i],
  ["your sign-in account", /your ileadit sign-in/i],
  ["remove you from your competitions", /your place in your competitions/i],
  ["challenge", /any challenge you're part of/i],
];

function policySection7(): HTMLElement {
  const { container } = render(<Privacy />);
  const section = container.querySelector<HTMLElement>("#deleting-your-account");
  if (!section) throw new Error("privacy page has no #deleting-your-account section");
  return section;
}

function normalise(text: string | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("/account-deletion matches /privacy section 7", () => {
  it("every item in the policy's 'we delete' sentence is in the policy AND on the deletion page", () => {
    const policyText = normalise(policySection7().textContent);
    document.body.innerHTML = "";
    render(<AccountDeletion />);
    const deleteList = Array.from(document.querySelectorAll("section, div"))
      .find((el) => el.querySelector(":scope > h2")?.textContent === "What gets deleted")
      ?.querySelector("ul");
    expect(deleteList, "deletion page has a 'What gets deleted' list").toBeTruthy();
    const deleteText = normalise(deleteList!.textContent);

    for (const [policyPhrase, pagePattern] of DELETED_ITEMS) {
      expect(policyText, `policy section 7 should mention "${policyPhrase}"`).toContain(policyPhrase);
      expect(deleteText, `deletion page is missing "${policyPhrase}"`).toMatch(pagePattern);
    }
  });

  it("every 'what we keep' bullet in the policy appears on the deletion page, matched by its bold label", () => {
    const keepItems = Array.from(
      policySection7().querySelectorAll("li"),
    ).map((li) => normalise(li.textContent));
    // Guard the guard: policy section 7 has 5 keep bullets today.
    expect(keepItems.length).toBeGreaterThanOrEqual(5);
    const labels = keepItems.map((t) => t.split(":")[0]);

    document.body.innerHTML = "";
    render(<AccountDeletion />);
    const pageItems = Array.from(document.querySelectorAll("li")).map((li) => normalise(li.textContent));

    for (const label of labels) {
      expect(
        pageItems.some((t) => t.startsWith(`${label}:`)),
        `deletion page is missing the kept item "${label}"`,
      ).toBe(true);
    }
  });

  it("the kept-item bullets say the same thing, apart from the 'section 6' cross-reference", () => {
    const strip = (t: string) => t.replace(/\s*\((reports are deleted after 12 months|section 6)\)/g, "");
    const policyKeep = Array.from(policySection7().querySelectorAll("li")).map((li) =>
      strip(normalise(li.textContent)),
    );
    document.body.innerHTML = "";
    render(<AccountDeletion />);
    const pageKeep = Array.from(document.querySelectorAll("li")).map((li) => strip(normalise(li.textContent)));

    for (const item of policyKeep) {
      expect(pageKeep, `deletion page wording differs from policy for: ${item.slice(0, 40)}...`).toContain(item);
    }
  });

  it("states the backups rule from section 7 (up to 30 days, nothing else)", () => {
    render(<AccountDeletion />);
    expect(document.body).toHaveTextContent(
      /backups of our database age out on their own\. anything you delete can remain in a backup for up to 30 days, and is not used for anything else/i,
    );
  });

  it("covers every sign-in method the apps offer: email, Google and Apple", () => {
    render(<AccountDeletion />);
    expect(document.body).toHaveTextContent(/email and password, google or apple/i);
  });

  it("still says how to delete: Settings → Delete account in the app, and the email route without the app", () => {
    render(<AccountDeletion />);
    expect(document.body).toHaveTextContent(/settings → delete account/i);
    expect(document.body).toHaveTextContent(/hello@ileadit\.co\.uk.*within one month/i);
  });
});
