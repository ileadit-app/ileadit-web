import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import GlobalError from "./global-error";

/**
 * Pins W11-BOUNDARIES's `global-error.tsx` — the fallback for the root
 * layout itself throwing. Next.js renders this directly in place of the
 * ENTIRE document (it defines its own `<html>`/`<body>`) when that
 * happens; there is no surrounding boundary to simulate the way
 * `error.test.tsx` does for the route-level case; this file renders the
 * component directly with a hand-built `error` prop, matching what Next
 * would pass.
 */

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

const testError = Object.assign(new Error("layout blew up, uid=abc123"), {
  digest: "abc123digest",
});

describe("global-error.tsx — root layout render-error boundary", () => {
  it("MUT-GERR-1: renders a self-contained fallback with a way back in", () => {
    render(<GlobalError error={testError} reset={() => {}} />);

    expect(
      screen.getByRole("heading", { name: /ileadit isn't loading right now/i }),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /reload ileadit/i });
    expect(link).toHaveAttribute("href", "/");
  });

  it("MUT-GERR-2: the error still reaches the console — it is not swallowed", () => {
    render(<GlobalError error={testError} reset={() => {}} />);

    const loggedIt = consoleErrorSpy.mock.calls.some(
      (call: unknown[]) =>
        typeof call[0] === "string" &&
        call[0].includes("[global-error boundary]") &&
        call[1] === testError,
    );
    expect(loggedIt).toBe(true);
  });

  it("MUT-GERR-3: the thrown error's own message never reaches the rendered output", () => {
    const { container } = render(<GlobalError error={testError} reset={() => {}} />);

    expect(container.textContent).not.toContain("uid=abc123");
    expect(container.textContent).not.toContain("layout blew up");
  });
});
