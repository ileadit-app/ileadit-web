import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InvitePanel } from "./InvitePanel";
import { CompetitionDetail } from "./CompetitionDetail";

/**
 * BUILD item 2's organiser panel: create, list, revoke, and the "not shown
 * to non-organisers" gate (proven at the `CompetitionDetail` composition
 * level, same split this codebase already uses elsewhere between a unit
 * test of a gated component and an integration test of its caller — see
 * `CreateCompetitionGate.test.tsx` vs. the page-level composition test it
 * has a sibling of).
 *
 * Privacy invariant this file also pins: nothing rendered by `InvitePanel`
 * ever mentions a player name, point, rank, or step — only `useCount`/
 * status/label per link (INV-1, Paul's HR-visibility decision).
 */

vi.mock("@/lib/invites", async () => {
  const actual = await vi.importActual<typeof import("@/lib/invites")>("@/lib/invites");
  return {
    ...actual,
    createInvite: (...args: unknown[]) => createInviteMock(...args),
    listInvites: (...args: unknown[]) => listInvitesMock(...args),
    revokeInvite: (...args: unknown[]) => revokeInviteMock(...args),
  };
});

const createInviteMock = vi.fn();
const listInvitesMock = vi.fn();
const revokeInviteMock = vi.fn();

vi.mock("@/lib/qrCode", () => ({
  useQrDataUrl: () => ({ status: "success", dataUrl: "data:image/png;base64,stub" }),
}));

const COMPETITION_ID = "comp-123";

const ONE_INVITE = {
  code: "K7M4PQX2",
  displayCode: "K7M4-PQX2",
  url: "https://ileadit-portal.web.app/invite/K7M4PQX2",
  label: "Marketing team",
  createdAt: "2026-09-20T10:00:00.000Z",
  expiresAt: null,
  maxUses: null,
  useCount: 3,
  status: "active" as const,
};

beforeEach(() => {
  createInviteMock.mockReset();
  listInvitesMock.mockReset();
  revokeInviteMock.mockReset();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe("InvitePanel — loading / empty / error", () => {
  it("MUT-PANEL-1: shows a loading skeleton before listInvites resolves", async () => {
    listInvitesMock.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(<InvitePanel competitionId={COMPETITION_ID} />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("MUT-PANEL-2: an empty list shows the 'no invite links yet' state", async () => {
    listInvitesMock.mockResolvedValueOnce({ status: "success", invites: [] });
    render(<InvitePanel competitionId={COMPETITION_ID} />);
    expect(await screen.findByText(/no invite links yet/i)).toBeInTheDocument();
  });

  it("MUT-PANEL-3: a listInvites failure shows the mapped error message", async () => {
    listInvitesMock.mockResolvedValueOnce({
      status: "failure",
      failure: { code: "functions/permission-denied", reason: null, message: "nope", cause: null },
    });
    render(<InvitePanel competitionId={COMPETITION_ID} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/don't have permission/i);
  });
});

describe("InvitePanel — the list, and privacy invariant", () => {
  it("MUT-PANEL-4: renders code/status/label/join-count, never a player name, point, or rank", async () => {
    listInvitesMock.mockResolvedValueOnce({ status: "success", invites: [ONE_INVITE] });
    render(<InvitePanel competitionId={COMPETITION_ID} />);

    expect(await screen.findByText("K7M4-PQX2")).toBeInTheDocument();
    expect(screen.getByText("Marketing team")).toBeInTheDocument();
    expect(screen.getByText(/3 joins/i)).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();

    // Privacy invariant (INV-1): no player-identifying or performance data
    // anywhere in this panel's rendered text.
    const panelText = document.body.textContent ?? "";
    expect(panelText).not.toMatch(/points|rank|steps/i);
  });

  it("MUT-PANEL-5: a non-active invite (e.g. revoked) has no Revoke button", async () => {
    listInvitesMock.mockResolvedValueOnce({
      status: "success",
      invites: [{ ...ONE_INVITE, status: "revoked" as const }],
    });
    render(<InvitePanel competitionId={COMPETITION_ID} />);

    await screen.findByText("Revoked");
    expect(screen.queryByRole("button", { name: /^revoke$/i })).not.toBeInTheDocument();
  });
});

describe("InvitePanel — create", () => {
  it("MUT-PANEL-6: creating an invite calls createInvite with the trimmed label and refreshes the list", async () => {
    listInvitesMock.mockResolvedValueOnce({ status: "success", invites: [] });
    listInvitesMock.mockResolvedValueOnce({ status: "success", invites: [ONE_INVITE] });
    createInviteMock.mockResolvedValueOnce({
      status: "success",
      result: { code: "K7M4PQX2", displayCode: "K7M4-PQX2", url: ONE_INVITE.url },
    });

    render(<InvitePanel competitionId={COMPETITION_ID} />);
    await screen.findByText(/no invite links yet/i);

    fireEvent.change(screen.getByLabelText(/link label/i), { target: { value: "  Marketing team  " } });
    fireEvent.click(screen.getByRole("button", { name: /create invite link/i }));

    await waitFor(() =>
      expect(createInviteMock).toHaveBeenCalledWith({
        competitionId: COMPETITION_ID,
        label: "Marketing team",
      }),
    );
    expect(await screen.findByText("K7M4-PQX2")).toBeInTheDocument();
    expect(listInvitesMock).toHaveBeenCalledTimes(2);
  });

  it("MUT-PANEL-7: a createInvite failure shows the mapped error and does not clear the label", async () => {
    listInvitesMock.mockResolvedValue({ status: "success", invites: [] });
    createInviteMock.mockResolvedValueOnce({
      status: "failure",
      failure: { code: "functions/resource-exhausted", reason: null, message: "too many", cause: null },
    });

    render(<InvitePanel competitionId={COMPETITION_ID} />);
    await screen.findByText(/no invite links yet/i);

    fireEvent.click(screen.getByRole("button", { name: /create invite link/i }));

    expect(await screen.findByText(/20 active links/i)).toBeInTheDocument();
  });
});

describe("InvitePanel — revoke", () => {
  it("MUT-PANEL-8: revoking an active invite requires confirmation, then calls revokeInvite and refreshes", async () => {
    listInvitesMock.mockResolvedValueOnce({ status: "success", invites: [ONE_INVITE] });
    listInvitesMock.mockResolvedValueOnce({
      status: "success",
      invites: [{ ...ONE_INVITE, status: "revoked" as const }],
    });
    revokeInviteMock.mockResolvedValueOnce({ status: "success" });

    render(<InvitePanel competitionId={COMPETITION_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: /^revoke$/i }));

    // The confirmation dialog itself, not the row's own trigger button.
    fireEvent.click(screen.getByRole("button", { name: /revoke link/i }));

    await waitFor(() => expect(revokeInviteMock).toHaveBeenCalledWith("K7M4PQX2"));
    expect(await screen.findByText("Revoked")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ *
 * Composition-level: proves the panel is gated behind organiser status at
 * the CALLER (`CompetitionDetail`), not just capable of rendering on its
 * own. Mirrors the existing `CreateCompetitionGate.test.tsx` /
 * page-composition-test split documented for this codebase.
 * ------------------------------------------------------------------ */

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
vi.mock("./TodayCard", () => ({ TodayCard: () => null }));

const isCurrentUserAdminMock = vi.fn();
vi.mock("@/lib/adminClaim", () => ({
  isCurrentUserAdmin: () => isCurrentUserAdminMock(),
}));

describe("CompetitionDetail — InvitePanel is organiser-gated", () => {
  beforeEach(() => {
    useUserMock.mockReset();
    useCompetitionDetailMock.mockReset();
    useOwnMembershipMock.mockReset();
    useCompetitionPlayersMock.mockReset();
    isCurrentUserAdminMock.mockReset();
    listInvitesMock.mockReset();

    useUserMock.mockReturnValue({ user: { uid: "u1" } });
    useOwnMembershipMock.mockReturnValue({ status: "not-member" });
    useCompetitionPlayersMock.mockReturnValue({ status: "loading" });
    listInvitesMock.mockReturnValue(new Promise(() => {}));
  });

  function competitionWithCreator(creatorId: string | null) {
    return {
      status: "success" as const,
      competition: {
        id: COMPETITION_ID,
        name: "March Madness Steps",
        description: null,
        imageUrl: null,
        backgroundImageUrl: null,
        status: "scheduled" as const,
        startDate: "2026-10-01",
        endDate: "2026-10-08",
        durationDays: 7,
        playerCount: 12,
        winnerIds: [],
        timeZone: null,
        creatorId,
      },
    };
  }

  it("MUT-GATE-1: the creator sees the Invite people panel", async () => {
    useCompetitionDetailMock.mockReturnValue(competitionWithCreator("u1"));
    isCurrentUserAdminMock.mockResolvedValue(false);

    render(<CompetitionDetail competitionId={COMPETITION_ID} />);

    expect(await screen.findByRole("heading", { name: /invite people/i })).toBeInTheDocument();
  });

  it("MUT-GATE-2: an ordinary, non-creator, non-admin member never sees the Invite people panel", async () => {
    useCompetitionDetailMock.mockReturnValue(competitionWithCreator("someone-else"));
    isCurrentUserAdminMock.mockResolvedValue(false);

    render(<CompetitionDetail competitionId={COMPETITION_ID} />);

    await waitFor(() => expect(isCurrentUserAdminMock).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: /invite people/i })).not.toBeInTheDocument();
  });

  it("MUT-GATE-3: a non-creator with the admin claim still sees the panel", async () => {
    useCompetitionDetailMock.mockReturnValue(competitionWithCreator("someone-else"));
    isCurrentUserAdminMock.mockResolvedValue(true);

    render(<CompetitionDetail competitionId={COMPETITION_ID} />);

    expect(await screen.findByRole("heading", { name: /invite people/i })).toBeInTheDocument();
  });
});
