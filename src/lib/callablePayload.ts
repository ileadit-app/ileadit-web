/**
 * `compactPayload` — strips `undefined`-valued keys from a Cloud Functions
 * callable request body before it reaches `httpsCallable`.
 *
 * THE BUG THIS FIXES (found in the PC-9 pre-flight, also live on production
 * `main` at commit `7f76770` as of 2026-09-23): creating an invite link
 * WITHOUT a label failed with `functions/invalid-argument`, even though the
 * exact same flow WITH a label succeeded. Root cause:
 * `InvitePanel.tsx`'s `CreateInviteForm` called
 * `createInvite({ competitionId, label: undefined })` when the label field
 * was left empty. The Firebase web SDK's callable serializer encodes an
 * `undefined`-valued object property as JSON `null` on the wire — it does
 * NOT omit the key. The engine's request schema uses zod's
 * `.optional()` (e.g. `label: z.string().max(40).optional()`), which only
 * means "this key may be MISSING" — it does not accept `null`. So a request
 * built by assigning `undefined` to an optional key is rejected server-side,
 * while the identical request with the key left out entirely is accepted.
 *
 * Every callable wrapper in `src/lib` that has ANY optional request field
 * must build its request body through this helper (`createInvite` in
 * `invites.ts`, `createCompetition` in `createCompetition.ts` — see each
 * file's own comment) rather than ever assigning `undefined` directly to a
 * key that then travels to `httpsCallable` unmodified.
 *
 * `compactPayload` removes ONLY keys whose value is strictly `undefined`.
 * It must NEVER strip a legitimate falsy value a caller genuinely means to
 * send — `false`, `0`, `""`, and `null` are all preserved as-is. Stripping
 * `null` in particular would be wrong: some callable fields (none in this
 * codebase as of this writing, but the helper must stay correct for one)
 * could legitimately mean "explicitly clear this field" via a real `null`,
 * which is a different instruction to the engine than "field absent."
 */
export function compactPayload<T extends object>(payload: T): T {
  const result = {} as T;
  (Object.keys(payload) as Array<keyof T>).forEach((key) => {
    const value = payload[key];
    if (value !== undefined) {
      result[key] = value;
    }
  });
  return result;
}
