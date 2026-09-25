import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AccountView } from "./AccountView";

/**
 * Pins F-DOB-1 (Paul, 25 Sep 2026): iLeadIt must NOT collect or retain date
 * of birth or gender as profile data. The /account "Personal details" form
 * must never render a Date of birth or Gender control, and saving it must
 * never send `dateOfBirth` or `gender` to Firestore - not even as
 * null/empty.
 *
 * The data layer (`@/lib/accountProfile`) is mocked at the module boundary:
 * `useAccountProfile` is fed a LEGACY private-profile document that still
 * carries `dateOfBirth`/`gender` values (as an old mobile-app account
 * might), to prove the page neither shows nor echoes them back on save.
 * `src/lib/accountProfile.test.ts` pins the data layer itself.
 */

const useUserMock = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useUser: () => useUserMock(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const useAccountProfileMock = vi.fn();
const updatePrivateProfileMock = vi.fn();
const updatePublicProfileMock = vi.fn();
vi.mock("@/lib/accountProfile", () => ({
  useAccountProfile: (uid: string | null) => useAccountProfileMock(uid),
  updatePrivateProfile: (...args: unknown[]) => updatePrivateProfileMock(...args),
  updatePublicProfile: (...args: unknown[]) => updatePublicProfileMock(...args),
}));

const LEGACY_PRIVATE_PROFILE = {
  firstName: "Paul",
  surname: "Tester",
  country: "United Kingdom",
  notificationsEnabled: true,
  profileCompleted: true,
  // Legacy fields a pre-F-DOB-1 document may still hold.
  dateOfBirth: "1980-01-01",
  gender: "legacy-gender-value",
};

beforeEach(() => {
  useUserMock.mockReset();
  useAccountProfileMock.mockReset();
  updatePrivateProfileMock.mockReset();
  updatePublicProfileMock.mockReset();
  useUserMock.mockReturnValue({
    status: "signed-in",
    user: { uid: "user-1", email: "paul@example.com", providerData: [{ providerId: "password" }] },
    signOut: vi.fn(),
  });
  useAccountProfileMock.mockReturnValue({
    status: "success",
    publicProfile: { displayName: "Paul", avatarIndex: 0, profileImageUrl: null, city: null },
    privateProfile: LEGACY_PRIVATE_PROFILE,
    game: { coins: 0, lifetimePoints: 0 },
  });
  updatePrivateProfileMock.mockResolvedValue({ status: "success" });
  updatePublicProfileMock.mockResolvedValue({ status: "success" });
});

describe("AccountView - F-DOB-1: no date of birth or gender", () => {
  it("renders no Date of birth or Gender field (and no date input at all)", () => {
    const { container } = render(<AccountView />);
    // Sanity: the Personal details form did render.
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
    expect(screen.getByLabelText("Country")).toBeInTheDocument();

    expect(screen.queryByLabelText(/date of birth/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/gender/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/date of birth/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/gender/i)).not.toBeInTheDocument();
    expect(container.querySelector('input[type="date"]')).toBeNull();
    // Legacy values must not be displayed anywhere.
    expect(container.innerHTML).not.toContain("1980-01-01");
    expect(container.innerHTML).not.toContain("legacy-gender-value");
  });

  it("saving Personal details never sends dateOfBirth or gender", async () => {
    render(<AccountView />);
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() => expect(updatePrivateProfileMock).toHaveBeenCalledTimes(1));
    const [uid, payload] = updatePrivateProfileMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(uid).toBe("user-1");
    expect(payload).not.toHaveProperty("dateOfBirth");
    expect(payload).not.toHaveProperty("gender");
    expect(payload).toEqual({
      firstName: "Paul",
      surname: "Tester",
      country: "United Kingdom",
      notificationsEnabled: true,
    });
  });
});
