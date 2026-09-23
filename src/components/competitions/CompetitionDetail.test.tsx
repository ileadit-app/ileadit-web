import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CompetitionDetail } from "./CompetitionDetail";
import { leaveCompetition } from "@/lib/leaveCompetition";
import { joinCompetition } from "@/lib/joinCompetition";

/**
 * Pins WEB-3 item 6's "Back to dashboard" link on the happy path. Before
 * this ticket, that link only existed in `StatusPage` (the
 * not-found/denied/error branches) — a signed-in, successfully-loaded
 * render had no way back to `/dashboard` except the browser's own back
 * button.
 *
 * Deliberately picks a "not-member, scheduled" competition state, which is
 * the cheapest state to mock: `TodayCard` and `CompetitionLeaderboard` are
 * both gated on membership and never mount, so this file only needs to
 * mock the three hooks `CompetitionDetail.tsx` itself calls
 * unconditionally (`useCompetitionDetail`, `useOwnMembership`,
 * `useCompetitionPlayers`) plus `useUser` — same mocking boundary already
 * used by `InviteLanding.test.tsx` for the first two.
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
const useCompetitionPlayersMock = vi.fn();
vi.mock("@/lib/competitionDetail", () => ({
  useCompetitionDetail: (id: string) => useCompetitionDetailMock(id),
  useOwnMembership: (uid: string | null, id: string) => useOwnMembershipMock(uid, id),
  useCompetitionPlayers: (id: string, enabled: boolean) => useCompetitionPlayersMock(id, enabled),
}));

vi.mock("@/lib/joinCompetition", () => ({ joinCompetition: vi.fn() }));
vi.mock("@/lib/leaveCompetition", () => ({ leaveCompetition: vi.fn() }));
// TodayCard reads real Firestore hooks (`useAccountGameState`,
// `useWarmupDaysConfig`) via a real `getFirebaseDb()` — irrelevant to this
// file's WEB-4 item 3 leave-flow tests, which only need an ACTIVE member to
// render *something* in that slot. Stub it out rather than also mocking two
// more hooks this file has no other reason to touch.
vi.mock("./TodayCard", () => ({ TodayCard: () => null }));

// PC-9 review item 1: an organiser (creatorId === uid) mounts `InvitePanel`
// too, same as `InvitePanel.test.tsx`'s own "CompetitionDetail — InvitePanel
// is organiser-gated" block — `listInvites` is stubbed to a never-resolving
// promise since these tests only need the panel to mount without crashing,
// not to exercise its own list/create/revoke behaviour (that's
// `InvitePanel.test.tsx`'s job).
const listInvitesMock = vi.fn();
vi.mock("@/lib/invites", async () => {
  const actual = await vi.importActual<typeof import("@/lib/invites")>("@/lib/invites");
  return {
    ...actual,
    listInvites: (...args: unknown[]) => listInvitesMock(...args),
  };
});
vi.mock("@/lib/qrCode", () => ({
  useQrDataUrl: () => ({ status: "loading" }),
}));

const COMPETITION_ID = "comp-123";

beforeEach(() => {
  useUserMock.mockReset();
  useCompetitionDetailMock.mockReset();
  useOwnMembershipMock.mockReset();
  useCompetitionPlayersMock.mockReset();
  listInvitesMock.mockReset();
  listInvitesMock.mockReturnValue(new Promise(() => {})); // never resolves — see the mock's own comment above

  useUserMock.mockReturnValue({ user: { uid: "u1" } });
  useCompetitionDetailMock.mockReturnValue({
    status: "success",
    competition: {
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
    },
  });
  useOwnMembershipMock.mockReturnValue({ status: "not-member" });
  useCompetitionPlayersMock.mockReturnValue({ status: "loading" });
});

describe("CompetitionDetail — WEB-3 item 6 back-to-dashboard link", () => {
  it("MUT-BACKLINK: the happy path renders a link back to /dashboard", () => {
    render(<CompetitionDetail competitionId={COMPETITION_ID} />);

    const backLink = screen.getByRole("link", { name: /back to dashboard/i });
    expect(backLink).toHaveAttribute("href", "/dashboard");
  });
});

/**
 * WEB-3 item 3 / engine ticket JOIN-1: `MembershipCta`'s non-member branch
 * for `status === "active"` now offers a real Join button on the exact day
 * the competition started (`canStillJoin`, CompetitionDetail.tsx), instead
 * of always showing the refusal message. Uses fake timers to pin "now" to a
 * specific instant/zone the same way `InviteLanding.test.tsx`'s
 * MUT-JOIN1-DAYONE/MUT-JOIN1-PASTDAY pair does, since neither
 * `isDayOneOfActiveCompetition` nor this component accept a test-only `now`
 * override.
 */
describe("CompetitionDetail — WEB-3 item 3 / JOIN-1 day-one join", () => {
  it("MUT-JOIN1-DETAIL-DAYONE: active competition, startDate is today (competition zone) — shows Join, not the refusal", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T10:00:00Z"));
    try {
      useCompetitionDetailMock.mockReturnValue({
        status: "success",
        competition: {
          id: COMPETITION_ID,
          name: "March Madness Steps",
          description: null,
          imageUrl: null,
          backgroundImageUrl: null,
          status: "active",
          startDate: "2026-09-21",
          endDate: "2026-09-28",
          durationDays: 7,
          playerCount: 12,
          winnerIds: [],
          timeZone: "Europe/London",
        },
      });

      render(<CompetitionDetail competitionId={COMPETITION_ID} />);

      expect(screen.getByRole("button", { name: /join competition/i })).toBeInTheDocument();
      expect(screen.queryByText(/new joins closed after its first day/i)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("MUT-JOIN1-DETAIL-PASTDAY: active competition, startDate was an earlier day — still the refusal, no Join button", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T10:00:00Z"));
    try {
      useCompetitionDetailMock.mockReturnValue({
        status: "success",
        competition: {
          id: COMPETITION_ID,
          name: "March Madness Steps",
          description: null,
          imageUrl: null,
          backgroundImageUrl: null,
          status: "active",
          startDate: "2026-09-14",
          endDate: "2026-09-21",
          durationDays: 7,
          playerCount: 12,
          winnerIds: [],
          timeZone: "Europe/London",
        },
      });

      render(<CompetitionDetail competitionId={COMPETITION_ID} />);

      expect(screen.queryByRole("button", { name: /join competition/i })).not.toBeInTheDocument();
      expect(screen.getByText(/new joins closed after its first day/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * WEB-4 item 3 / engine ticket LEAVE-1 (in progress): an ACTIVE member now
 * sees a "Leave competition" option (previously only a `scheduled` member
 * did), and leaving an active one goes through the styled, destructive
 * `ConfirmDialog` — never the plain browser `window.confirm` a scheduled
 * leave still uses. A `finalising` member must still see no Leave option at
 * all.
 */
function mockActiveMember() {
  useCompetitionDetailMock.mockReturnValue({
    status: "success",
    competition: {
      id: COMPETITION_ID,
      name: "March Madness Steps",
      description: null,
      imageUrl: null,
      backgroundImageUrl: null,
      status: "active",
      startDate: "2026-09-01",
      endDate: "2026-09-28",
      durationDays: 28,
      playerCount: 12,
      winnerIds: [],
      timeZone: "Europe/London",
    },
  });
  useOwnMembershipMock.mockReturnValue({
    status: "member",
    player: {
      displayName: "Test Player",
      avatarIndex: 0,
      points: 120,
      todayPoints: 5,
      livesRemaining: 3,
      eliminated: false,
      frozenRank: null,
    },
  });
}

describe("CompetitionDetail — WEB-4 item 3 / LEAVE-1 active-leave UI", () => {
  beforeEach(() => {
    vi.mocked(leaveCompetition).mockReset();
  });

  it("MUT-LEAVE1-ACTIVE-OPTION: an active member sees a Leave competition option", () => {
    mockActiveMember();
    render(<CompetitionDetail competitionId={COMPETITION_ID} />);

    expect(screen.getByRole("button", { name: /leave competition/i })).toBeInTheDocument();
  });

  it("MUT-LEAVE1-FINALISING-NO-OPTION: a finalising member sees no Leave option", () => {
    mockActiveMember();
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: {
        id: COMPETITION_ID,
        name: "March Madness Steps",
        description: null,
        imageUrl: null,
        backgroundImageUrl: null,
        status: "finalising",
        startDate: "2026-09-01",
        endDate: "2026-09-28",
        durationDays: 28,
        playerCount: 12,
        winnerIds: [],
        timeZone: "Europe/London",
      },
    });

    render(<CompetitionDetail competitionId={COMPETITION_ID} />);

    expect(screen.queryByRole("button", { name: /leave competition/i })).not.toBeInTheDocument();
  });

  it("MUT-LEAVE1-STYLED-DIALOG: clicking Leave on an active competition opens the styled ConfirmDialog, not window.confirm", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    mockActiveMember();
    render(<CompetitionDetail competitionId={COMPETITION_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /leave competition/i }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: /leave march madness steps\?/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/you'll lose your points in this competition and you can't re-join it/i),
    ).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("MUT-LEAVE1-DESTRUCTIVE-CLASS: the dialog's confirm button uses the destructive coral styling", () => {
    mockActiveMember();
    render(<CompetitionDetail competitionId={COMPETITION_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /leave competition/i }));

    // Two "Leave competition" controls now exist: the text-link that opened
    // the dialog, and the dialog's own confirm button — the confirm button
    // is the last one rendered.
    const buttons = screen.getAllByRole("button", { name: /leave competition/i });
    const confirmButton = buttons[buttons.length - 1];
    expect(confirmButton.className).toContain("bg-destructive");
    expect(confirmButton.className).toContain("text-destructive-foreground");
  });

  it("MUT-LEAVE1-CONFIRM-CALLS-LEAVE: confirming calls leaveCompetition and reflects success", async () => {
    vi.mocked(leaveCompetition).mockResolvedValue({
      status: "success",
      result: { left: true, notMember: false, playerCount: 11 },
    });
    mockActiveMember();
    render(<CompetitionDetail competitionId={COMPETITION_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /leave competition/i }));
    const buttons = screen.getAllByRole("button", { name: /leave competition/i });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(leaveCompetition).toHaveBeenCalledWith(COMPETITION_ID);
    // The mocked competition's `startDate` (2026-09-01) is not "today," so
    // once `isMember` flips to false the non-member/active branch correctly
    // shows the refusal message rather than a Join button (JOIN-1's
    // day-one-only re-join window) — asserting the dialog itself has closed
    // is the part this test actually needs to pin.
    await screen.findByText(/new joins closed after its first day/i);
    expect(screen.queryByRole("heading", { name: /leave march madness steps\?/i })).not.toBeInTheDocument();
  });

  it("MUT-LEAVE1-CANCEL-NO-CALL: cancelling the dialog does not call leaveCompetition", () => {
    mockActiveMember();
    render(<CompetitionDetail competitionId={COMPETITION_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /leave competition/i }));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(leaveCompetition).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: /leave march madness steps\?/i })).not.toBeInTheDocument();
  });

});

/**
 * PC-9: the private-competition locked CTA on the detail page, and the
 * `competition-private`/`overlapping-competition` join-refusal copy — both
 * per the PC-9 engine contract corrections (b)/(c), read directly from
 * `competitionMembershipErrors.ts` above rather than guessed.
 */
describe("CompetitionDetail — PC-9 private competition CTA and join refusals", () => {
  beforeEach(() => {
    vi.mocked(joinCompetition).mockReset();
  });

  it("PC-9-DETAIL-LOCKED: a scheduled, private competition shows the locked explainer, not a Join button, for a non-member", () => {
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: {
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
        timeZone: null,
        visibility: "private",
      },
    });

    render(<CompetitionDetail competitionId={COMPETITION_ID} />);

    expect(
      screen.getByText(/you'll need an invite link to join/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /join competition/i })).not.toBeInTheDocument();
  });

  it("PC-9-DETAIL-PUBLIC-STILL-JOINABLE: the same scheduled competition, but public (or visibility absent), still shows the Join button", () => {
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: {
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
        timeZone: null,
        visibility: null,
      },
    });

    render(<CompetitionDetail competitionId={COMPETITION_ID} />);

    expect(screen.getByRole("button", { name: /join competition/i })).toBeInTheDocument();
  });

  it("PC-9-DETAIL-JOIN-PRIVATE-ERROR: a competition-private join refusal shows the private-specific copy", async () => {
    vi.mocked(joinCompetition).mockResolvedValue({
      status: "failure",
      failure: {
        reason: "competition-private",
        code: "functions/permission-denied",
        message: "not authorized",
        cause: null,
      },
    });
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: {
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
        timeZone: null,
        visibility: null,
      },
    });

    render(<CompetitionDetail competitionId={COMPETITION_ID} />);
    fireEvent.click(screen.getByRole("button", { name: /join competition/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "This is a private competition — you'll need an invite link to join it.",
    );
  });

  it("PC-9-DETAIL-JOIN-OVERLAP-ERROR: an overlapping-competition join refusal shows the overlap-specific copy", async () => {
    vi.mocked(joinCompetition).mockResolvedValue({
      status: "failure",
      failure: {
        reason: "overlapping-competition",
        code: "functions/failed-precondition",
        message: "already in another competition",
        cause: null,
      },
    });
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: {
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
        timeZone: null,
        visibility: null,
      },
    });

    render(<CompetitionDetail competitionId={COMPETITION_ID} />);
    fireEvent.click(screen.getByRole("button", { name: /join competition/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "You're already in a competition that runs at the same time. You can be in one competition at a time. Leave that one first if you want to switch.",
    );
    await waitFor(() => expect(joinCompetition).toHaveBeenCalledWith(COMPETITION_ID));
    // PC-9 review item 8: the invite landing already gets a "Go to your
    // dashboard" link for this exact refusal — the detail page's own Join
    // button must match it.
    expect(screen.getByRole("link", { name: /go to your dashboard/i })).toBeInTheDocument();
  });

  it("PC-9-DETAIL-JOIN-PRIVATE-ERROR-NO-DASHBOARD-LINK: a competition-private refusal does NOT get the dashboard link (that's overlap-only)", async () => {
    vi.mocked(joinCompetition).mockResolvedValue({
      status: "failure",
      failure: {
        reason: "competition-private",
        code: "functions/permission-denied",
        message: "not authorized",
        cause: null,
      },
    });
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: {
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
        timeZone: null,
        visibility: null,
      },
    });

    render(<CompetitionDetail competitionId={COMPETITION_ID} />);
    fireEvent.click(screen.getByRole("button", { name: /join competition/i }));

    await screen.findByRole("alert");
    expect(screen.queryByRole("link", { name: /go to your dashboard/i })).not.toBeInTheDocument();
  });

  it("PC-9-DETAIL-LOCKED-ACTIVE-DAYONE: an active, private competition on its own first day shows the locked explainer, not a Join button, for a non-member", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T10:00:00Z"));
    try {
      useCompetitionDetailMock.mockReturnValue({
        status: "success",
        competition: {
          id: COMPETITION_ID,
          name: "March Madness Steps",
          description: null,
          imageUrl: null,
          backgroundImageUrl: null,
          status: "active",
          startDate: "2026-09-21",
          endDate: "2026-09-28",
          durationDays: 7,
          playerCount: 12,
          winnerIds: [],
          timeZone: "Europe/London",
          visibility: "private",
        },
      });

      render(<CompetitionDetail competitionId={COMPETITION_ID} />);

      expect(screen.getByText(/you'll need an invite link to join/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /join competition/i })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("PC-9-DETAIL-LOCKED-ORGANISER: the competition's own creator sees organiser-framed copy pointing at the invite panel, never the outsider 'ask whoever's running it' copy", async () => {
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: {
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
        timeZone: null,
        visibility: "private",
        creatorId: "u1",
      },
    });

    render(<CompetitionDetail competitionId={COMPETITION_ID} />);

    expect(
      await screen.findByText(/as the organiser, use one of your invite links below/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ask whoever's running it to send you one/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /join competition/i })).not.toBeInTheDocument();
    // The organiser also gets the invite panel itself, on the same render.
    expect(await screen.findByRole("heading", { name: /invite people/i })).toBeInTheDocument();
  });

  it("PC-9-DETAIL-LEAVE-PRIVATE-CONFIRM-COPY: leaving a SCHEDULED private competition warns that rejoining needs a valid invite link, not 'any time before it starts'", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: {
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
        timeZone: null,
        visibility: "private",
      },
    });
    useOwnMembershipMock.mockReturnValue({
      status: "member",
      player: {
        displayName: "Test Player",
        avatarIndex: 0,
        points: 0,
        todayPoints: 0,
        livesRemaining: 3,
        eliminated: false,
        frozenRank: null,
      },
    });

    render(<CompetitionDetail competitionId={COMPETITION_ID} />);
    fireEvent.click(screen.getByRole("button", { name: /leave competition/i }));

    expect(confirmSpy).toHaveBeenCalledWith(
      "Leave this competition? It's private, so you'll need a valid invite link to rejoin.",
    );
    expect(confirmSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("You can rejoin any time before it starts"),
    );
    confirmSpy.mockRestore();
  });
});

describe("CompetitionDetail — WEB-4 item 3 / LEAVE-1 scheduled leave still uses window.confirm", () => {
  it("MUT-LEAVE1-SCHEDULED-STILL-WINDOWCONFIRM: leaving a SCHEDULED competition still uses window.confirm, not the styled dialog", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    useCompetitionDetailMock.mockReturnValue({
      status: "success",
      competition: {
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
      },
    });
    useOwnMembershipMock.mockReturnValue({
      status: "member",
      player: {
        displayName: "Test Player",
        avatarIndex: 0,
        points: 0,
        todayPoints: 0,
        livesRemaining: 3,
        eliminated: false,
        frozenRank: null,
      },
    });

    render(<CompetitionDetail competitionId={COMPETITION_ID} />);
    fireEvent.click(screen.getByRole("button", { name: /leave competition/i }));

    expect(confirmSpy).toHaveBeenCalledWith(
      "Leave this competition? You can rejoin any time before it starts.",
    );
    expect(screen.queryByRole("heading", { name: /leave march madness steps\?/i })).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});
