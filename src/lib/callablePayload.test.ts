import { describe, it, expect } from "vitest";
import { compactPayload } from "./callablePayload";

/**
 * Pins the exact bug this helper exists to fix (see the header comment in
 * `callablePayload.ts`): a callable request key whose value is `undefined`
 * OR `null` must be REMOVED from the payload object — the Firebase web SDK
 * serializes an `undefined` property value as JSON `null` on the wire, and
 * a caller can also hand this a genuine runtime `null` directly (nothing
 * sanitises actual runtime data just because the static type says
 * otherwise) — either way, the engine's `.optional()` zod schemas reject a
 * key that's present with a `null` value; only a MISSING key is accepted.
 *
 * Equally important: `compactPayload` must never over-strip. `false`, `0`,
 * and `""` are all real, meaningful values a caller might legitimately
 * want to send — only `undefined` and `null` are "this key is absent"
 * signals.
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

  it("MUT-COMPACT-4: removes a key whose value is null — null is also an absence signal, not a real value to send", () => {
    const result = compactPayload({ a: null as string | null, b: undefined as string | undefined, c: "kept" });
    expect(result).toEqual({ c: "kept" });
    expect("a" in result).toBe(false);
    expect("b" in result).toBe(false);
  });

  it("MUT-COMPACT-5: an object with no undefined/null values is returned with all keys intact", () => {
    const input = { competitionId: "comp1", label: "x", maxUses: 5 };
    expect(compactPayload(input)).toEqual(input);
  });

  it("MUT-COMPACT-6: an empty object returns an empty object", () => {
    expect(compactPayload({})).toEqual({});
  });

  it("MUT-COMPACT-7: an array is rejected at the type level, not silently treated as a numeric-keyed object", () => {
    // @ts-expect-error compactPayload's type parameter excludes arrays —
    // passing one must fail to compile so a caller can't accidentally turn
    // an array into a `{"0": ..., "1": ...}` payload.
    compactPayload([1, 2, 3]);
    expect(true).toBe(true);
  });
});
