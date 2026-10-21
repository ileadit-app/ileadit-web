import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AuthCredential } from "firebase/auth";

/**
 * WEB-AUTH-1 review follow-up: the OAuth-popup linking panel never shows raw
 * Firebase error text. The Firebase Auth SDK and `@/lib/firebase` are mocked.
 */
const signInWithPopupMock = vi.fn();
const signInWithEmailAndPasswordMock = vi.fn();
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  OAuthProvider: class {},
  linkWithCredential: vi.fn(),
  signInWithPopup: (...a: unknown[]) => signInWithPopupMock(...a),
  signInWithEmailAndPassword: (...a: unknown[]) => signInWithEmailAndPasswordMock(...a),
}));
vi.mock("@/lib/firebase", () => ({ getFirebaseAuth: () => ({}) }));

import { AccountLinkingPanel } from "./AccountLinkingPanel";

const RAW = "Firebase: Error (auth/internal-error).";
function authError(code: string) {
  return Object.assign(new Error(RAW), { code });
}
const pendingCredential = { providerId: "google.com" } as AuthCredential;

beforeEach(() => {
  signInWithPopupMock.mockReset();
  signInWithEmailAndPasswordMock.mockReset();
});

describe("AccountLinkingPanel errors", () => {
  it("shows generic copy, not Firebase text, when the provider link fails", async () => {
    signInWithPopupMock.mockRejectedValue(authError("auth/internal-error"));
    render(
      <AccountLinkingPanel
        info={{ email: "me@example.com", existingMethod: "google.com", pendingCredential, attemptedProviderLabel: "Microsoft" }}
        onBack={vi.fn()}
        onLinked={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't complete that. Please try again.");
    expect(document.body.textContent).not.toContain("Firebase");
  });

  it("shows the neutral sign-in copy when the password step fails", async () => {
    signInWithEmailAndPasswordMock.mockRejectedValue(authError("auth/wrong-password"));
    render(
      <AccountLinkingPanel
        info={{ email: "me@example.com", existingMethod: "password", pendingCredential, attemptedProviderLabel: "Google" }}
        onBack={vi.fn()}
        onLinked={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "nope12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in & link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Check your email and password and try again.");
    expect(document.body.textContent).not.toContain("Firebase");
  });
});
