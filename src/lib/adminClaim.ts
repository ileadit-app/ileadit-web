import { getFirebaseAuth } from "./firebase";

/**
 * Client-side mirror of the engine's admin check
 * (`admin-web/firestore.rules`, `hasAdminClaim()`: `request.auth.token.admin
 * == true`, ileadit engine repo c91f9e3). This helper is for UI gating only
 * ("should this page render the admin-only competition-create form") - the
 * Firestore rules and the `ensureAccount`/future callables are the actual
 * enforcement; nothing here should ever be treated as a security boundary
 * on its own.
 *
 * There is no `isAdmin` Firestore field any more (removed from the data
 * model entirely, see CLAUDE.md's Firestore Collections section) - admin
 * identity is a custom Firebase Auth claim, set out-of-band by a one-off
 * script, never something this repo can grant or read from a document.
 *
 * Forces `getIdTokenResult(true)` — a real token refresh, not the cached
 * token — per the engine cutover checklist's Step 6: "Custom claims reach a
 * client only on token refresh... sign out and back in... before expecting
 * the claim to work." A web session can stay signed in for a long time with
 * no natural sign-out/sign-in cycle, so a claim granted mid-session would
 * otherwise stay invisible to this client until its cached ID token happens
 * to expire on its own (up to an hour) - forcing the refresh here trades one
 * extra network round trip for correctness every time this is called.
 */
async function getForcedRefreshClaims(): Promise<Record<string, unknown> | null> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;

  const tokenResult = await user.getIdTokenResult(/* forceRefresh */ true);
  return tokenResult.claims;
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const claims = await getForcedRefreshClaims();
  return claims?.admin === true;
}

/**
 * The capability claim key for "can this user create a competition",
 * per Paul's 2026-09-20 decision (automation-hub/docs/ileadit-web-accounts-
 * BA-20260920.md, "WHO THE WEBSITE IS FOR" → "only org admins and ileadit
 * admins may create competitions" → "Proposed bridge... a capability claim,
 * not an org", since no organisation entity exists yet). That doc records
 * the DECISION but never names the actual claim key, and Ivor's server-side
 * gate on the `createCompetition` callable (P1.3) is being built in
 * parallel with this file, not read from first. **`competitionCreator` is
 * this agent's choice, not a confirmed contract** — if Ivor's callable ends
 * up checking a differently-named claim, this is the one constant to
 * update; nothing else in this module or its callers needs to change.
 */
const COMPETITION_CREATOR_CLAIM_KEY = "competitionCreator";

/**
 * "Can this signed-in user create a competition?" — true for the ileadit
 * admin claim OR the capability claim above. UI GATING ONLY, same caveat as
 * `isCurrentUserAdmin()` above: this decides whether `/competitions/new`
 * renders a form or a refusal, never whether the create actually succeeds.
 * The `createCompetition` callable re-checks this server-side (or will,
 * once Ivor's authorisation follow-up lands — see the P1.4 ticket) and a
 * user who reaches the form without either claim will still be refused
 * there.
 */
export async function canCreateCompetitions(): Promise<boolean> {
  const claims = await getForcedRefreshClaims();
  if (!claims) return false;
  return claims.admin === true || claims[COMPETITION_CREATOR_CLAIM_KEY] === true;
}
