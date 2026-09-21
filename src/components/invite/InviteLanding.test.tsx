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

  it("WEB-3 item 5: the disabled 'Joining…' button uses an explicit muted colour, not opacity", async () => {
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
    expect(joiningButton.className).toContain("disabled:bg-muted");
    expect(joiningButton.className).toContain("disabled:text-muted-foreground");
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
});
