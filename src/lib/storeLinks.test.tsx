import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Download from "@/app/download/page";
import { DownloadSection } from "@/components/marketing/DownloadSection";
import { StoreButtons } from "@/components/StoreButtons";
import { InviteCodeLanding } from "@/components/invite/InviteCodeLanding";
import { storeAvailabilityCopy } from "./storeLinks";

/**
 * WEB-SHOP-LINK: store links live in ONE module (`storeLinks.ts`). These tests
 * drive that module's two constants through a mutable stand-in and check all
 * three surfaces that show store buttons: `/download`, the invite page's
 * "Get the app" block (inside `InviteCodeLanding`), and the homepage
 * `DownloadSection`. The real `storeAvailabilityCopy` runs unmocked.
 */

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
vi.mock("@/lib/invites", async () => {
  const actual = await vi.importActual<typeof import("@/lib/invites")>("@/lib/invites");
  return {
    ...actual,
    previewInvite: async () => ({
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
    }),
  };
});

const PLAY = "https://play.google.com/store/apps/details?id=test.ileadit";
const APPLE = "https://apps.apple.com/app/id000";

const EARLY_ACCESS =
  "ileadit is in early access on Android and iPhone. Store links are coming soon.";

type Surface = { name: string; render: () => Promise<void> | void };

const surfaces: Surface[] = [
  { name: "/download", render: () => void render(<Download />) },
  { name: "homepage DownloadSection", render: () => void render(<DownloadSection />) },
  {
    name: "invite GetTheAppBlock",
    render: async () => {
      render(<InviteCodeLanding code="K7M4PQX2" />);
      await screen.findByText("Step Champs");
    },
  },
];

beforeEach(() => {
  urls.play = null;
  urls.app = null;
});

describe.each(surfaces)("store links on $name", (surface) => {
  it("both null: no store button, no placeholder, early-access copy", async () => {
    await surface.render();
    expect(screen.queryByRole("link", { name: /google play/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /app store/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/placeholder/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/available on android today/i)).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(EARLY_ACCESS.replace(".", "\\.")))).toBeInTheDocument();
  });

  it("only Play set: only the Play button, linking to the Play URL", async () => {
    urls.play = PLAY;
    await surface.render();
    expect(screen.getByRole("link", { name: /google play/i })).toHaveAttribute("href", PLAY);
    expect(screen.queryByRole("link", { name: /app store/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/early access/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/iphone/i)).not.toBeInTheDocument();
  });

  it("only App Store set: only the App Store button", async () => {
    urls.app = APPLE;
    await surface.render();
    expect(screen.getByRole("link", { name: /app store/i })).toHaveAttribute("href", APPLE);
    expect(screen.queryByRole("link", { name: /google play/i })).not.toBeInTheDocument();
  });
});

describe("StoreButtons", () => {
  it("renders nothing at all (no empty wrapper) when both URLs are null", () => {
    const { container } = render(<StoreButtons />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("storeAvailabilityCopy", () => {
  it("names only the stores that are set", () => {
    expect(storeAvailabilityCopy(null, null)).toBe(EARLY_ACCESS);
    expect(storeAvailabilityCopy(PLAY, null)).toBe("Get ileadit on Google Play.");
    expect(storeAvailabilityCopy(null, APPLE)).toBe("Get ileadit on the App Store.");
    expect(storeAvailabilityCopy(PLAY, APPLE)).toBe("Get ileadit on Google Play or the App Store.");
  });
});
