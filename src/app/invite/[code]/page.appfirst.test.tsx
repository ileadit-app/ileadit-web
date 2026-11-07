import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import InvitePage from "./page";
import { SHOP_LINKS } from "@/lib/shopLinks";

/**
 * JOIN-CODE-W: through the REAL page and the REAL `InviteCodeLanding`, a shop
 * link's app button must use the resolved round's 8-character invite code,
 * never the shop slug. (`page.test.tsx` stubs the landing, so it cannot see
 * the button.) Only the auth hook, the preview callable and the QR canvas are
 * mocked.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,stub") },
}));
vi.mock("@/context/AuthContext", () => ({
  useUser: () => ({ status: "signed-out", user: null }),
}));
vi.mock("@/lib/competitionDetail", () => ({
  useOwnMembership: () => ({ status: "not-member" }),
}));
const previewInviteMock = vi.fn();
vi.mock("@/lib/invites", async () => {
  const actual = await vi.importActual<typeof import("@/lib/invites")>("@/lib/invites");
  return { ...actual, previewInvite: (code: string) => previewInviteMock(code) };
});

const FIXTURE_SHOP = {
  code: "BEAN26",
  shopName: "Bean There",
  timeZone: "Europe/London" as const,
  rounds: [{ startDate: "2020-01-06", endDate: "2099-12-31", inviteCode: "AAAA2222" }],
};

async function renderPage(code: string) {
  await act(async () => {
    render(
      <Suspense fallback={<div />}>
        <InvitePage params={Promise.resolve({ code })} />
      </Suspense>,
    );
  });
}

beforeEach(() => {
  previewInviteMock.mockReset();
  previewInviteMock.mockResolvedValue({
    status: "success",
    result: {
      available: true,
      competitionId: "comp1",
      competitionName: "Step Champs",
      description: null,
      startDate: "2026-09-15",
      endDate: "2026-09-22",
      durationDays: 7,
      status: "active",
      dayNumber: 3,
      playerCount: 12,
    },
  });
  SHOP_LINKS.push(FIXTURE_SHOP);
});
afterEach(() => {
  SHOP_LINKS.length = 0;
});

describe("/invite/[code] shop link — app button (JOIN-CODE-W)", () => {
  it("MUT-SHOP-APP-1: the app button and the shown code use the round's invite code, not the slug", async () => {
    await renderPage("bean26");
    const button = await screen.findByRole("link", { name: "Open in the ileadit app" });
    expect(button).toHaveAttribute("href", "ileadit://invite/AAAA2222");
    expect(button.getAttribute("href")).not.toMatch(/bean/i);
    expect(screen.getByTestId("invite-code")).toHaveTextContent("AAAA 2222");
    expect(previewInviteMock).toHaveBeenCalledWith("AAAA2222");
  });
});
