import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { InviteCodeLanding } from "./InviteCodeLanding";

/**
 * JOIN-CODE-W: the app-first invite page. Same mocking boundary as
 * `InviteCodeLanding.test.tsx` (auth hook, membership hook, the two invite
 * callables, the QR canvas), plus a mutable stand-in for `storeLinks.ts`
 * (same getter trick as `storeLinks.test.tsx`). The real formatting and copy
 * helpers in `@/lib/invites` run unmocked.
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

const urls = vi.hoisted(() => ({ play: null as string | null, app: null as string | null }));
vi.mock("@/lib/storeLinks", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storeLinks")>("@/lib/storeLinks");
  return {
    ...actual,
    get PLAY_STORE_URL() {
      return urls.play;
    },
    get APP_STORE_URL() {
      return urls.app;
    },
  };
});

const useUserMock = vi.fn();
vi.mock("@/context/AuthContext", () => ({ useUser: () => useUserMock() }));
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
const PLAY = "https://play.google.com/store/apps/details?id=test.ileadit";
const APPLE = "https://apps.apple.com/app/id000";

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

function mockClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

beforeEach(() => {
  urls.play = null;
  urls.app = null;
  useUserMock.mockReset();
  useOwnMembershipMock.mockReset();
  previewInviteMock.mockReset();
  acceptInviteMock.mockReset();
  previewInviteMock.mockResolvedValue({ status: "success", result: AVAILABLE_ACTIVE });
});

describe("InviteCodeLanding: signed out, app first", () => {
  beforeEach(() => {
    useUserMock.mockReturnValue({ status: "signed-out", user: null });
  });

  it("shows the code big and grouped as ABCD EFGH", async () => {
    render(<InviteCodeLanding code="k7m4-pqx2" />);
    expect(await screen.findByTestId("invite-code")).toHaveTextContent(/^K7M4 PQX2$/);
  });

  it("Copy code copies the plain 8 characters, no space or hyphen", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    render(<InviteCodeLanding code="k7m4-pqx2" />);
    fireEvent.click(await screen.findByRole("button", { name: /copy code/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("K7M4PQX2"));
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("says so when the copy fails, instead of pretending", async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    render(<InviteCodeLanding code={CODE} />);
    fireEvent.click(await screen.findByRole("button", { name: /copy code/i }));
    expect(await screen.findByText(/couldn't copy/i)).toBeInTheDocument();
  });

  it("MUT-APP-1: the primary button opens ileadit://invite/{CODE} with the plain code", async () => {
    render(<InviteCodeLanding code="k7m4-pqx2" />);
    const button = await screen.findByRole("link", { name: "Open in the ileadit app" });
    expect(button).toHaveAttribute("href", "ileadit://invite/K7M4PQX2");
  });

  it("shows the three steps, in order, next to the button", async () => {
    render(<InviteCodeLanding code={CODE} />);
    await screen.findByText("Step Champs");
    const list = document.querySelector("ol") as HTMLElement;
    // Direct attribute check: jsdom does not model preflight's list-role demotion.
    expect(list).toHaveAttribute("role", "list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Get ileadit free.");
    expect(items[1]).toHaveTextContent("Open it and set up your account.");
    expect(items[2]).toHaveTextContent(
      "Come back here and tap Open in the ileadit app, or enter the code in Competitions.",
    );
  });

  it("step 1 carries the real store links when they exist", async () => {
    urls.play = PLAY;
    urls.app = APPLE;
    render(<InviteCodeLanding code={CODE} />);
    await screen.findByText("Step Champs");
    const step1 = document.querySelectorAll("ol > li")[0] as HTMLElement;
    expect(within(step1).getByRole("link", { name: /google play/i })).toHaveAttribute("href", PLAY);
    expect(within(step1).getByRole("link", { name: /app store/i })).toHaveAttribute("href", APPLE);
    expect(screen.queryByText(/early access/i)).not.toBeInTheDocument();
  });

  it("with no store listing yet: no store button, the early-access sentence instead", async () => {
    render(<InviteCodeLanding code={CODE} />);
    await screen.findByText("Step Champs");
    expect(screen.queryByRole("link", { name: /google play|app store/i })).not.toBeInTheDocument();
    expect(screen.getByText(/early access on android and iphone/i)).toBeInTheDocument();
  });

  it("sign-in is a secondary text link after the app button, keeping the redirect", async () => {
    render(<InviteCodeLanding code={CODE} />);
    const appButton = await screen.findByRole("link", { name: "Open in the ileadit app" });
    const signIn = screen.getByRole("link", { name: "Sign in to join here." });
    expect(signIn).toHaveAttribute("href", `/login?redirect=${encodeURIComponent(`/invite/${CODE}`)}`);
    expect(screen.getByText(/already playing\?/i)).toBeInTheDocument();
    expect(signIn.className).not.toContain("bg-brand-gold");
    expect(appButton.className).toContain("bg-brand-gold");
    expect(appButton.compareDocumentPosition(signIn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the competition preview (name and dates)", async () => {
    render(<InviteCodeLanding code={CODE} />);
    expect(await screen.findByText("Step Champs")).toBeInTheDocument();
    expect(screen.getByText(/15 Sep\w* – 22 Sep/)).toBeInTheDocument();
  });

  it("does not use the words private or secure", async () => {
    render(<InviteCodeLanding code={CODE} />);
    await screen.findByText("Step Champs");
    expect(document.body.textContent).not.toMatch(/private|secure/i);
  });
});

describe("InviteCodeLanding: signed in, app button is secondary", () => {
  beforeEach(() => {
    useUserMock.mockReturnValue({ status: "signed-in", user: { uid: "u1" } });
    useOwnMembershipMock.mockReturnValue({ status: "not-member" });
  });

  it("keeps the Join button primary, with the code and the app button under it", async () => {
    render(<InviteCodeLanding code="k7m4pqx2" />);
    const join = await screen.findByRole("button", { name: /join competition/i });
    const appButton = screen.getByRole("link", { name: "Open in the ileadit app" });
    expect(appButton).toHaveAttribute("href", "ileadit://invite/K7M4PQX2");
    expect(screen.getByTestId("invite-code")).toHaveTextContent("K7M4 PQX2");
    expect(join.className).toContain("bg-brand-gold");
    expect(appButton.className).not.toContain("bg-brand-gold");
    expect(join.compareDocumentPosition(appButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("MUT-APP-2: Join still works for an existing player", async () => {
    acceptInviteMock.mockResolvedValueOnce({
      status: "success",
      result: { competitionId: "comp1", joined: true, alreadyMember: false, dayNumber: 3 },
    });
    render(<InviteCodeLanding code={CODE} />);
    fireEvent.click(await screen.findByRole("button", { name: /join competition/i }));
    expect(await screen.findByText(/you joined on day 3/i)).toBeInTheDocument();
    expect(acceptInviteMock).toHaveBeenCalledWith(CODE);
  });

  it("MUT-APP-3: age-not-confirmed shows the app message with the code and a primary app button, no technical text", async () => {
    acceptInviteMock.mockResolvedValueOnce({
      status: "failure",
      failure: {
        kind: "age-not-confirmed",
        failure: {
          code: "functions/failed-precondition",
          reason: "age-not-confirmed",
          message: "age not confirmed",
          cause: null,
        },
      },
    });
    render(<InviteCodeLanding code={CODE} />);
    fireEvent.click(await screen.findByRole("button", { name: /join competition/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Finish setting up your account in the ileadit app first, then join with code K7M4 PQX2 in the app or here.",
    );
    expect(alert.textContent).not.toMatch(/age-not-confirmed|failed-precondition|functions\//i);
    const appButton = screen.getByRole("link", { name: "Open in the ileadit app" });
    expect(appButton).toHaveAttribute("href", "ileadit://invite/K7M4PQX2");
    expect(appButton.className).toContain("bg-brand-gold");
    // Join stays available for after they finish in the app.
    expect(screen.getByRole("button", { name: /join competition/i })).toBeInTheDocument();
  });

  it("MUT-APP-4: other refusals keep their existing messages", async () => {
    acceptInviteMock.mockResolvedValueOnce({
      status: "failure",
      failure: {
        kind: "invite-unavailable",
        failure: { code: "functions/failed-precondition", reason: null, message: "revoked", cause: null },
      },
    });
    render(<InviteCodeLanding code={CODE} />);
    fireEvent.click(await screen.findByRole("button", { name: /join competition/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/isn't available any more/i);
    expect(alert.textContent).not.toMatch(/finish setting up/i);
    expect(screen.getByRole("link", { name: "Open in the ileadit app" }).className).not.toContain(
      "bg-brand-gold",
    );
  });
});
