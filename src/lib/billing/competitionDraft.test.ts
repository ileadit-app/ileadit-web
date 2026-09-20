// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  STRIPE_METADATA_MAX_VALUE_LENGTH,
  decodeDraftFromMetadata,
  encodeDraftToMetadata,
  type CompetitionDraft,
} from "./competitionDraft";

function draft(overrides: Partial<CompetitionDraft> = {}): CompetitionDraft {
  return {
    draftId: "draft_abc",
    orgId: "org_acme",
    createdByUid: "uid_paul",
    name: "Marketing team step-off",
    startTimeIso: "2026-10-01T08:00:00.000Z",
    durationDays: 7,
    timeZone: "Europe/London",
    ...overrides,
  };
}

describe("encode/decode round trip", () => {
  it("carries every field of a draft through metadata unchanged", () => {
    const original = draft({
      description: "A friendly step-off between the two floors.",
      imageUrl: "https://example.test/hero.png",
      backgroundImageUrl: "https://example.test/bg.png",
    });

    const encoded = encodeDraftToMetadata(original, "team");
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) throw new Error("unreachable");

    const decoded = decodeDraftFromMetadata(encoded.metadata);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error("unreachable");

    expect(decoded.draft).toEqual(original);
    expect(decoded.priceBand).toBe("team");
  });

  it("omits absent optional fields rather than encoding empty strings", () => {
    const encoded = encodeDraftToMetadata(draft(), "company");
    if (!encoded.ok) throw new Error("unreachable");
    expect(encoded.metadata).not.toHaveProperty("comp_description");
    expect(encoded.metadata).not.toHaveProperty("comp_imageUrl");

    const decoded = decodeDraftFromMetadata(encoded.metadata);
    if (!decoded.ok) throw new Error("unreachable");
    expect(decoded.draft.description).toBeUndefined();
  });

  it("namespaces every key so a draft cannot collide with other metadata", () => {
    const encoded = encodeDraftToMetadata(draft(), "team");
    if (!encoded.ok) throw new Error("unreachable");
    for (const key of Object.keys(encoded.metadata)) expect(key.startsWith("comp_")).toBe(true);
  });

  it("survives unrelated metadata sitting alongside the draft", () => {
    const encoded = encodeDraftToMetadata(draft(), "team");
    if (!encoded.ok) throw new Error("unreachable");
    const decoded = decodeDraftFromMetadata({ ...encoded.metadata, some_other_feature: "hello" });
    expect(decoded.ok).toBe(true);
  });
});

describe("encode refuses before any money moves", () => {
  it("rejects a description longer than Stripe will carry, naming the field", () => {
    const tooLong = "x".repeat(STRIPE_METADATA_MAX_VALUE_LENGTH + 1);
    const encoded = encodeDraftToMetadata(draft({ description: tooLong }), "team");

    expect(encoded.ok).toBe(false);
    if (encoded.ok) throw new Error("unreachable");
    expect(encoded.errors.some((e) => e.field === "description")).toBe(true);
    // The specific failure this prevents: a successful payment whose
    // metadata was silently truncated, leaving a charge we cannot turn
    // into a competition.
    expect(encoded.errors[0].message).toMatch(/at most 500/);
  });

  it("accepts a description exactly at the limit — the boundary is inclusive", () => {
    const atLimit = "x".repeat(STRIPE_METADATA_MAX_VALUE_LENGTH);
    expect(encodeDraftToMetadata(draft({ description: atLimit }), "team").ok).toBe(true);
  });

  it("reports every problem at once, not just the first", () => {
    const encoded = encodeDraftToMetadata(draft({ name: "", timeZone: "", durationDays: 0 }), "team");
    if (encoded.ok) throw new Error("unreachable");
    const fields = encoded.errors.map((e) => e.field);
    expect(fields).toContain("name");
    expect(fields).toContain("timeZone");
    expect(fields).toContain("durationDays");
  });

  it.each([
    ["a non-integer duration", { durationDays: 2.5 }],
    ["a zero duration", { durationDays: 0 }],
    ["a negative duration", { durationDays: -3 }],
    ["an unparseable start time", { startTimeIso: "next tuesday" }],
    ["a missing org", { orgId: "  " }],
  ])("rejects %s", (_label, overrides) => {
    expect(encodeDraftToMetadata(draft(overrides as Partial<CompetitionDraft>), "team").ok).toBe(false);
  });
});

describe("decode refuses to half-use a bad session", () => {
  it("rejects metadata that is absent entirely", () => {
    const decoded = decodeDraftFromMetadata(undefined);
    expect(decoded.ok).toBe(false);
    if (decoded.ok) throw new Error("unreachable");
    expect(decoded.reason).toMatch(/no metadata/);
  });

  it("names every missing field rather than failing on the first", () => {
    const decoded = decodeDraftFromMetadata({ comp_draftId: "draft_abc" });
    if (decoded.ok) throw new Error("unreachable");
    expect(decoded.reason).toMatch(/orgId/);
    expect(decoded.reason).toMatch(/name/);
    expect(decoded.reason).toMatch(/priceBand/);
  });

  it("rejects a price band this build does not know", () => {
    const encoded = encodeDraftToMetadata(draft(), "team");
    if (!encoded.ok) throw new Error("unreachable");
    const decoded = decodeDraftFromMetadata({ ...encoded.metadata, comp_priceBand: "platinum" });
    expect(decoded.ok).toBe(false);
    if (decoded.ok) throw new Error("unreachable");
    expect(decoded.reason).toMatch(/unknown price band/);
  });

  it("rejects a duration that is not a positive whole number of days", () => {
    const encoded = encodeDraftToMetadata(draft(), "team");
    if (!encoded.ok) throw new Error("unreachable");
    for (const bad of ["0", "-1", "3.5", "seven", ""]) {
      expect(decodeDraftFromMetadata({ ...encoded.metadata, comp_durationDays: bad }).ok).toBe(false);
    }
  });

  it("treats a whitespace-only value as absent, not as a valid empty name", () => {
    const encoded = encodeDraftToMetadata(draft(), "team");
    if (!encoded.ok) throw new Error("unreachable");
    const decoded = decodeDraftFromMetadata({ ...encoded.metadata, comp_name: "   " });
    expect(decoded.ok).toBe(false);
  });
});
