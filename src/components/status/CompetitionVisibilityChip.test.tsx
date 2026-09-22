import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompetitionVisibilityChip, resolveCompetitionVisibility } from "./CompetitionVisibilityChip";

/**
 * Pins `CompetitionVisibilityChip`/`resolveCompetitionVisibility` (PC-9) —
 * the shared visibility renderer used on the dashboard cards and the
 * competition detail page. The most important fact this file pins is the
 * legacy default: a competition document that predates the `visibility`
 * field (`null`) must resolve to `"public"`, never to an "unknown" state and
 * never to `"private"` — see the contract note (e) in
 * `resolveCompetitionVisibility`'s own doc comment.
 *
 * `src/components/invite/InviteCodeLanding.tsx`'s own preview surface does
 * NOT go through `resolveCompetitionVisibility` at all (PC-9 contract
 * correction (d): `previewInvite`'s `visibility` is optional with different
 * "render nothing if absent" semantics) — that behaviour is pinned directly
 * in `InviteCodeLanding.test.tsx`, not here.
 */

describe("resolveCompetitionVisibility", () => {
  it("PC-9-CHIP-1: null (a document that predates the field) resolves to public, the legacy default", () => {
    expect(resolveCompetitionVisibility(null)).toBe("public");
  });

  it("PC-9-CHIP-2: \"private\" and \"public\" pass through unchanged", () => {
    expect(resolveCompetitionVisibility("private")).toBe("private");
    expect(resolveCompetitionVisibility("public")).toBe("public");
  });
});

describe("CompetitionVisibilityChip", () => {
  it("PC-9-CHIP-3: renders the Public label with a Globe icon (non-colour signal), not just a tinted fill", () => {
    const { container } = render(<CompetitionVisibilityChip visibility="public" />);
    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("PC-9-CHIP-4: renders the Private label with an opaque navy fill, distinct from the Public chip's outline treatment", () => {
    render(<CompetitionVisibilityChip visibility="private" />);
    const chip = screen.getByText("Private").closest("span");
    expect(chip?.className).toContain("bg-brand-navy");
    expect(chip?.className).toContain("text-on-navy-foreground");
  });

  it("PC-9-CHIP-5: Public and Private render visibly different label text, never the same word", () => {
    const { rerender } = render(<CompetitionVisibilityChip visibility="public" />);
    expect(screen.queryByText("Private")).not.toBeInTheDocument();
    rerender(<CompetitionVisibilityChip visibility="private" />);
    expect(screen.queryByText("Public")).not.toBeInTheDocument();
  });
});
