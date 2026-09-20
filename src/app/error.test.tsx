import { Component, type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundaryPage from "./error";

/**
 * Pins W11-BOUNDARIES's route-level `error.tsx`.
 *
 * Next.js wraps every page segment in a real React error boundary and
 * renders `error.tsx` as that boundary's fallback, passing it `{error,
 * reset}` — that wiring lives entirely inside Next's App Router runtime,
 * which this repo's Vitest harness does not run (see `vitest.config.mts`'s
 * header comment: no real Next server/router in tests). `TestErrorBoundary`
 * below is a minimal, hand-written stand-in for that exact contract (catch
 * a child's render throw, call the fallback with `{error, reset}`) — not a
 * copy of Next's internals, just enough of the same shape to prove
 * `ErrorBoundaryPage` behaves correctly once something throws under it.
 * This is the same "mock at the boundary, exercise the real component"
 * discipline as `EngineBootstrap.test.tsx`.
 *
 * `next/link` is stubbed to a plain anchor, same convention as
 * `account-deletion/page.test.tsx` — routing context isn't under test.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

class TestErrorBoundary extends Component<
  { children: ReactNode; onError?: (error: Error) => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return <ErrorBoundaryPage error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

function Bomb({ message }: { message: string }): null {
  throw new Error(message);
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // React itself logs a caught render error to console.error (its own
  // "above error occurred in <Bomb>" dev warning) in addition to the
  // explicit call this file is pinning — silence both so test output stays
  // clean, and inspect `.mock.calls` rather than a single `toHaveBeenCalledWith`
  // so either source of console noise doesn't make the assertion brittle.
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("error.tsx — route-level render-error boundary", () => {
  it("MUT-ERR-1: a throwing child renders the boundary's fallback instead of crashing the tree", () => {
    render(
      <TestErrorBoundary>
        <Bomb message="render exploded" />
      </TestErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", { name: /something's gone wrong on our end/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to ileadit/i })).toHaveAttribute("href", "/");
  });

  it("MUT-ERR-2: the error still reaches the console — it is not swallowed", () => {
    render(
      <TestErrorBoundary>
        <Bomb message="render exploded" />
      </TestErrorBoundary>,
    );

    const loggedTheBoundaryMessage = consoleErrorSpy.mock.calls.some(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("[error boundary]") &&
        call[1] instanceof Error &&
        call[1].message === "render exploded",
    );
    expect(loggedTheBoundaryMessage).toBe(true);
  });

  it("MUT-ERR-3: the thrown error's own message never reaches the rendered output", () => {
    const { container } = render(
      <TestErrorBoundary>
        <Bomb message="internal uid=abc123 leaked from a Firebase call" />
      </TestErrorBoundary>,
    );

    expect(container.textContent).not.toContain("uid=abc123");
    expect(container.textContent).not.toContain("internal uid=abc123 leaked from a Firebase call");
  });

  it("MUT-ERR-4: does not offer a bare reset()-only retry button — see this file's header comment on why that would be dishonest here", () => {
    render(
      <TestErrorBoundary>
        <Bomb message="render exploded" />
      </TestErrorBoundary>,
    );

    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload this page/i })).toBeInTheDocument();
  });

  it("MUT-ERR-5: \"Reload this page\" triggers a real browser reload, not reset()", () => {
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    // jsdom's window.location.reload throws "Not implemented" — replace
    // the whole object for this one test so the click handler can be
    // exercised without that noise, then restore it immediately after.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });

    render(
      <TestErrorBoundary>
        <Bomb message="render exploded" />
      </TestErrorBoundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: /reload this page/i }));

    expect(reloadSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });
});
