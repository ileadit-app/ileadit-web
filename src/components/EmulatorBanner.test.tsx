import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import EmulatorBanner from "./EmulatorBanner";

/**
 * PORTAL-EMU-1: pins that the "TEST ENVIRONMENT" banner renders ONLY when
 * the emulator switch is on — a test build must never be visually
 * mistaken for production, and a real production build must never show
 * this banner by accident.
 */

const ENV_KEY = "NEXT_PUBLIC_USE_FIREBASE_EMULATORS";
const original = process.env[ENV_KEY];

afterEach(() => {
  if (original === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = original;
});

describe("EmulatorBanner", () => {
  it("MUT-EMU-10: renders nothing when the switch is off/unset", () => {
    delete process.env[ENV_KEY];
    const { container } = render(<EmulatorBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("MUT-EMU-11: renders the banner text when the switch is on", () => {
    process.env[ENV_KEY] = "true";
    render(<EmulatorBanner />);
    expect(screen.getByRole("status")).toHaveTextContent(/test environment/i);
    expect(screen.getByRole("status")).toHaveTextContent(/firebase emulators/i);
  });
});
