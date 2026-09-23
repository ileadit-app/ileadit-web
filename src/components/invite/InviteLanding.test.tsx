import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InviteLanding } from "./InviteLanding";

/**
 * Pins every state `/invite/[code]` can render (ticket W6-INVITE), each
 * tagged with a MUT-* id and mutation-proven (mutate the source, confirm
 * RED, revert, confirm GREEN — see the ticket's findings for the log).
 *
 * Mocks only the module boundaries `InviteLanding` actually reads:
 * `@/context/AuthContext` (`useUser`), `@/lib/competitionDetail`
 * (`useCompetitionDetail`, `useOwnMembership`), and `@/lib/joinCompetition`
 * (the callable wrapper — never the real `httpsCallable`/Firebase). `next/link`
 * is stubbed to a plain anchor, same reason as `CreateCompetitionGate.test.tsx`:
 * it needs App Router context this test never sets up, and the link's
 * routing behaviour isn't part of what this file pins — only its `href` is.
 *
 * MUT-2 (the "already started" hard stop) is the case the ticket calls out
 * as most worth pinning: `joinCompetition` refuses unconditionally once a
 * competition leaves `scheduled`, so this state must never offer a
 * "join anyway" path back into the same competition.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const useUserMock = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useUser: () => useUserMock(),
}));

const useCompetitionDetailMock = vi.fn();
const useOwnMembershipMock = vi.fn();
vi.mock("@/lib/competitionDetail", () => ({
  useCompetitionDetail: (id: string) => useCompetitionDetailMock(id),
  useOwnMembership: (uid: string | null, id: string) => useOwnMembershipMock(uid, id),
}));

const joinCompetitionMock = vi.fn();
vi.mock("@/lib/joinCompetition", () => ({
  joinCompetition: (id: string) => joinCompetitionMock(id),
}));

const COMPETITION_ID = "comp-123";

function baseCompetition(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: COMPETITION_ID,
    name: "March Madness Steps",
    description: null,
    imageUrl: null,
    backgroundImageUrl: null,
    status: "scheduled",
    startDate: "2026-10-01",
    endDate: "2026-10-08",
    durationDays: 7,
    playerCount: 12,
    winnerIds: [],
    ...overrides,
  };
}

beforeEach(() => {
  useUserMock.mockReset();
  useCompetitionDetailMock.mockReset();
  useOwnMembershipMock.mockReset();
  joinCompetitionMock.mockReset();
});

describe("InviteLanding", () => {
  // MUT-1: signed-out visitor — most people arriving from a colleague's
  // link have never signed in. Must show a sign-in CTA carrying a
  // ?redirect= back to this exact invite, and must never attempt to render
  // competition content (which the rules would deny anyway pre-auth).
  it("MUT-1: signed-out — shows a sign-in CTA with a redirect back to this invite, no competition content", () => {
    useUserMock.mockReturnValue({ status: "signed-out", user: null });

    render(<InviteLanding competitionId={COMPETITION_ID} />);

    const link = screen.getByRole("link", { name: /sign in to see this invite/i });
    expect(link).toHaveAttribute(
      "href",
      `/login?redirect=${encodeURIComponent(`/invite/${COMPETITION_ID}`)}`,
    );
    expect(screen.queryByText(/join competition/i)).not.toBeInTheDocument();
    expect(useCompetitionDetailMock).not.toHaveBeenCalled();
  });

  // MUT-2: the hard stop. Once a competition is active/finalising/finished,
  // joinCompetition refuses unconditionally (competitions.ts:699) — there is
  // no "join anyway". This is the state the ticket calls out as most worth
  // pinning precisely because a regression here would silently reopen a
  // join path the engine has already closed.
  it("MUT-2: already started (active) — hard stop copy, no join button, single CTA away from this competition", () => {
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: baseCompetition({ status: "active" }),
    });
    useOwnMembershipMock.mockReturnValue({ status: "not-member" });

    render(<InviteLanding competitionId={COMPETITION_ID} />);

    expect(screen.getByRole("heading", { name: /already under way/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /join competition/i })).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: /find one you can join/i });
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  // WEB-3 item 3 / engine ticket JOIN-1: the join gate now accepts a join on
  // the exact day a competition became active, not just while scheduled.
  // Pins that `InviteLanding` renders the JOINABLE state (not the hard stop)
  // for a not-member on day one of an active competition.
  it("MUT-JOIN1-DAYONE: active competition, startDate is today (competition zone) — still shows Join, not the hard stop", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T10:00:00Z"));
    try {
      useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
      useCompetitionDetailMock.mockReturnValue({
        status: "success",
        competition: baseCompetition({
          status: "active",
          startDate: "2026-09-21",
          timeZone: "Europe/London",
        }),
      });
      useOwnMembershipMock.mockReturnValue({ status: "not-member" });

      render(<InviteLanding competitionId={COMPETITION_ID} />);

      expect(screen.getByRole("button", { name: /join competition/i })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /already under way/i })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  // Same active status, but startDate was an earlier day — the JOIN-1
  // exception is day-one-only, so this must still hit the hard stop.
  it("MUT-JOIN1-PASTDAY: active competition, startDate was an earlier day — still the hard stop", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T10:00:00Z"));
    try {
      useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
      useCompetitionDetailMock.mockReturnValue({
        status: "success",
        competition: baseCompetition({
          status: "active",
          startDate: "2026-09-14",
          timeZone: "Europe/London",
        }),
      });
      useOwnMembershipMock.mockReturnValue({ status: "not-member" });

      render(<InviteLanding competitionId={COMPETITION_ID} />);

      expect(screen.getByRole("heading", { name: /already under way/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /join competition/i })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("MUT-2b: already started (finished) — distinct 'already finished' copy, same hard stop", () => {
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: baseCompetition({ status: "finished" }),
    });
    useOwnMembershipMock.mockReturnValue({ status: "not-member" });

    render(<InviteLanding competitionId={COMPETITION_ID} />);

    expect(screen.getByRole("heading", { name: /already finished/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /join competition/i })).not.toBeInTheDocument();
  });

  // MUT-3: bad/unknown code. Same state whether the link was mistyped or
  // the competition no longer exists — the doc read just comes back
  // not-found either way.
  it("MUT-3: competition not found / bad code — shows the invalid-link message", () => {
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
    useCompetitionDetailMock.mockReturnValue({ status: "not-found" });
    useOwnMembershipMock.mockReturnValue({ status: "not-member" });

    render(<InviteLanding competitionId={COMPETITION_ID} />);

    expect(screen.getByRole("heading", { name: /invite link isn't valid/i })).toBeInTheDocument();
  });

  // MUT-4: already a member (e.g. clicked their own invite link twice, or
  // joined some other way already). Must route them to the competition,
  // never show a Join button that would just be idempotently ignored.
  it("MUT-4: already a member — shows 'already in' with a link to the competition, no join button", () => {
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: baseCompetition({ status: "scheduled" }),
    });
    useOwnMembershipMock.mockReturnValue({
      status: "member",
      player: {
        displayName: "Al",
        avatarIndex: 0,
        points: 10,
        todayPoints: 1,
        livesRemaining: 3,
        eliminated: false,
      },
    });

    render(<InviteLanding competitionId={COMPETITION_ID} />);

    expect(screen.getByRole("heading", { name: /you're already in/i })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /view competition/i });
    expect(link).toHaveAttribute("href", `/competitions/${COMPETITION_ID}`);
    expect(screen.queryByRole("button", { name: /join competition/i })).not.toBeInTheDocument();
  });

  // MUT-5: the happy path — valid, joinable, not yet a member. Clicking
  // Join calls the real callable wrapper and, on success, flips to a
  // confirmation with a link into the competition.
  it("MUT-5: valid and joinable — shows Join, calls joinCompetition, and confirms success", async () => {
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: baseCompetition({ status: "scheduled" }),
    });
    useOwnMembershipMock.mockReturnValue({ status: "not-member" });
    joinCompetitionMock.mockResolvedValue({
      status: "success",
      result: { joined: true, alreadyMember: false, playerCount: 13 },
    });

    render(<InviteLanding competitionId={COMPETITION_ID} />);

    const joinButton = screen.getByRole("button", { name: /join competition/i });
    fireEvent.click(joinButton);

    await waitFor(() => expect(joinCompetitionMock).toHaveBeenCalledWith(COMPETITION_ID));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /you're in!/i })).toBeInTheDocument(),
    );
    const link = screen.getByRole("link", { name: /view competition/i });
    expect(link).toHaveAttribute("href", `/competitions/${COMPETITION_ID}`);
  });

  it("WEB-4 item 1: the disabled 'Joining…' button uses the named cta-disabled tokens, not opacity", async () => {
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: baseCompetition({ status: "scheduled" }),
    });
    useOwnMembershipMock.mockReturnValue({ status: "not-member" });
    let resolveJoin: (v: {
      status: "success";
      result: { joined: boolean; alreadyMember: boolean; playerCount: number };
    }) => void = () => {};
    joinCompetitionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveJoin = resolve;
      }),
    );

    render(<InviteLanding competitionId={COMPETITION_ID} />);
    fireEvent.click(screen.getByRole("button", { name: /join competition/i }));

    const joiningButton = await screen.findByRole("button", { name: /joining/i });
    expect(joiningButton).toBeDisabled();
    expect(joiningButton.className).toContain("disabled:bg-cta-disabled");
    expect(joiningButton.className).toContain("disabled:text-cta-disabled-foreground");
    expect(joiningButton.className).not.toContain("opacity-60");

    resolveJoin({ status: "success", result: { joined: true, alreadyMember: false, playerCount: 13 } });
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /you're in!/i })).toBeInTheDocument(),
    );
  });

  // W9-A11Y. The "You're in!" card is reached by a user ACTION on this same
  // page (clicking Join) with no route change and no natural focus move —
  // nothing else would tell a screen reader user the click did anything.
  // `InviteStatusCard`'s `live` prop wires this to `role="status"
  // aria-live="polite"`. Mutation-proven: removed the `live` prop from the
  // `JoinableInvite` success render in `InviteLanding.tsx`, confirmed RED,
  // reverted, confirmed GREEN.
  it("MUT-A11Y-JOIN-SUCCESS-LIVE: the join-success card is an announced live region", async () => {
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: baseCompetition({ status: "scheduled" }),
    });
    useOwnMembershipMock.mockReturnValue({ status: "not-member" });
    joinCompetitionMock.mockResolvedValue({
      status: "success",
      result: { joined: true, alreadyMember: false, playerCount: 13 },
    });

    render(<InviteLanding competitionId={COMPETITION_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /join competition/i }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /you're in!/i })).toBeInTheDocument(),
    );
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(/you're in!/i);
  });

  it("MUT-5b: join failure — surfaces the failure message, does not confirm success", async () => {
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: baseCompetition({ status: "scheduled" }),
    });
    useOwnMembershipMock.mockReturnValue({ status: "not-member" });
    joinCompetitionMock.mockResolvedValue({
      status: "failure",
      failure: { reason: "not-joinable", code: "functions/failed-precondition", message: "x", cause: null },
    });

    render(<InviteLanding competitionId={COMPETITION_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /join competition/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: /you're in!/i })).not.toBeInTheDocument();
  });

  /* ------------------------------------------------------------------ *
   * PC-6: the legacy door's handling of private competitions. See
   * `InviteLanding.tsx`'s own header comment (cases a/b/c) for the full
   * reasoning — these five tests each pin one case.
   * ------------------------------------------------------------------ */

  // Case (a): the doc itself says private, viewer isn't a member, and the
  // competition is still inside its joinable window — must lock, not offer
  // a Join button that's guaranteed to fail.
  it("PC-6-PRIVATE-LOCK: private competition, not a member, still joinable — shows the invite-only door, no Join button", () => {
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: baseCompetition({ status: "scheduled", visibility: "private" }),
    });
    useOwnMembershipMock.mockReturnValue({ status: "not-member" });

    render(<InviteLanding competitionId={COMPETITION_ID} />);

    expect(screen.getByRole("heading", { name: /invite-only/i })).toBeInTheDocument();
    expect(screen.getByText(/you'll need an invite link to join it/i)).toBeInTheDocument();
    expect(screen.getByText("Private · invite only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /join competition/i })).not.toBeInTheDocument();
    expect(joinCompetitionMock).not.toHaveBeenCalled();
  });

  // Case (b): the competition doc itself can't be read at all. Under the
  // new visibility-aware rules this is what a non-member hitting a private
  // competition's legacy link looks like — must degrade to the same
  // invite-only door, never a crash and never the "not found" copy (the
  // doc DOES exist, it's just not visible to this viewer).
  it("PC-6-DENIED: competition doc read comes back permission-denied — shows the invite-only door, not 'not found' or a crash", () => {
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
    useCompetitionDetailMock.mockReturnValue({ status: "denied" });
    useOwnMembershipMock.mockReturnValue({ status: "not-member" });

    render(<InviteLanding competitionId={COMPETITION_ID} />);

    expect(screen.getByRole("heading", { name: /invite-only/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /invite link isn't valid/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /couldn't load this invite/i })).not.toBeInTheDocument();
  });

  // Case (c): the proactive lock didn't fire (e.g. `visibility` wasn't
  // `"private"` on the last read this client saw), but `joinCompetition`
  // itself still refuses with `competition-private` — the card must swap
  // away from the dead Join button entirely, not just show an inline error
  // next to a button that can never succeed.
  it("PC-6-JOIN-PRIVATE: joinCompetition returns competition-private — swaps to the invite-only door instead of a dead Join button", async () => {
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: baseCompetition({ status: "scheduled" }),
    });
    useOwnMembershipMock.mockReturnValue({ status: "not-member" });
    joinCompetitionMock.mockResolvedValue({
      status: "failure",
      failure: {
        reason: "competition-private",
        code: "functions/permission-denied",
        message: "not authorized",
        cause: null,
      },
    });

    render(<InviteLanding competitionId={COMPETITION_ID} />);
    fireEvent.click(screen.getByRole("button", { name: /join competition/i }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /invite-only/i })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /join competition/i })).not.toBeInTheDocument();
    // Reached via a user action on this same page — must be announced.
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/invite-only/i);
  });

  // The unrelated "one active competition at a time" refusal — same copy +
  // dashboard link treatment as `CompetitionDetail.tsx`/`InviteCodeLanding
  // .tsx`. Must stay an inline alert, NOT the invite-only door (this has
  // nothing to do with privacy).
  it("PC-6-JOIN-OVERLAP: joinCompetition returns overlapping-competition — inline copy plus a dashboard link, Join button stays", async () => {
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: baseCompetition({ status: "scheduled" }),
    });
    useOwnMembershipMock.mockReturnValue({ status: "not-member" });
    joinCompetitionMock.mockResolvedValue({
      status: "failure",
      failure: {
        reason: "overlapping-competition",
        code: "functions/failed-precondition",
        message: "already in another competition",
        cause: null,
      },
    });

    render(<InviteLanding competitionId={COMPETITION_ID} />);
    fireEvent.click(screen.getByRole("button", { name: /join competition/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "You're already in a competition that runs at the same time. You can be in one competition at a time. Leave that one first if you want to switch.",
    );
    expect(screen.getByRole("link", { name: /go to your dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.queryByRole("heading", { name: /invite-only/i })).not.toBeInTheDocument();
  });

  // Public competitions: unchanged. Explicit `visibility: "public"` (rather
  // than relying on the field being absent, as every other test in this
  // file does) — the happy path must still show a plain Join button, with
  // no invite-only wall anywhere in front of it.
  it("PC-6-PUBLIC-UNCHANGED: an explicitly public competition still shows the ordinary Join flow", () => {
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: baseCompetition({ status: "scheduled", visibility: "public" }),
    });
    useOwnMembershipMock.mockReturnValue({ status: "not-member" });

    render(<InviteLanding competitionId={COMPETITION_ID} />);

    expect(screen.getByRole("button", { name: /join competition/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /invite-only/i })).not.toBeInTheDocument();
  });
});
