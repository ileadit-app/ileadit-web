import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ResetPasswordCard } from "./ResetPasswordCard";

/**
 * WEB-AUTH-1 (reset surface). `@/lib/auth` is mocked at the module boundary;
 * `src/lib/auth.test.ts` pins that `requestPasswordReset` collapses every
 * Firebase result except a malformed email to "sent".
 */
const requestPasswordResetMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  requestPasswordReset: (email: string) => requestPasswordResetMock(email),
}));

const NEUTRAL = "If there's an account for that email, we've sent a reset link.";

function submit(email: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: /send reset link|resend link/i }));
}

beforeEach(() => {
  requestPasswordResetMock.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("ResetPasswordCard", () => {
  it("shows the neutral confirmation after a send", async () => {
    requestPasswordResetMock.mockResolvedValue({ status: "sent" });
    render(<ResetPasswordCard />);
    submit("someone@example.com");
    expect(await screen.findByText((text) => text.includes(NEUTRAL))).toBeInTheDocument();
    expect(requestPasswordResetMock).toHaveBeenCalledWith("someone@example.com");
    expect(document.body.textContent).not.toMatch(/no account|not found|doesn't exist/i);
  });

  it("shows only a field error for a malformed email and never calls Firebase", () => {
    render(<ResetPasswordCard />);
    submit("not-an-email");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it("shows the field error when Firebase rejects the email format", async () => {
    requestPasswordResetMock.mockResolvedValue({ status: "invalid-email" });
    render(<ResetPasswordCard />);
    submit("a@b.co");
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.queryByText((text) => text.includes("we've sent a reset link"))).not.toBeInTheDocument();
  });

  it("shows a real error banner for a network/rate-limit failure, not the neutral message", async () => {
    requestPasswordResetMock.mockResolvedValue({
      status: "error",
      message: "We couldn't reach ileadit. Check your connection and try again.",
    });
    render(<ResetPasswordCard />);
    submit("someone@example.com");
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't reach ileadit");
    expect(screen.queryByText((text) => text.includes(NEUTRAL))).not.toBeInTheDocument();
    // Not treated as "sent" — no cooldown, resend stays immediately available.
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeEnabled();
  });

  it("disables resend for 30 seconds after each send", async () => {
    vi.useFakeTimers();
    requestPasswordResetMock.mockResolvedValue({ status: "sent" });
    render(<ResetPasswordCard />);
    submit("someone@example.com");
    await act(async () => {});
    const button = screen.getByRole("button", { name: "Resend link" });
    expect(button).toBeDisabled();
    expect(screen.getByText("You can resend in 30s.")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(29_000);
    });
    expect(button).toBeDisabled();
    expect(screen.getByText("You can resend in 1s.")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(button).toBeEnabled();

    const firstConfirmation = screen.getByText((t) => t.includes("we've sent a reset link"));
    expect(firstConfirmation.closest("[aria-live]")).not.toBeNull();
    expect(firstConfirmation).toHaveTextContent(/Sent at/);

    fireEvent.click(button);
    await act(async () => {});
    expect(requestPasswordResetMock).toHaveBeenCalledTimes(2);
    // A fresh node in the live region, so screen readers announce the resend.
    const secondConfirmation = screen.getByText((t) => t.includes("we've sent a reset link"));
    expect(secondConfirmation).not.toBe(firstConfirmation);
    expect(screen.getByRole("button", { name: "Resend link" })).toBeDisabled();
  });
});
