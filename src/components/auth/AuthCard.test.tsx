import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toAuthFailure } from "@/lib/authErrors";

/**
 * WEB-AUTH-1 (sign-in and sign-up surfaces). Boundaries mocked: the Firebase
 * Auth SDK, `@/lib/auth` (the sign-in functions), `@/lib/firebase`,
 * `@/lib/ensureAccount` and Next's router. `toAuthFailure` is the REAL
 * mapper, so Firebase error codes go through the same path as production.
 */
const fetchSignInMethodsMock = vi.fn();
const credentialFromErrorMock = vi.fn();
vi.mock("firebase/auth", () => {
  class GoogleAuthProvider {
    static credentialFromError = (e: unknown) => credentialFromErrorMock(e);
  }
  class OAuthProvider {
    static credentialFromError = (e: unknown) => credentialFromErrorMock(e);
  }
  return {
    GoogleAuthProvider,
    OAuthProvider,
    fetchSignInMethodsForEmail: (...args: unknown[]) => fetchSignInMethodsMock(...args),
    linkWithCredential: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    signInWithPopup: vi.fn(),
  };
});

const signInWithEmailMock = vi.fn();
const signUpWithEmailMock = vi.fn();
const signInWithGoogleMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  signInWithEmail: (...a: unknown[]) => signInWithEmailMock(...a),
  signUpWithEmail: (...a: unknown[]) => signUpWithEmailMock(...a),
  signInWithGoogle: () => signInWithGoogleMock(),
  signInWithMicrosoft: vi.fn(),
  isMicrosoftSignInEnabled: () => false,
}));
vi.mock("@/lib/firebase", () => ({ getFirebaseAuth: () => ({}) }));
vi.mock("@/lib/ensureAccount", () => ({ ensureAccount: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { AuthCard } from "./AuthCard";

function failure(code: string, extra: Record<string, unknown> = {}) {
  return { status: "failure", failure: toAuthFailure(Object.assign(new Error(code), { code, ...extra })) };
}

function submitForm(email = "colleague@example.com", password = "password123") {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.submit(screen.getByLabelText("Email").closest("form")!);
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  for (const m of [
    fetchSignInMethodsMock,
    credentialFromErrorMock,
    signInWithEmailMock,
    signUpWithEmailMock,
    signInWithGoogleMock,
  ]) {
    m.mockReset();
  }
});

describe("AuthCard sign-up collision", () => {
  it("uses neutral copy and never looks up sign-in methods", async () => {
    signUpWithEmailMock.mockResolvedValue(failure("auth/email-already-in-use"));
    render(<AuthCard mode="signup" />);
    submitForm();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "We couldn't create that account. If you already have one, sign in or reset your password.",
    );
    expect(screen.getByRole("link", { name: "reset your password" })).toHaveAttribute("href", "/reset-password");
    expect(document.body.textContent).not.toMatch(/already exists|already got an account|already an ileadit account/i);
    expect(fetchSignInMethodsMock).not.toHaveBeenCalled();
  });
});

describe("AuthCard unrecognised failures", () => {
  it("sign-up shows generic copy, never raw Firebase text", async () => {
    signUpWithEmailMock.mockResolvedValue(failure("auth/operation-not-allowed"));
    render(<AuthCard mode="signup" />);
    submitForm();
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't complete that. Please try again.");
    expect(document.body.textContent).not.toContain("auth/");
  });
});

describe("AuthCard sign-in failures", () => {
  it.each(["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/user-disabled"])(
    "%s shows the same neutral message",
    async (code) => {
      signInWithEmailMock.mockResolvedValue(failure(code));
      render(<AuthCard mode="signin" />);
      submitForm();
      expect(await screen.findByText("Check your email and password and try again.")).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/disabled|not found|no account/i);
    },
  );

  it("network errors get a distinct connection message", async () => {
    signInWithEmailMock.mockResolvedValue(failure("auth/network-request-failed"));
    render(<AuthCard mode="signin" />);
    submitForm();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't reach ileadit. Check your connection and try again.",
    );
    expect(screen.queryByText("Check your email and password and try again.")).not.toBeInTheDocument();
  });

  it("links Forgot password? to /reset-password", () => {
    render(<AuthCard mode="signin" />);
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/reset-password");
  });
});

describe("AuthCard OAuth-popup linking", () => {
  it("still opens the linking panel after a popup collision", async () => {
    signInWithGoogleMock.mockResolvedValue(
      failure("auth/account-exists-with-different-credential", { customData: { email: "me@example.com" } }),
    );
    credentialFromErrorMock.mockReturnValue({ providerId: "google.com" });
    fetchSignInMethodsMock.mockResolvedValue(["password"]);
    render(<AuthCard mode="signin" />);
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(await screen.findByText(/You've already got an account/)).toBeInTheDocument();
    await waitFor(() => expect(fetchSignInMethodsMock).toHaveBeenCalledWith({}, "me@example.com"));
    expect(screen.getByRole("button", { name: "Sign in & link" })).toBeInTheDocument();
  });
});
