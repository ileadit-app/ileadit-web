import { Suspense } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import InvitePage from "./page";

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
