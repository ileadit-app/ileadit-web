import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import AdminUsagePage, { metadata } from "./page";
import { buildFixture } from "@/lib/usageMetricsFixtures";

/**
 * Pins the strict admin gate of /admin/usage (WEB-PORTAL-USAGE-1), through the
 * real page, ProtectedRoute, UsageGate, useStrictAdmin and the read layer.
 *
 * Only the boundaries are mocked: the auth context (who is signed in and what
 * their token says), the Firebase SDK getters, `firebase/auth`'s token listener
 * and `firebase/firestore`. The load-bearing assertion in every non-admin case
 * is that Firestore was never touched: not by `getDocs`, not by `getDoc`, and
 * not even by building a query.
 */

const NOW = new Date();

const useUserMock = vi.fn();
vi.mock("@/context/AuthContext", () => ({ useUser: () => useUserMock() }));

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/admin/usage",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: () => ({}),
  getFirebaseDb: () => ({}),
}));

// The token listener: tests drive it by hand through `tokenListener`.
let tokenListener: ((u: unknown) => void) | null = null;
const unsubscribeMock = vi.fn();
vi.mock("firebase/auth", () => ({
  onIdTokenChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    tokenListener = cb;
    return unsubscribeMock;
  },
}));

const getDocsMock = vi.fn();
const getDocMock = vi.fn();
const collectionMock = vi.fn((...args: unknown[]) => ({ kind: "collection", path: args.slice(1).join("/") }));
const docMock = vi.fn((...args: unknown[]) => ({ kind: "doc", path: args.slice(1).join("/") }));
const queryMock = vi.fn((...args: unknown[]) => ({ kind: "query", source: args[0] }));
vi.mock("firebase/firestore", () => ({
  collection: (...a: unknown[]) => collectionMock(...a),
  doc: (...a: unknown[]) => docMock(...a),
  query: (...a: unknown[]) => queryMock(...a),
  orderBy: (...a: unknown[]) => ({ kind: "orderBy", a }),
  limit: (n: number) => ({ kind: "limit", n }),
  getDocs: (...a: unknown[]) => getDocsMock(...a),
  getDoc: (...a: unknown[]) => getDocMock(...a),
}));

function firestoreCalls(): number {
  return (
    getDocsMock.mock.calls.length +
    getDocMock.mock.calls.length +
    collectionMock.mock.calls.length +
    docMock.mock.calls.length +
    queryMock.mock.calls.length
  );
}

function userWith(getIdTokenResult: (force?: boolean) => Promise<{ claims: Record<string, unknown> }>) {
  return { uid: "user-1", getIdTokenResult: vi.fn(getIdTokenResult) };
}

function signedIn(user: ReturnType<typeof userWith>) {
  useUserMock.mockReturnValue({ status: "signed-in", user });
}

let alertPresent = false;

function serveFixtureDocuments() {
  const fx = buildFixture("5", NOW);
  getDocsMock.mockImplementation(async (q: { source?: { path?: string } }) => {
    const path = q?.source?.path ?? "";
    if (path.endsWith("metrics/daily")) {
      return { empty: false, docs: [...fx.daily].reverse().map((d) => ({ data: () => d.data })) };
    }
    return { empty: fx.runs.length === 0, docs: fx.runs.map((r) => ({ data: () => r })) };
  });
  getDocMock.mockImplementation(async (ref: { path?: string }) => {
    if (ref?.path === "ops/alerts/jobFailed/usageMetrics") return { exists: () => alertPresent, data: () => ({}) };
    return {
      exists: () => fx.live !== null,
      data: () => ({ dates: fx.live?.dates, computedAt: fx.live?.computedAt }),
    };
  });
}

beforeEach(() => {
  useUserMock.mockReset();
  replaceMock.mockReset();
  getDocsMock.mockReset();
  getDocMock.mockReset();
  collectionMock.mockClear();
  docMock.mockClear();
  queryMock.mockClear();
  unsubscribeMock.mockClear();
  tokenListener = null;
  alertPresent = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("/admin/usage: strict admin gate", () => {
  it("signed out: redirects to /login with a way back, shows nothing, reads nothing", async () => {
    useUserMock.mockReturnValue({ status: "signed-out", user: null });
    render(<AdminUsagePage />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login?redirect=%2Fadmin%2Fusage"));
    expect(screen.queryByRole("heading", { name: "Usage" })).not.toBeInTheDocument();
    expect(firestoreCalls()).toBe(0);
  });

  it("session still loading: no redirect, no dashboard, no Firestore", () => {
    useUserMock.mockReturnValue({ status: "loading", user: null });
    render(<AdminUsagePage />);

    expect(replaceMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Usage" })).not.toBeInTheDocument();
    expect(firestoreCalls()).toBe(0);
  });

  it("no read before the gate: while the admin check is pending nothing is read", async () => {
    let release: (v: { claims: Record<string, unknown> }) => void = () => {};
    const user = userWith(() => new Promise((resolve) => (release = resolve)));
    signedIn(user);
    serveFixtureDocuments();
    render(<AdminUsagePage />);

    await waitFor(() => expect(user.getIdTokenResult).toHaveBeenCalled());
    expect(screen.getByText("Checking your access…")).toBeInTheDocument();
    expect(firestoreCalls()).toBe(0);

    await act(async () => release({ claims: { admin: true } }));
    await screen.findByRole("heading", { name: "Usage" });
    expect(firestoreCalls()).toBeGreaterThan(0);
  });

  it("creator-claim only (canCreateCompetitions): denied, with no Firestore request", async () => {
    const user = userWith(async () => ({ claims: { canCreateCompetitions: true } }));
    signedIn(user);
    serveFixtureDocuments();
    render(<AdminUsagePage />);

    expect(await screen.findByRole("heading", { name: "This account doesn't have admin access" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Usage" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to your dashboard/i })).toHaveAttribute("href", "/dashboard");
    expect(firestoreCalls()).toBe(0);
  });

  it("admin claim that is not exactly true (string, 1) is denied", async () => {
    for (const admin of ["true", 1, "yes"]) {
      useUserMock.mockReset();
      signedIn(userWith(async () => ({ claims: { admin } })));
      const { unmount } = render(<AdminUsagePage />);
      await screen.findByRole("heading", { name: "This account doesn't have admin access" });
      expect(firestoreCalls()).toBe(0);
      unmount();
    }
  });

  it("plain signed-in player: denied, no Firestore request", async () => {
    signedIn(userWith(async () => ({ claims: {} })));
    render(<AdminUsagePage />);

    await screen.findByRole("heading", { name: "This account doesn't have admin access" });
    expect(firestoreCalls()).toBe(0);
  });

  it("token error fails closed: denied, no Firestore request", async () => {
    signedIn(
      userWith(async () => {
        throw new Error("network down");
      }),
    );
    render(<AdminUsagePage />);

    await screen.findByRole("heading", { name: "This account doesn't have admin access" });
    expect(firestoreCalls()).toBe(0);
  });

  it("admin: forces a token refresh, then reads only the four usage paths and renders the page", async () => {
    const user = userWith(async () => ({ claims: { admin: true } }));
    signedIn(user);
    serveFixtureDocuments();
    render(<AdminUsagePage />);

    expect(await screen.findByRole("heading", { name: "Usage" })).toBeInTheDocument();
    expect(user.getIdTokenResult).toHaveBeenCalledWith(true);
    await screen.findByTestId("last-run");

    const paths = [
      ...collectionMock.mock.calls.map((c) => c.slice(1).join("/")),
      ...docMock.mock.calls.map((c) => c.slice(1).join("/")),
    ];
    expect(new Set(paths)).toEqual(
      new Set([
        "ops/metrics/daily",
        "ops/metrics/live/current",
        "ops/jobRuns/usageMetrics",
        "ops/alerts/jobFailed/usageMetrics",
      ]),
    );
    expect(paths.some((p) => p.startsWith("users"))).toBe(false);
  });

  it("the failure alert document alone shows the banner even when the latest run is ok", async () => {
    signedIn(userWith(async () => ({ claims: { admin: true } })));
    serveFixtureDocuments();
    alertPresent = true;
    render(<AdminUsagePage />);

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("The nightly job failed");
    // The run is ok, so there is no stage or error code to show.
    expect(banner).not.toHaveTextContent(/Stage:|Error code:/);
  });

  it("a claim revoked mid-session closes the page; a changed token that still has it does not", async () => {
    signedIn(userWith(async () => ({ claims: { admin: true } })));
    serveFixtureDocuments();
    render(<AdminUsagePage />);
    await screen.findByRole("heading", { name: "Usage" });
    expect(tokenListener).not.toBeNull();

    // First call is the cached token: ignored.
    await act(async () => tokenListener?.({ uid: "user-1", getIdTokenResult: async () => ({ claims: {} }) }));
    expect(screen.getByRole("heading", { name: "Usage" })).toBeInTheDocument();

    // Token refreshed and still admin: stays.
    await act(async () =>
      tokenListener?.({ uid: "user-1", getIdTokenResult: async () => ({ claims: { admin: true } }) }),
    );
    expect(screen.getByRole("heading", { name: "Usage" })).toBeInTheDocument();

    // Token refreshed without the claim: closes.
    await act(async () => tokenListener?.({ uid: "user-1", getIdTokenResult: async () => ({ claims: {} }) }));
    await screen.findByRole("heading", { name: "This account doesn't have admin access" });
    expect(screen.queryByRole("heading", { name: "Usage" })).not.toBeInTheDocument();
  });
});

describe("/admin/usage: not public", () => {
  it("is marked noindex, nofollow", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
