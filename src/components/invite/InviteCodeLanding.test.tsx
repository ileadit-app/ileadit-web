import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { InviteCodeLanding } from "./InviteCodeLanding";

/**
 * Covers BUILD item 1's core states for the NEW 8-character invite-code
 * path: available (signed-out, signed-in-not-member with a mid-competition
 * join note, signed-in-already-member), and the ONE uniform unavailable
 * state. `acceptInvite`'s success/error mapping is exercised here too since
 * `JoinInviteCode` lives in this same file.
 *
 * Mocking boundary: `next/link` (plain `<a>`, same as `CompetitionDetail.
 * test.tsx`), `@/context/AuthContext`'s `useUser`, `@/lib/competitionDetail`'s
 * `useOwnMembership`, and the two invite callables (`previewInvite`/
 * `acceptInvite`) from `@/lib/invites` — everything else in that module
 * (`buildInviteUrl`, `formatInviteCodeForDisplay`, `acceptInviteFailureMessage`)
 * is the REAL implementation via `importActual`, so this file is pinning
 * real formatting/copy, not a second mocked copy of it. `qrcode`'s default
 * export is mocked at its own module boundary (jsdom has no real canvas) —
 * see `qrCode.ts`'s own header comment for why that's the right place to
 * mock, not `InviteQrCode` itself.
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

const useUserMock = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useUser: () => useUserMock(),
}));

const useOwnMembershipMock = vi.fn();
vi.mock("@/lib/competitionDetail", () => ({
  useOwnMembership: (uid: string | null, id: string) => useOwnMembershipMock(uid, id),
}));

const previewInviteMock = vi.fn();
const acceptInviteMock = vi.fn();
vi.mock("@/lib/invites", async () => {
  const actual = await vi.importActual<typeof import("@/lib/invites")>("@/lib/invites");
  return {
    ...actual,
    previewInvite: (code: string) => previewInviteMock(code),
    acceptInvite: (code: string) => acceptInviteMock(code),
  };
});

const CODE = "K7M4PQX2";

const AVAILABLE_ACTIVE = {
  available: true as const,
  competitionId: "comp1",
  competitionName: "Step Champs",
  description: null,
  startDate: "2026-09-15",
  endDate: "2026-09-22",
  durationDays: 7,
  status: "active" as const,
  dayNumber: 3,
  playerCount: 12,
};

beforeEach(() => {
  useUserMock.mockReset();
  useOwnMembershipMock.mockReset();
  previewInviteMock.mockReset();
  acceptInviteMock.mockReset();
});

describe("InviteCodeLanding — preview states", () => {
  it("MUT-INV-1: an unavailable preview renders the ONE uniform message, never a specific reason", async () => {
    previewInviteMock.mockResolvedValueOnce({ status: "success", result: { available: false } });
    useUserMock.mockReturnValue({ status: "signed-out", user: null });

    render(<InviteCodeLanding code={CODE} />);

    // The body copy names several possible reasons in one uniform sentence
    // (see the component's own comment) — what this test actually pins is
    // that the heading is the single, non-specific "isn't available" title,
    // never a reason-specific heading picked based on the (unknown) cause.
    expect(await screen.findByText("This invite isn't available")).toBeInTheDocument();
  });

  it("MUT-INV-2: a previewInvite failure also lands on the uniform unavailable state", async () => {
    previewInviteMock.mockResolvedValueOnce({
      status: "failure",
      failure: { code: "functions/internal", reason: null, message: "boom", cause: null },
    });
    useUserMock.mockReturnValue({ status: "signed-out", user: null });

    render(<InviteCodeLanding code={CODE} />);

    expect(await screen.findByText("This invite isn't available")).toBeInTheDocument();
  });

  it("MUT-INV-3: signed-out + available shows competition name, code, and a sign-in CTA", async () => {
    previewInviteMock.mockResolvedValueOnce({ status: "success", result: AVAILABLE_ACTIVE });
    useUserMock.mockReturnValue({ status: "signed-out", user: null });

    render(<InviteCodeLanding code={CODE} />);

    expect(await screen.findByText("Step Champs")).toBeInTheDocument();
    expect(screen.getByText("K7M4-PQX2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in to join/i })).toBeInTheDocument();
  });
});

describe("InviteCodeLanding — signed-in, not a member yet", () => {
  beforeEach(() => {
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
    useOwnMembershipMock.mockReturnValue({ status: "not-member" });
  });

  it("MUT-INV-4: an active-status preview with a dayNumber shows the mid-competition join note before joining", async () => {
    previewInviteMock.mockResolvedValueOnce({ status: "success", result: AVAILABLE_ACTIVE });

    render(<InviteCodeLanding code={CODE} />);

    expect(await screen.findByText(/joining on day 3/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /join competition/i })).toBeInTheDocument();
  });

  it("MUT-INV-5: a successful accept shows the joined confirmation with the returned dayNumber", async () => {
    previewInviteMock.mockResolvedValueOnce({ status: "success", result: AVAILABLE_ACTIVE });
    acceptInviteMock.mockResolvedValueOnce({
      status: "success",
      result: { competitionId: "comp1", joined: true, alreadyMember: false, dayNumber: 3 },
    });

    const { fireEvent } = await import("@testing-library/react");
    render(<InviteCodeLanding code={CODE} />);

    const button = await screen.findByRole("button", { name: /join competition/i });
    fireEvent.click(button);

    expect(await screen.findByText(/you joined on day 3/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view competition/i })).toBeInTheDocument();
  });

  it("MUT-INV-6: a join-refused accept failure shows the mapped error, not the generic invite-unavailable copy", async () => {
    previewInviteMock.mockResolvedValueOnce({ status: "success", result: AVAILABLE_ACTIVE });
    acceptInviteMock.mockResolvedValueOnce({
      status: "failure",
      failure: {
        kind: "join-refused",
        failure: {
          reason: "not-joinable",
          code: "functions/failed-precondition",
          message: "competition is not open for joining",
          cause: null,
        },
      },
    });

    const { fireEvent } = await import("@testing-library/react");
    render(<InviteCodeLanding code={CODE} />);

    const button = await screen.findByRole("button", { name: /join competition/i });
    fireEvent.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent(/already under way|finished|left/i);
  });
});

describe("InviteCodeLanding — signed-in, already a member", () => {
  it("MUT-INV-7: shows 'already a player' copy and a View competition link, not a Join button", async () => {
    previewInviteMock.mockResolvedValueOnce({ status: "success", result: AVAILABLE_ACTIVE });
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
    useOwnMembershipMock.mockReturnValue({
      status: "member",
      player: {
        displayName: "u1",
        avatarIndex: null,
        points: 10,
        todayPoints: 1,
        livesRemaining: 3,
        eliminated: false,
        frozenRank: null,
      },
    });

    render(<InviteCodeLanding code={CODE} />);

    await waitFor(() => expect(screen.getByText(/already a player/i)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /join competition/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view competition/i })).toBeInTheDocument();
  });
});

/**
 * PC-9 contract correction (d): `previewInvite`'s `visibility` field is
 * OPTIONAL, with different semantics from every other visibility surface —
 * the chip renders ONLY when the field is actually present on the preview
 * result, never defaulted via `resolveCompetitionVisibility`. `AVAILABLE_ACTIVE`
 * (above) deliberately has no `visibility` key at all, so it doubles as the
 * "absent" fixture here.
 */
describe("InviteCodeLanding — PC-9 visibility chip (optional on the preview, unlike every other surface)", () => {
  it("PC-9-INV-1: no visibility field on the preview result renders no visibility chip at all", async () => {
    previewInviteMock.mockResolvedValueOnce({ status: "success", result: AVAILABLE_ACTIVE });
    useUserMock.mockReturnValue({ status: "signed-out", user: null });

    render(<InviteCodeLanding code={CODE} />);

    await screen.findByText("Step Champs");
    expect(screen.queryByText(/^public$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^private$/i)).not.toBeInTheDocument();
  });

  it("PC-9-INV-2: visibility:\"private\" on the preview result renders the Private chip", async () => {
    previewInviteMock.mockResolvedValueOnce({
      status: "success",
      result: { ...AVAILABLE_ACTIVE, visibility: "private" as const },
    });
    useUserMock.mockReturnValue({ status: "signed-out", user: null });

    render(<InviteCodeLanding code={CODE} />);

    await screen.findByText("Step Champs");
    expect(screen.getByText(/^private$/i)).toBeInTheDocument();
  });

  it("PC-9-INV-3: visibility:\"public\" on the preview result renders the Public chip", async () => {
    previewInviteMock.mockResolvedValueOnce({
      status: "success",
      result: { ...AVAILABLE_ACTIVE, visibility: "public" as const },
    });
    useUserMock.mockReturnValue({ status: "signed-out", user: null });

    render(<InviteCodeLanding code={CODE} />);

    await screen.findByText("Step Champs");
    expect(screen.getByText(/^public$/i)).toBeInTheDocument();
  });

  it("PC-9-INV-4: a private competition's signed-out view shows the 'someone shared this invite link with you directly' line", async () => {
    previewInviteMock.mockResolvedValueOnce({
      status: "success",
      result: { ...AVAILABLE_ACTIVE, visibility: "private" as const },
    });
    useUserMock.mockReturnValue({ status: "signed-out", user: null });

    render(<InviteCodeLanding code={CODE} />);

    expect(
      await screen.findByText(/someone shared this invite link with you directly/i),
    ).toBeInTheDocument();
  });

  it("PC-9-INV-5: a public competition's signed-out view does NOT show the private-specific line", async () => {
    previewInviteMock.mockResolvedValueOnce({
      status: "success",
      result: { ...AVAILABLE_ACTIVE, visibility: "public" as const },
    });
    useUserMock.mockReturnValue({ status: "signed-out", user: null });

    render(<InviteCodeLanding code={CODE} />);

    await screen.findByText("Step Champs");
    expect(
      screen.queryByText(/someone shared this invite link with you directly/i),
    ).not.toBeInTheDocument();
  });
});

/**
 * PC-9 contract corrections (b)/(c): `acceptInvite`'s join-refused failure
 * copy for the two new engine reasons, on the invite-landing surface. Same
 * `toCompetitionMembershipFailure`/`competitionMembershipFailureMessage`
 * wiring as `CompetitionDetail.tsx`'s detail-page CTA
 * (`CompetitionDetail.test.tsx`'s PC-9-DETAIL-JOIN-* pair) — this file pins
 * the SAME two messages arrive via the `acceptInvite`/invite-landing path
 * too, plus the overlap-only "Go to your dashboard" link.
 */
describe("InviteCodeLanding — PC-9 competition-private / overlapping-competition join refusals", () => {
  beforeEach(() => {
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
    useOwnMembershipMock.mockReturnValue({ status: "not-member" });
  });

  it("PC-9-INV-6: a competition-private refusal shows the private-specific copy, no dashboard link", async () => {
    previewInviteMock.mockResolvedValueOnce({ status: "success", result: AVAILABLE_ACTIVE });
    acceptInviteMock.mockResolvedValueOnce({
      status: "failure",
      failure: {
        kind: "join-refused",
        failure: {
          reason: "competition-private",
          code: "functions/permission-denied",
          message: "not authorized",
          cause: null,
        },
      },
    });

    const { fireEvent } = await import("@testing-library/react");
    render(<InviteCodeLanding code={CODE} />);

    const button = await screen.findByRole("button", { name: /join competition/i });
    fireEvent.click(button);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "This is a private competition — you'll need an invite link to join it.",
    );
    expect(screen.queryByRole("link", { name: /go to your dashboard/i })).not.toBeInTheDocument();
  });

  it("PC-9-INV-7: an overlapping-competition refusal shows the overlap-specific copy and a 'Go to your dashboard' link", async () => {
    previewInviteMock.mockResolvedValueOnce({ status: "success", result: AVAILABLE_ACTIVE });
    acceptInviteMock.mockResolvedValueOnce({
      status: "failure",
      failure: {
        kind: "join-refused",
        failure: {
          reason: "overlapping-competition",
          code: "functions/failed-precondition",
          message: "already in another competition",
          cause: null,
        },
      },
    });

    const { fireEvent } = await import("@testing-library/react");
    render(<InviteCodeLanding code={CODE} />);

    const button = await screen.findByRole("button", { name: /join competition/i });
    fireEvent.click(button);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "You're already in another active competition, and ileadit only allows one at a time. Leave that one first if you want to switch.",
    );
    expect(screen.getByRole("link", { name: /go to your dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });
});
