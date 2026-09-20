import type { CompetitionDraft } from "./competitionDraft";
import { isPriceBandId, type PriceBandId } from "./priceBands";

/**
 * THE SEAM between this repo's payment side and the engine's org/billing
 * side. Everything this branch needs from the org model goes through the
 * two operations below and nothing else.
 *
 * WHY A PORT AND NOT A FIRESTORE CALL. Two hard constraints, both already
 * written down in this repo, make a direct write impossible and a direct
 * read useless:
 *
 *  1. `src/lib/repoGuards.test.ts`, Guard 4 — the web portal never writes
 *     Firestore game state directly; every mutation goes through an engine
 *     callable. A webhook that wrote a competition document itself would
 *     fail that guard, and rightly.
 *  2. There is no `firebase-admin` in this repo's dependencies, and a
 *     webhook has no signed-in user. The client Firebase SDK cannot write
 *     as a trusted server, so even without Guard 4 there is nothing here
 *     that could legitimately write.
 *
 * So the engine does the work and this module asks it to. That also keeps
 * the SECURITY BOUNDARY where the rest of this codebase already puts it:
 * `src/lib/adminClaim.ts` is explicit that client-side capability checks
 * are "UI GATING ONLY... the callable is the security boundary". The same
 * applies here — `fetchBillingOrg()` forwards the CALLER'S Firebase ID
 * token and the engine decides whether that caller may bill that org. This
 * route does not invent a role model, and must not.
 *
 * ── DEPENDENCY ON `feat/org-model` (the other agent's branch) ────────────
 * Neither endpoint exists yet. The shapes below are the MINIMUM this branch
 * needs, defined here rather than guessed into a competing org model. Three
 * things must line up when that branch lands, and all three are cheap to
 * change here and nowhere else:
 *
 *   A. `BillingOrg.priceBand` must be one of `PriceBandId`
 *      (`free` | `team` | `company` | `enterprise`). If the org model names
 *      its bands differently, map them in `parseBillingOrg()` below — do
 *      not rename the bands in `priceBands.ts`, which is tied to
 *      `RULES.md` §8.2.
 *   B. `recordPaidCompetition()` must be IDEMPOTENT ON `billingEventId`:
 *      called twice with the same id it must create exactly one
 *      competition, charge-record once, and return the SAME
 *      `competitionId` both times, with `status: "duplicate"` on the
 *      second. This is the single most important property in this whole
 *      branch; see `fulfilCheckout.ts`.
 *   C. The engine must create the competition and record the billable
 *      event in ONE operation. Paul's Q5 decision says the competition IS
 *      the billable event ("the unit of billing and the unit of data are
 *      the same object. There is no separate entitlement ledger to
 *      reconcile") — two calls would reintroduce exactly the reconciliation
 *      that decision removed.
 */

/**
 * The minimum org shape the payment side needs. Deliberately NOT a
 * complete org model — no members, no roles, no name-and-address. If a
 * field is not needed to decide a price or to charge a customer, it does
 * not belong here.
 */
export interface BillingOrg {
  id: string;
  /** For the Checkout line item and the receipt. */
  name: string;
  /** The org's band. AUTHORITATIVE at charge time — never recomputed from
   * a headcount by this repo. See `priceBands.ts`'s `bandForEmployeeCount`. */
  priceBand: PriceBandId;
  /**
   * The org's Stripe customer, or `null` if it has never been charged.
   * `null` is handled (Checkout creates a customer) rather than treated as
   * an error, so the first-ever competition for an org works.
   */
  stripeCustomerId: string | null;
}

export interface PaidCompetitionRecord {
  /**
   * The idempotency key. The Stripe Checkout Session id — see
   * `fulfilCheckout.ts` for why it is the session and not the event.
   */
  billingEventId: string;
  orgId: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  /** What was actually charged, in pence — read back off the paid Stripe
   * session, never recomputed from the band at fulfilment time. If the
   * price table changed between checkout and webhook, the customer paid the
   * old price and that is what gets recorded. */
  amountPaidPence: number;
  currency: string;
  priceBand: PriceBandId;
  draft: CompetitionDraft;
}

export type RecordPaidCompetitionOutcome =
  | { status: "recorded"; competitionId: string | null }
  | { status: "duplicate"; competitionId: string | null };

export type EngineBillingErrorKind =
  /** No engine URL/token configured. Not the customer's fault; retryable
   * once someone sets the env. */
  | "not-configured"
  /** Caller may not act for this org, or the token is bad. Terminal. */
  | "unauthorised"
  /** No such org. Terminal for checkout; for fulfilment it is a real
   * problem needing a human, because money has already moved. */
  | "not-found"
  /** Network blip, 5xx, timeout. Retryable. */
  | "transient"
  /** The engine answered, but not with anything this code recognises.
   * Terminal — retrying will not change the shape of the reply. */
  | "invalid-response";

export class EngineBillingError extends Error {
  readonly kind: EngineBillingErrorKind;
  readonly cause: unknown;

  constructor(kind: EngineBillingErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = "EngineBillingError";
    this.kind = kind;
    this.cause = cause;
  }

  /** True when Stripe should be told to retry (webhook returns 5xx). */
  get retryable(): boolean {
    return this.kind === "transient" || this.kind === "not-configured";
  }
}

export interface EngineBillingClient {
  /**
   * @param callerIdToken the signed-in user's Firebase ID token. The ENGINE
   * verifies it and decides whether this caller may bill this org; this
   * repo never decodes it.
   */
  fetchBillingOrg(orgId: string, callerIdToken: string): Promise<BillingOrg>;

  /** Must be idempotent on `record.billingEventId` — see point B above. */
  recordPaidCompetition(record: PaidCompetitionRecord): Promise<RecordPaidCompetitionOutcome>;
}

/* ------------------------------------------------------------------ *
 * HTTP adapter
 * ------------------------------------------------------------------ */

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new EngineBillingError(
      "not-configured",
      `${name} is not set. The engine's billing endpoints are how this repo reads an org's price ` +
        `band and records a paid competition; without them a payment cannot be turned into a ` +
        `competition. See src/lib/billing/engineBilling.ts.`,
    );
  }
  return value;
}

function parseBillingOrg(body: unknown, orgId: string): BillingOrg {
  if (typeof body !== "object" || body === null) {
    throw new EngineBillingError("invalid-response", `engine returned a non-object for org ${orgId}`);
  }
  const raw = body as Record<string, unknown>;
  const org = (typeof raw.org === "object" && raw.org !== null ? raw.org : raw) as Record<string, unknown>;

  const priceBand = org.priceBand;
  // Point A above: if `feat/org-model` names its bands differently, the
  // translation belongs right here and nowhere else.
  if (typeof priceBand !== "string") {
    throw new EngineBillingError("invalid-response", `engine returned no priceBand for org ${orgId}`);
  }

  if (!isPriceBandId(priceBand)) {
    throw new EngineBillingError(
      "invalid-response",
      `engine returned price band "${priceBand}" for org ${orgId}, which this repo does not know. ` +
        `Known bands: see PRICE_BANDS in src/lib/billing/priceBands.ts.`,
    );
  }

  const stripeCustomerId = org.stripeCustomerId;

  return {
    id: typeof org.id === "string" ? org.id : orgId,
    name: typeof org.name === "string" ? org.name : orgId,
    priceBand,
    stripeCustomerId: typeof stripeCustomerId === "string" && stripeCustomerId ? stripeCustomerId : null,
  };
}

function errorKindForStatus(status: number): EngineBillingErrorKind {
  if (status === 401 || status === 403) return "unauthorised";
  if (status === 404) return "not-found";
  if (status >= 500 || status === 429) return "transient";
  return "invalid-response";
}

export function createHttpEngineBillingClient(): EngineBillingClient {
  const base = () => requiredEnv("ILEADIT_ENGINE_BILLING_URL").replace(/\/+$/, "");
  const serviceToken = () => requiredEnv("ILEADIT_ENGINE_BILLING_TOKEN");

  async function send(path: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${base()}${path}`, init);
    } catch (error) {
      // A network failure is retryable; do not let it look like a refusal.
      throw new EngineBillingError("transient", `engine request to ${path} failed`, error);
    }

    const text = await response.text();
    if (!response.ok) {
      throw new EngineBillingError(
        errorKindForStatus(response.status),
        `engine ${path} returned ${response.status}: ${text.slice(0, 300)}`,
      );
    }

    try {
      return text ? JSON.parse(text) : {};
    } catch (error) {
      throw new EngineBillingError("invalid-response", `engine ${path} returned unparseable JSON`, error);
    }
  }

  return {
    async fetchBillingOrg(orgId, callerIdToken) {
      const body = await send(`/billingOrg/${encodeURIComponent(orgId)}`, {
        method: "GET",
        headers: {
          // The END USER's identity — the engine authorises against this.
          Authorization: `Bearer ${callerIdToken}`,
          // Proof the call came from this service at all.
          "X-Ileadit-Service-Token": serviceToken(),
        },
      });
      return parseBillingOrg(body, orgId);
    },

    async recordPaidCompetition(record) {
      const body = await send("/recordPaidCompetition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Ileadit-Service-Token": serviceToken(),
          // Belt and braces: even if the engine's own dedupe were to fail,
          // this header gives it a second, standard place to notice a
          // replay. It carries the SAME key as `record.billingEventId`.
          "Idempotency-Key": record.billingEventId,
        },
        body: JSON.stringify(record),
      });

      if (typeof body !== "object" || body === null) {
        throw new EngineBillingError("invalid-response", "engine recordPaidCompetition returned a non-object");
      }
      const raw = body as Record<string, unknown>;
      const competitionId = typeof raw.competitionId === "string" ? raw.competitionId : null;

      // `duplicate` must be an EXPLICIT statement from the engine, never
      // inferred from a missing field — inferring it would let a genuine
      // failure masquerade as a successful replay.
      const status = raw.status === "duplicate" ? "duplicate" : raw.status === "recorded" ? "recorded" : null;
      if (status === null) {
        throw new EngineBillingError(
          "invalid-response",
          `engine recordPaidCompetition returned status ${JSON.stringify(raw.status)}; ` +
            `expected "recorded" or "duplicate"`,
        );
      }

      return { status, competitionId };
    },
  };
}
