/**
 * Shared types, constants, copy, pure validation and defensive parsers for
 * competition prizes (PRZ-W1, 27 Oct 2026 — see
 * `.ticket-refs/prizes/ileadit-prizes-spec-20261027.md` §3.1/§3.2/§4.3).
 *
 * **Phase 1 only.** The engine's real `PrizeKind` enum is
 * `forfeit | perk | code | physical` (spec §3.1) — this portal build only
 * offers `forfeit`/`perk` to organisers (spec §8, PRZ-W1 scope: "digital
 * codes + physical opt-in" is Phase 2, PRZ-W2, not built here). `code`/
 * `physical` are listed in `PrizeKind` below only so a value READ from
 * Firestore that already has one of them (impossible today, since nothing
 * writes them yet, but not a type error if the engine ships Phase 2 before
 * this file is revisited) still parses instead of silently becoming `null`.
 * The create/edit FORM (`PrizeSection.tsx`) only ever offers `forfeit`/
 * `perk` as choices — never render a `code`/`physical` option there.
 *
 * **Engine verification status**: PRZ-E1/E2 (the engine side of this spec)
 * had not shipped source this agent could read as of 2026-10-27 — this
 * module is built strictly from the spec document's §3/§4 field list, the
 * same "unverified, flagged not hidden" discipline `createCompetition.ts`
 * already uses for the (also still-undeployed) `createCompetition`
 * callable. Re-derive every field name/type here against the engine's real
 * source the moment it's readable.
 */

export type PrizeKind = "forfeit" | "perk" | "code" | "physical";

/** The only two kinds this portal's UI offers an organiser today. */
export const SUPPORTED_PRIZE_KINDS: readonly PrizeKind[] = ["forfeit", "perk"];

export type PrizePlaces = 1 | 3;

export interface PrizeItem {
  place: 1 | 2 | 3;
  title: string;
  description: string;
}

export interface Prize {
  kind: PrizeKind;
  places: PrizePlaces;
  items: PrizeItem[];
  /** Forfeit-only, optional (spec §3.1: "for forfeits that bind the last
   * place"). `null`/absent for every other kind. */
  forfeitLoserText: string | null;
  /** D9: optional "winner must be 18 or over", enforced server-side against
   * the player's age record — this checkbox is a request, not an
   * enforcement mechanism in itself. */
  adultOnly: boolean;
}

/** Engine-written only (spec §3.1) — never sent by this portal in a create
 * or update request. */
export type PrizeState = "none" | "pending" | "suddenDeath" | "checking" | "ready" | "closed";

export const KNOWN_PRIZE_STATES: readonly PrizeState[] = [
  "none",
  "pending",
  "suddenDeath",
  "checking",
  "ready",
  "closed",
];

/** Engine-written only. Notably has NO `points` field (spec §3.1) — see
 * `OrganiserPrizePanel.tsx`'s header comment for how this portal resolves
 * that gap when showing a winner's score. */
export interface PrizeWinner {
  place: number;
  uid: string;
  displayName: string | null;
  method: "points" | "suddenDeath" | "shared" | "draw";
}

/* ------------------------------------------------------------------ *
 * Limits — mirrored from the ticket brief's contract limits, same
 * "mirrored, not invented" discipline as `NAME_MAX_LENGTH` in
 * `CreateCompetitionForm.tsx`. Re-check against the engine's real zod
 * schema (spec §4.1: "accept `prize` (zod, strict)") once it's readable.
 * ------------------------------------------------------------------ */
export const PRIZE_TITLE_MAX_LENGTH = 60;
export const PRIZE_DESCRIPTION_MAX_LENGTH = 200;
export const FORFEIT_LOSER_TEXT_MAX_LENGTH = 80;

/** The approved design's counter suffix on every prize-name field (PRZ-W1-FIX2,
 * `.ticket-refs/prizes/v0-web/components/competitions/PrizeSection.tsx:137`)
 * — one shared string so the single-winner field and all three top-3 fields
 * can never drift to different wording. */
export const PRIZE_NAME_SHOWN_HINT = "shown to players on the competition page";

export const FREE_TO_ENTER_LINE = "Free to enter. Always.";

/* ------------------------------------------------------------------ *
 * Form state — the shape `PrizeSection.tsx` edits, shared by the create
 * form (`CreateCompetitionForm.tsx`) and the scheduled-competition editor
 * (`PrizeEditPanel.tsx`), per the WEB-CREATE-GUARD-style discipline
 * (constants+copy / pure checks / timing left to the caller) already used
 * in this codebase for `createCompetitionGuard.ts`.
 * ------------------------------------------------------------------ */

export interface PrizeFormState {
  enabled: boolean;
  kind: PrizeKind;
  places: PrizePlaces;
  /** Always exactly `places` entries, place-ordered — `placesOptions`
   * below is the only place that resizes this array. */
  items: PrizeItem[];
  forfeitLoserText: string;
  adultOnly: boolean;
}

export const EMPTY_PRIZE_ITEM: PrizeItem = { place: 1, title: "", description: "" };

export const EMPTY_PRIZE_FORM_STATE: PrizeFormState = {
  enabled: false,
  kind: "forfeit",
  places: 1,
  items: [{ place: 1, title: "", description: "" }],
  forfeitLoserText: "",
  adultOnly: false,
};

/** Resizes `items` to match a newly chosen `places` value, preserving
 * whatever was already typed for places that survive the change (1 → 3
 * keeps place 1's text and adds blank places 2/3; 3 → 1 keeps only place
 * 1's text). Never silently drops place 1's typed text, which is the one
 * place that matters in both directions. */
export function resizePrizeItems(items: PrizeItem[], places: PrizePlaces): PrizeItem[] {
  if (places === 1) {
    return [items[0] ?? { ...EMPTY_PRIZE_ITEM, place: 1 }];
  }
  const byPlace = new Map(items.map((item) => [item.place, item]));
  return [1, 2, 3].map(
    (place) => byPlace.get(place as 1 | 2 | 3) ?? { place: place as 1 | 2 | 3, title: "", description: "" },
  );
}

export function prizeFormStateFromPrize(prize: Prize | null): PrizeFormState {
  if (!prize) return { ...EMPTY_PRIZE_FORM_STATE, items: [{ ...EMPTY_PRIZE_ITEM }] };
  return {
    enabled: true,
    kind: prize.kind,
    places: prize.places,
    items: resizePrizeItems(prize.items, prize.places),
    forfeitLoserText: prize.forfeitLoserText ?? "",
    adultOnly: prize.adultOnly,
  };
}

/* ------------------------------------------------------------------ *
 * Validation — pure, synchronous, no I/O. Called fresh at submit time by
 * the caller, same discipline as `createCompetitionGuard.ts`'s checks.
 * ------------------------------------------------------------------ */

export interface PrizeItemFieldErrors {
  title?: string;
  description?: string;
}

export interface PrizeFieldErrors {
  items?: Partial<Record<1 | 2 | 3, PrizeItemFieldErrors>>;
  forfeitLoserText?: string;
}

export function validatePrizeForm(state: PrizeFormState): PrizeFieldErrors {
  if (!state.enabled) return {};

  const errors: PrizeFieldErrors = {};
  const itemErrors: Partial<Record<1 | 2 | 3, PrizeItemFieldErrors>> = {};

  for (const item of state.items.slice(0, state.places)) {
    const itemError: PrizeItemFieldErrors = {};
    const title = item.title.trim();
    // Only place 1 is required (approved design, PRZ-W1-FIX1: the 2nd/3rd
    // place name fields in the top-3 layout are explicitly optional,
    // placeholder "Optional") — a place-2/3 title is only checked for
    // length, never required.
    if (item.place === 1 && !title) {
      itemError.title = "Give this place a prize title.";
    } else if (title.length > PRIZE_TITLE_MAX_LENGTH) {
      itemError.title = `Keep it under ${PRIZE_TITLE_MAX_LENGTH} characters.`;
    }
    if (item.description.trim().length > PRIZE_DESCRIPTION_MAX_LENGTH) {
      itemError.description = `Keep it under ${PRIZE_DESCRIPTION_MAX_LENGTH} characters.`;
    }
    if (Object.keys(itemError).length > 0) {
      itemErrors[item.place] = itemError;
    }
  }

  if (Object.keys(itemErrors).length > 0) {
    errors.items = itemErrors;
  }

  // forfeitLoserText is no longer a directly-edited field (PRZ-W1-FIX1 —
  // see PrizeSection.tsx's header comment); it is derived from the place-1
  // title, which is already validated for length above via
  // PRIZE_TITLE_MAX_LENGTH (60, stricter than FORFEIT_LOSER_TEXT_MAX_LENGTH's
  // 80), so no separate check is needed here. The constant stays exported
  // for `prizeFormStateFromPrize`'s round-trip of a prize loaded from an
  // older record that may still carry a distinct value.

  return errors;
}

export function prizeFormHasErrors(errors: PrizeFieldErrors): boolean {
  return Boolean(errors.forfeitLoserText) || Boolean(errors.items && Object.keys(errors.items).length > 0);
}

/** Builds the engine-shape `Prize` object from form state, or `undefined`
 * when the prize toggle is off — `undefined` (not `null`) so the caller can
 * spread-omit the field entirely from a create/update request body, same
 * convention `createCompetition.ts` already uses for every optional field
 * (`...(input.description ? {...} : {})`). */
export function prizeInputFromFormState(state: PrizeFormState): Prize | undefined {
  if (!state.enabled) return undefined;

  const items = state.items.slice(0, state.places).map((item) => ({
    place: item.place,
    title: item.title.trim(),
    description: item.description.trim(),
  }));

  // forfeitLoserText has no field of its own in the approved design
  // (PRZ-W1-FIX1) — the place-1 "Prize name" field doubles as the forfeit's
  // description for a bragging-rights prize, so it's derived from that
  // item's title rather than edited separately.
  const place1Title = items.find((item) => item.place === 1)?.title ?? "";

  return {
    kind: state.kind,
    places: state.places,
    items,
    forfeitLoserText: state.kind === "forfeit" && place1Title ? place1Title : null,
    adultOnly: state.adultOnly,
  };
}

/* ------------------------------------------------------------------ *
 * Display formatting
 * ------------------------------------------------------------------ */

/** The one-line gold chip shown on a dashboard card (W7) — "Win: X" for a
 * perk, "Forfeit: X" for a forfeit (using the loser text if one was given,
 * else the place-1 item's own title). `null` when there's no prize, or no
 * place-1 item to describe (shouldn't happen for a valid prize, but this is
 * display code and must never throw on a malformed/partial read). */
export function prizeLine(prize: Prize | null): string | null {
  if (!prize) return null;
  const first = prize.items.find((item) => item.place === 1) ?? prize.items[0];
  if (!first || !first.title) return null;

  if (prize.kind === "forfeit") {
    return `Forfeit: ${prize.forfeitLoserText || first.title}`;
  }
  if (prize.kind === "perk") {
    return `Win: ${first.title}`;
  }
  // code/physical — Phase 2, not built by this portal, but parses and
  // formats defensively rather than throwing if the engine ever writes one.
  return `Win: ${first.title}`;
}

/* ------------------------------------------------------------------ *
 * Defensive parsers — same discipline as every other Firestore read in
 * this codebase (`typeof data.x === "..." ? data.x : null`), reused by
 * `competitionDetail.ts` and `competitions.ts` so the parsing rule lives
 * in exactly one place.
 * ------------------------------------------------------------------ */

function asPrizeKind(value: unknown): PrizeKind | null {
  return value === "forfeit" || value === "perk" || value === "code" || value === "physical"
    ? value
    : null;
}

function asPrizePlaces(value: unknown): PrizePlaces | null {
  return value === 1 || value === 3 ? value : null;
}

function asPrizeItem(value: unknown): PrizeItem | null {
  if (typeof value !== "object" || value === null) return null;
  const data = value as Record<string, unknown>;
  const place = data.place;
  if (place !== 1 && place !== 2 && place !== 3) return null;
  return {
    place,
    title: typeof data.title === "string" ? data.title : "",
    description: typeof data.description === "string" ? data.description : "",
  };
}

export function parsePrizeField(value: unknown): Prize | null {
  if (typeof value !== "object" || value === null) return null;
  const data = value as Record<string, unknown>;

  const kind = asPrizeKind(data.kind);
  const places = asPrizePlaces(data.places);
  if (!kind || !places) return null;

  const items = Array.isArray(data.items)
    ? data.items.map(asPrizeItem).filter((item): item is PrizeItem => item !== null)
    : [];

  return {
    kind,
    places,
    items,
    forfeitLoserText: typeof data.forfeitLoserText === "string" ? data.forfeitLoserText : null,
    adultOnly: data.adultOnly === true,
  };
}

export function parsePrizeState(value: unknown): PrizeState | null {
  return typeof value === "string" && (KNOWN_PRIZE_STATES as readonly string[]).includes(value)
    ? (value as PrizeState)
    : null;
}

function asPrizeWinnerMethod(value: unknown): PrizeWinner["method"] {
  return value === "points" || value === "suddenDeath" || value === "shared" || value === "draw"
    ? value
    : "points";
}

export function parsePrizeWinners(value: unknown): PrizeWinner[] {
  if (!Array.isArray(value)) return [];
  const winners: PrizeWinner[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const data = entry as Record<string, unknown>;
    if (typeof data.place !== "number" || typeof data.uid !== "string") continue;
    winners.push({
      place: data.place,
      uid: data.uid,
      displayName: typeof data.displayName === "string" ? data.displayName : null,
      method: asPrizeWinnerMethod(data.method),
    });
  }
  return winners;
}
