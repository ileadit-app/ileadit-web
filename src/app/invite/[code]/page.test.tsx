import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import InvitePage from "./page";
import { SHOP_LINKS } from "@/lib/shopLinks";

/**
 * Pins WEB-INV-1's routing split: an 8-character code (any separators/case)
 * renders the NEW `InviteCodeLanding`, while everything else — in practice,
 * always a 20-character Firestore competition-ID legacy link — renders the
 * existing `InviteLanding` unchanged, receiving the raw `code` value as
 * `competitionId`. Both real components are stubbed here; this file only
 * proves the routing decision, not either component's own rendering (that's
 * `InviteCodeLanding.test.tsx` / `InviteLanding.test.tsx`'s job).
 *
 * `params` is a `Promise`, read via React's `use()` inside the real page
 * component — that suspends on first render even for an already-resolved
 * promise. The render itself (not just the assertion) must happen inside an
 * `await act(async () => { ... })` for the resolution to actually flush in
 * this jsdom harness — `findBy*`'s own internal polling was NOT sufficient
 * (confirmed by a throwaway repro before writing this file: `render()`
 * outside `act`, followed by `await screen.findByTestId(...)`, left the
 * Suspense fallback on screen indefinitely). Reuse this `act`-wrapped-render
 * shape for any future test of a page using `use(params)` directly.
 */

vi.mock("@/components/invite/InviteLanding", () => ({
  InviteLanding: ({ competitionId }: { competitionId: string }) => (
    <div data-testid="legacy-landing">{competitionId}</div>
  ),
}));

vi.mock("@/components/invite/InviteCodeLanding", () => ({
  InviteCodeLanding: ({ code }: { code: string }) => <div data-testid="code-landing">{code}</div>,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/** Fixture shop (the real SHOP_LINKS is empty). One long-running round so the
 * test does not depend on today's date; date logic lives in shopLinks.test.ts. */
const FIXTURE_SHOP = {
  code: "BEAN26",
  shopName: "Bean There",
  timeZone: "Europe/London" as const,
  rounds: [{ startDate: "2020-01-06", endDate: "2099-12-31", inviteCode: "AAAA2222" }],
};

async function renderPage(code: string) {
  await act(async () => {
    render(
      <Suspense fallback={<div data-testid="route-suspense-fallback" />}>
        <InvitePage params={Promise.resolve({ code })} />
      </Suspense>,
    );
  });
}

describe("/invite/[code] — routing split", () => {
  it("MUT-ROUTE-1: an 8-character code renders InviteCodeLanding", async () => {
    await renderPage("K7M4-PQX2");
    expect(screen.getByTestId("code-landing")).toHaveTextContent("K7M4-PQX2");
    expect(screen.queryByTestId("legacy-landing")).not.toBeInTheDocument();
  });

  it("MUT-ROUTE-2: a 20-character Firestore competition ID renders the legacy InviteLanding", async () => {
    const legacyId = "aBcDeFgHiJkLmNoPqRsT";
    await renderPage(legacyId);
    expect(screen.getByTestId("legacy-landing")).toHaveTextContent(legacyId);
    expect(screen.queryByTestId("code-landing")).not.toBeInTheDocument();
  });
});

describe("/invite/[code] — shop links (WEB-SHOP-LINK)", () => {
  beforeEach(() => {
    SHOP_LINKS.push(FIXTURE_SHOP);
  });
  afterEach(() => {
    SHOP_LINKS.length = 0;
  });

  it("a shop code renders InviteCodeLanding with the round's invite code, plus the round line", async () => {
    await renderPage("bean26");
    expect(screen.getByTestId("code-landing")).toHaveTextContent("AAAA2222");
    expect(screen.queryByTestId("legacy-landing")).not.toBeInTheDocument();
    expect(screen.getByTestId("shop-round-line")).toHaveTextContent(
      "Bean There · Round 1 of 1, 6 Jan to 31 Dec",
    );
  });

  it("an 8-character invite still renders InviteCodeLanding with that code, and no shop line", async () => {
    await renderPage("K7M4-PQX2");
    expect(screen.getByTestId("code-landing")).toHaveTextContent("K7M4-PQX2");
    expect(screen.queryByTestId("shop-round-line")).not.toBeInTheDocument();
  });

  it("a 20-character ID still renders the legacy InviteLanding with the raw ID", async () => {
    await renderPage("aBcDeFgHiJkLmNoPqRsT");
    expect(screen.getByTestId("legacy-landing")).toHaveTextContent("aBcDeFgHiJkLmNoPqRsT");
    expect(screen.queryByTestId("shop-round-line")).not.toBeInTheDocument();
  });

  it("an unknown 4-7 character code falls through to the legacy path unchanged", async () => {
    await renderPage("NOPE99");
    expect(screen.getByTestId("legacy-landing")).toHaveTextContent("NOPE99");
  });

  it("after the last round: friendly finished page with a /download link, no landing", async () => {
    SHOP_LINKS.length = 0;
    SHOP_LINKS.push({
      ...FIXTURE_SHOP,
      rounds: [{ startDate: "2020-01-06", endDate: "2020-01-12", inviteCode: "AAAA2222" }],
    });
    await renderPage("BEAN26");
    expect(
      screen.getByText("Bean There's ileadit rounds have finished. Thanks for playing!"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /get the app/i })).toHaveAttribute("href", "/download");
    expect(screen.queryByTestId("code-landing")).not.toBeInTheDocument();
    expect(screen.queryByTestId("legacy-landing")).not.toBeInTheDocument();
  });
});
