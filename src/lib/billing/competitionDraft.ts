import { isPriceBandId, type PriceBandId } from "./priceBands";

/**
 * The competition a customer is paying for, carried THROUGH the payment.
 *
 * This module exists because of the order-of-operations decision recorded
 * in `src/lib/billing/fulfilCheckout.ts`: **pay first, then create**. That
 * means at the moment the user is sent to Stripe, the competition does not
 * exist anywhere yet — so the intent to create it has to travel with the
 * payment and come back attached to the paid fact. Stripe Checkout Session
 * `metadata` is the standard place for that, and it is the only store in
 * this flow that is as durable as the payment itself.
 *
 * STRIPE'S METADATA LIMITS ARE REAL AND ARE ENFORCED HERE, NOT DISCOVERED
 * LATER: up to 50 keys, keys ≤ 40 characters, values ≤ 500 characters.
 * `encodeDraftToMetadata()` validates against those limits and REFUSES,
 * before a Checkout Session is created and therefore before any money
 * moves. Failing at checkout-creation time is the whole point: the
 * alternative is a successful payment whose metadata got silently
 * truncated, leaving a charge we cannot turn into a competition.
 */

export interface CompetitionDraft {
  /**
   * Caller-generated, stable for one user attempt. Used as the Stripe
   * idempotency key when creating the Checkout Session, so a double-click
   * or a retried POST reuses one session instead of creating two (and
   * therefore cannot produce two charges).
   *
   * NOT the key the fulfilment is idempotent on — that is the Checkout
   * Session id; see `fulfilCheckout.ts` for why.
   */
  draftId: string;
  /** Who is billed. Per Q3 of the org-model decisions, this is a BILLING
   * pointer, not an access-control one — `visibility` is a separate field
   * owned by the engine's competition model and is not decided here. */
  orgId: string;
  /** Firebase uid of the person who filled the form. The engine records
   * this as the competition's creator. */
  createdByUid: string;

  name: string;
  /** ISO 8601 instant. Same wire format `src/lib/createCompetition.ts`
   * already sends to the `createCompetition` callable — kept identical on
   * purpose so the engine has one format to parse, not two. */
  startTimeIso: string;
  durationDays: number;
  timeZone: string;

  description?: string;
  imageUrl?: string;
  backgroundImageUrl?: string;
}

/** Stripe's own limits, named rather than inlined as magic numbers. */
export const STRIPE_METADATA_MAX_KEYS = 50;
export const STRIPE_METADATA_MAX_KEY_LENGTH = 40;
export const STRIPE_METADATA_MAX_VALUE_LENGTH = 500;

/**
 * Prefix on every key this module writes, so the draft's fields can never
 * collide with metadata Stripe or a future feature puts on the same
 * session, and so `decodeDraftFromMetadata` can tell "this session carried
 * a draft" from "this session did not".
 */
const KEY_PREFIX = "comp_";

export type DraftEncodeResult =
  | { ok: true; metadata: Record<string, string> }
  | { ok: false; errors: DraftFieldError[] };

export interface DraftFieldError {
  /** The `CompetitionDraft` field, as the user would recognise it. */
  field: string;
  message: string;
}

function required(value: string | undefined, field: string, errors: DraftFieldError[]): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    errors.push({ field, message: `${field} is required.` });
  }
  return trimmed;
}

/**
 * Draft → Stripe metadata, or a list of everything wrong with it.
 *
 * Returns ALL the errors, not just the first, because this is the last
 * chance to tell the user about a problem before they are bounced to a
 * payment page — sending them back three times for three fields would be
 * a poor trade for three lines of code saved.
 */
export function encodeDraftToMetadata(draft: CompetitionDraft, priceBand: PriceBandId): DraftEncodeResult {
  const errors: DraftFieldError[] = [];

  const draftId = required(draft.draftId, "draftId", errors);
  const orgId = required(draft.orgId, "orgId", errors);
  const createdByUid = required(draft.createdByUid, "createdByUid", errors);
  const name = required(draft.name, "name", errors);
  const timeZone = required(draft.timeZone, "timeZone", errors);

  const startTimeIso = (draft.startTimeIso ?? "").trim();
  if (!startTimeIso) {
    errors.push({ field: "startTimeIso", message: "startTimeIso is required." });
  } else if (Number.isNaN(Date.parse(startTimeIso))) {
    errors.push({ field: "startTimeIso", message: "startTimeIso must be a parseable ISO 8601 instant." });
  }

  if (!Number.isInteger(draft.durationDays) || draft.durationDays <= 0) {
    errors.push({ field: "durationDays", message: "durationDays must be a whole number of days, at least 1." });
  }

  const metadata: Record<string, string> = {
    [`${KEY_PREFIX}draftId`]: draftId,
    [`${KEY_PREFIX}orgId`]: orgId,
    [`${KEY_PREFIX}createdByUid`]: createdByUid,
    [`${KEY_PREFIX}priceBand`]: priceBand,
    [`${KEY_PREFIX}name`]: name,
    [`${KEY_PREFIX}startTimeIso`]: startTimeIso,
    [`${KEY_PREFIX}durationDays`]: String(draft.durationDays),
    [`${KEY_PREFIX}timeZone`]: timeZone,
  };

  for (const [field, value] of [
    ["description", draft.description],
    ["imageUrl", draft.imageUrl],
    ["backgroundImageUrl", draft.backgroundImageUrl],
  ] as const) {
    const trimmed = (value ?? "").trim();
    if (trimmed) metadata[`${KEY_PREFIX}${field}`] = trimmed;
  }

  // Limit checks last, so a field that is both empty AND (impossibly) too
  // long reports the useful error rather than the pedantic one.
  for (const [key, value] of Object.entries(metadata)) {
    const field = key.slice(KEY_PREFIX.length);
    if (key.length > STRIPE_METADATA_MAX_KEY_LENGTH) {
      errors.push({ field, message: `Internal: metadata key "${key}" exceeds Stripe's ${STRIPE_METADATA_MAX_KEY_LENGTH}-character limit.` });
    }
    if (value.length > STRIPE_METADATA_MAX_VALUE_LENGTH) {
      errors.push({
        field,
        message:
          `${field} is ${value.length} characters; the payment record can carry at most ` +
          `${STRIPE_METADATA_MAX_VALUE_LENGTH}. Shorten it and try again.`,
      });
    }
  }

  if (Object.keys(metadata).length > STRIPE_METADATA_MAX_KEYS) {
    errors.push({
      field: "draft",
      message: `Internal: ${Object.keys(metadata).length} metadata keys exceeds Stripe's limit of ${STRIPE_METADATA_MAX_KEYS}.`,
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, metadata };
}

export type DraftDecodeResult =
  | { ok: true; draft: CompetitionDraft; priceBand: PriceBandId }
  | { ok: false; reason: string };

/**
 * Stripe metadata → draft, on the way back in from the webhook.
 *
 * Every value is re-validated rather than trusted. Metadata on a Stripe
 * object is not a signed payload — it is whatever was written to the
 * session, and by the time it comes back the code that wrote it may be an
 * older deploy with a different shape. A session whose metadata does not
 * decode is reported as such and NOT half-used.
 */
export function decodeDraftFromMetadata(metadata: Stripe$Metadata | null | undefined): DraftDecodeResult {
  if (!metadata) return { ok: false, reason: "session has no metadata" };

  const read = (field: string): string | undefined => {
    const value = metadata[`${KEY_PREFIX}${field}`];
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const draftId = read("draftId");
  const orgId = read("orgId");
  const createdByUid = read("createdByUid");
  const name = read("name");
  const startTimeIso = read("startTimeIso");
  const durationDaysRaw = read("durationDays");
  const timeZone = read("timeZone");
  const priceBandRaw = read("priceBand");

  const missing = (
    [
      ["draftId", draftId],
      ["orgId", orgId],
      ["createdByUid", createdByUid],
      ["name", name],
      ["startTimeIso", startTimeIso],
      ["durationDays", durationDaysRaw],
      ["timeZone", timeZone],
      ["priceBand", priceBandRaw],
    ] as const
  )
    .filter(([, value]) => value === undefined)
    .map(([field]) => field);

  if (missing.length > 0) {
    return { ok: false, reason: `session metadata is missing: ${missing.join(", ")}` };
  }

  if (!isPriceBandId(priceBandRaw)) {
    return { ok: false, reason: `session metadata has an unknown price band: "${priceBandRaw}"` };
  }

  const durationDays = Number(durationDaysRaw);
  if (!Number.isInteger(durationDays) || durationDays <= 0) {
    return { ok: false, reason: `session metadata has an invalid durationDays: "${durationDaysRaw}"` };
  }

  if (Number.isNaN(Date.parse(startTimeIso as string))) {
    return { ok: false, reason: `session metadata has an unparseable startTimeIso: "${startTimeIso}"` };
  }

  return {
    ok: true,
    priceBand: priceBandRaw,
    draft: {
      draftId: draftId as string,
      orgId: orgId as string,
      createdByUid: createdByUid as string,
      name: name as string,
      startTimeIso: startTimeIso as string,
      durationDays,
      timeZone: timeZone as string,
      ...(read("description") ? { description: read("description") } : {}),
      ...(read("imageUrl") ? { imageUrl: read("imageUrl") } : {}),
      ...(read("backgroundImageUrl") ? { backgroundImageUrl: read("backgroundImageUrl") } : {}),
    },
  };
}

/**
 * Stripe types metadata as `{ [name: string]: string }` on the way out but
 * `Stripe.Metadata | null` on the way in. Declared locally rather than
 * importing the Stripe SDK, so this module stays importable from a client
 * component that wants to validate a draft before submitting it.
 */
export type Stripe$Metadata = Record<string, string>;
