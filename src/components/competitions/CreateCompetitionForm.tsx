"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ErrorBanner } from "@/components/auth/formFields";
import { NumberField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { newDraftId, startCompetitionCheckout } from "@/lib/billing/checkoutClient";
import { createCompetition } from "@/lib/createCompetition";
import { createCompetitionFailureMessage } from "@/lib/createCompetitionErrors";
import {
  detectBrowserTimeZone,
  getTimeZoneOptions,
  isValidTimeZone,
  parseDateTimeLocalValue,
  zonedWallTimeToDate,
} from "@/lib/timeZones";

const NAME_MAX_LENGTH = 80; // firestore.rules:243 — mirrored, not invented.

interface FieldErrors {
  name?: string;
  startTime?: string;
  durationDays?: string;
  timeZone?: string;
}

/**
 * The competition creation form (P1.4). Only rendered once
 * `CreateCompetitionGate` has resolved the capability check to `"allowed"`
 * — see that component for the permission gate this form deliberately does
 * NOT duplicate.
 *
 * Fields sent match the `createCompetition` callable's contract exactly
 * (`src/lib/createCompetition.ts`): `name`, `startTime`, `durationDays`,
 * `timeZone`, `description`, `imageUrl`, `backgroundImageUrl`. Nothing
 * engine-derived (`startDate`, `endDate`, `status`, `playerCount`) is ever
 * collected as an input here — there is no field for any of them below.
 *
 * Client-side validation mirrors the server rules this agent could actually
 * read (`firestore.rules:243-246`: name ≤ 80 chars, `durationDays` a
 * positive integer, `startTime` required) so a user gets fast feedback for
 * the common mistakes — but it is NOT the real check. The callable
 * re-validates every one of these server-side, and end-to-end submission
 * is UNVERIFIED (Ivor's callable isn't deployed — see
 * `src/lib/createCompetition.ts`'s header comment). Client validation
 * failing closed here is a UX nicety, not a security or correctness
 * guarantee.
 *
 * ── BILLING (branch `feat/stripe-per-competition-billing`) ──────────────
 * When an `orgId` is supplied, submitting goes through
 * `startCompetitionCheckout()` instead of calling the engine directly: the
 * server prices the competition from that org's band and, if there is
 * anything to pay, sends the browser to Stripe. The competition is created
 * only after payment — see `src/lib/billing/fulfilCheckout.ts` for why that
 * order, and what happens when payment succeeds but creation fails.
 *
 * With NO `orgId` the behaviour is byte-for-byte what it was before:
 * straight to `createCompetition()`. That is today's real state — nothing
 * in this repo knows an org id yet, because the org model is being built on
 * the `feat/org-model` branch. This prop is the one wire to connect when it
 * lands; nothing else in this component changes.
 */
export function CreateCompetitionForm({ orgId }: { orgId?: string } = {}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [startTimeValue, setStartTimeValue] = useState("");
  const [durationDaysValue, setDurationDaysValue] = useState("7");
  const [timeZone, setTimeZone] = useState(() => detectBrowserTimeZone());
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Lazy initializer, not a plain call at render time and not a `useRef`
  // read during render (React's react-hooks/refs rule flags the latter) —
  // this list is static for the component's lifetime, so it only needs to
  // be computed once, on mount.
  const [timeZoneOptions] = useState(() => getTimeZoneOptions());

  function validate(): FieldErrors {
    const errors: FieldErrors = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      errors.name = "Give your competition a name.";
    } else if (trimmedName.length > NAME_MAX_LENGTH) {
      errors.name = `Keep it under ${NAME_MAX_LENGTH} characters.`;
    }

    const parts = parseDateTimeLocalValue(startTimeValue);
    if (!parts) {
      errors.startTime = "Choose when this competition starts.";
    }

    const durationDays = Number(durationDaysValue);
    if (!Number.isInteger(durationDays) || durationDays <= 0) {
      errors.durationDays = "Enter a whole number of days, at least 1.";
    }

    if (!timeZone || !isValidTimeZone(timeZone)) {
      errors.timeZone = "Choose a valid time zone.";
    }

    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPageError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const parts = parseDateTimeLocalValue(startTimeValue);
    if (!parts) return; // Unreachable — validate() above already caught this.

    setSubmitting(true);

    const startTime = zonedWallTimeToDate(parts, timeZone);

    if (orgId) {
      // Paid path. `startCompetitionCheckout` either redirects to Stripe
      // (and this component is gone before the promise settles) or tells us
      // there is nothing to pay, in which case we fall through to the same
      // direct create the free/no-org path uses.
      const checkout = await startCompetitionCheckout({
        orgId,
        draftId: newDraftId(),
        name: name.trim(),
        startTimeIso: startTime.toISOString(),
        durationDays: Number(durationDaysValue),
        timeZone,
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        backgroundImageUrl: backgroundImageUrl.trim() || undefined,
      });

      if (checkout.status === "redirecting") return; // Leaving the page.
      if (checkout.status !== "no-payment-required") {
        setSubmitting(false);
        setPageError(checkout.message);
        return;
      }
    }

    const outcome = await createCompetition({
      name: name.trim(),
      // Wall-clock time as typed, interpreted IN the chosen time zone (not
      // the browser's own zone) — see zonedWallTimeToDate's comment for why
      // this conversion exists at all. Computed once above so the paid and
      // unpaid paths can never disagree about the instant.
      startTime,
      durationDays: Number(durationDaysValue),
      timeZone,
      description: description.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      backgroundImageUrl: backgroundImageUrl.trim() || undefined,
    });
    setSubmitting(false);

    if (outcome.status === "failure") {
      setPageError(createCompetitionFailureMessage(outcome.failure));
      return;
    }

    // No `/competitions/[id]` detail page exists yet (see CLAUDE.md's page
    // list — aspirational, not built) — the dashboard is the one place a
    // freshly created competition is guaranteed to show up, even before the
    // engine's onCompetitionWritten trigger has derived status/dates
    // (CreatedCompetitions.tsx already renders a "Setting up…" badge for
    // exactly that transient state).
    router.push("/dashboard");
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      {pageError ? <ErrorBanner message={pageError} /> : null}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <TextField
          label="Competition name"
          value={name}
          onChange={(value) => setName(value.slice(0, NAME_MAX_LENGTH))}
          error={fieldErrors.name}
          helperText={`${name.length}/${NAME_MAX_LENGTH}`}
          disabled={submitting}
          required
          maxLength={NAME_MAX_LENGTH}
          placeholder="Marketing team step-off"
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Starts"
            type="datetime-local"
            value={startTimeValue}
            onChange={setStartTimeValue}
            error={fieldErrors.startTime}
            disabled={submitting}
            required
          />
          <NumberField
            label="Duration (days)"
            value={durationDaysValue}
            onChange={setDurationDaysValue}
            error={fieldErrors.durationDays}
            disabled={submitting}
            required
            min={1}
            step={1}
          />
        </div>

        <SelectField
          label="Time zone"
          value={timeZone}
          onChange={setTimeZone}
          error={fieldErrors.timeZone}
          helperText="Day boundaries (and who's 'today' leaderboard is who's) are worked out in this zone."
          disabled={submitting}
          required
          options={timeZoneOptions}
        />

        <TextAreaField
          label="Description (optional)"
          value={description}
          onChange={setDescription}
          disabled={submitting}
          placeholder="What's this competition for?"
        />

        <TextField
          label="Image URL (optional)"
          type="url"
          value={imageUrl}
          onChange={setImageUrl}
          disabled={submitting}
          placeholder="https://…"
        />

        <TextField
          label="Background image URL (optional)"
          type="url"
          value={backgroundImageUrl}
          onChange={setBackgroundImageUrl}
          disabled={submitting}
          placeholder="https://…"
        />

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-gold text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              Creating…
            </>
          ) : (
            "Create competition"
          )}
        </button>
      </form>
    </div>
  );
}
