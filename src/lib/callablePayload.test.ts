import { describe, it, expect } from "vitest";
import { compactPayload } from "./callablePayload";

/**
 * Pins the exact bug this helper exists to fix (see the header comment in
 * `callablePayload.ts`): a callable request key whose value is `undefined`
 * must be REMOVED from the payload object, never merely left as `undefined`
 * — the Firebase web SDK serializes an `undefined` property value as JSON
 * `null`, which the engine's `.optional()` zod schemas reject.
 *
 * Equally important: `compactPayload` must never over-strip. `false`, `0`,
 * `""`, and `null` are all real, meaningful values a caller might
 * legitimately want to send — only `undefined` is a "this key is absent"
 * signal.
 */
describe("compactPayload", () => {
  it("MUT-COMPACT-1: removes a key whose value is undefined", () => {
    const result = compactPayload({ competitionId: "comp1", label: undefined as string | undefined });
    expect(result).toEqual({ competitionId: "comp1" });
    expect("label" in result).toBe(false);
  });

  it("MUT-COMPACT-2: keeps a key whose value is a non-empty string", () => {
    const result = compactPayload({ competitionId: "comp1", label: "Marketing team" });
    expect(result).toEqual({ competitionId: "comp1", label: "Marketing team" });
  });

  it("MUT-COMPACT-3: keeps legitimate falsy values — false, 0, and empty string are not stripped", () => {
    const result = compactPayload({ a: false, b: 0, c: "" });
    expect(result).toEqual({ a: false, b: 0, c: "" });
    expect(Object.keys(result).sort()).toEqual(["a", "b", "c"]);
  });

  it("MUT-COMPACT-4: keeps a real null value — only undefined is stripped, not null", () => {
    const result = compactPayload({ a: null as string | null, b: undefined as string | undefined });
    expect(result).toEqual({ a: null });
    expect("b" in result).toBe(false);
  });

  it("MUT-COMPACT-5: an object with no undefined values is returned with all keys intact", () => {
    const input = { competitionId: "comp1", label: "x", maxUses: 5 };
    expect(compactPayload(input)).toEqual(input);
  });

  it("MUT-COMPACT-6: an empty object returns an empty object", () => {
    expect(compactPayload({})).toEqual({});
  });
});
