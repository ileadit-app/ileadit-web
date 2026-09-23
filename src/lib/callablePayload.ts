/**
 * `compactPayload` — strips `undefined`- and `null`-valued keys from a
 * Cloud Functions callable request body before it reaches `httpsCallable`.
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
 * CALLABLE-NULL-1 (2026-09-23, follow-up to Quinn's second-opinion review of
 * the fix above): a caller can also hand this a genuine, literal runtime
 * `null` — TypeScript's static types can rule that out for a well-typed
 * call site, but nothing sanitises actual runtime data (a value read from a
 * form, a parsed query string, or any other untyped source can still be
 * `null` even when the type says `string | undefined`). None of this
 * codebase's callable request schemas are `.nullable()` — every optional
 * field is a plain zod `.optional()`, which rejects an explicit `null` the
 * exact same way it rejects the undefined-serializes-to-`null` case above.
 * So `compactPayload` strips BOTH `undefined` and `null`-valued keys, not
 * just `undefined`.
 *
 * Every callable wrapper in `src/lib` that has ANY optional request field
 * must build its request body through this helper (`createInvite` in
 * `invites.ts`, `createCompetition` in `createCompetition.ts` — see each
 * file's own comment) rather than ever assigning `undefined`/`null`
 * directly to a key that then travels to `httpsCallable` unmodified.
 *
 * `compactPayload` removes keys whose value is `undefined` OR `null` — both
 * are "this field is absent" signals to an engine `.optional()` schema. It
 * must NEVER strip a legitimate falsy value a caller genuinely means to
 * send — `false`, `0`, and `""` are all preserved as-is.
 *
 * Shallow only: this inspects TOP-LEVEL keys of a flat object only. Every
 * caller in this codebase passes a flat request body — nested objects or
 * arrays as VALUES are passed through untouched, not recursed into.
 * Nested/array support is out of scope; add it only if a future callable
 * genuinely needs it.
 *
 * The parameter type deliberately excludes arrays (`NotArray<T>` below) —
 * without that, passing an array by mistake would silently be treated as a
 * plain object with numeric-string keys (`{"0": ..., "1": ...}`), which is
 * never a valid callable request body.
 */
type NotArray<T> = T extends readonly unknown[] ? never : T;

export function compactPayload<T extends object>(payload: NotArray<T>): T {
  const input = payload as T;
  const result = {} as T;
  (Object.keys(input) as Array<keyof T>).forEach((key) => {
    const value = input[key];
    if (value !== undefined && value !== null) {
      result[key] = value;
    }
  });
  return result;
}
