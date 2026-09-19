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
export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return false;

  const tokenResult = await user.getIdTokenResult(/* forceRefresh */ true);
  return tokenResult.claims.admin === true;
}
