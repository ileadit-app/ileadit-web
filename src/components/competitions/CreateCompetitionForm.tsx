"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ErrorBanner } from "@/components/auth/formFields";
import { NumberField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { ArtworkUploadField } from "./ArtworkUploadField";
import { CompetitionHero } from "./CompetitionHero";
import { createDraftCompetitionId } from "@/lib/competitionArtwork";
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
 */
export function CreateCompetitionForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [startTimeValue, setStartTimeValue] = useState("");
  const [durationDaysValue, setDurationDaysValue] = useState("7");
  const [timeZone, setTimeZone] = useState(() => detectBrowserTimeZone());
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);

  /**
   * The folder competition artwork is uploaded into while this form is
   * open. Client-minted, once per mounted form, because the engine mints
   * the real competition id and does not hand it back until AFTER
   * `createCompetition` has been called with the image URLs already in
   * its payload — see `createDraftCompetitionId` for the full reasoning
   * and what it costs when a form is abandoned.
   */
  const [draftId] = useState(() => createDraftCompetitionId());

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
    const outcome = await createCompetition({
      name: name.trim(),
      // Wall-clock time as typed, interpreted IN the chosen time zone (not
      // the browser's own zone) — see zonedWallTimeToDate's comment for why
      // this conversion exists at all.
      startTime: zonedWallTimeToDate(parts, timeZone),
      durationDays: Number(durationDaysValue),
      timeZone,
      description: description.trim() || undefined,
      // Firebase Storage download URLs, produced by ArtworkUploadField —
      // the callable's schema is unchanged and still takes any valid URL
      // (`imageUrl: z.string().url().max(2048).optional()`).
      imageUrl: imageUrl ?? undefined,
      backgroundImageUrl: backgroundImageUrl ?? undefined,
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

        <ArtworkUploadField
          kind="tile"
          label="Competition image (optional)"
          helperText="Square image, at least 512×512px. Shown as a circle on the web and in the Android app."
          draftId={draftId}
          value={imageUrl}
          onChange={setImageUrl}
          disabled={submitting}
        />

        <ArtworkUploadField
          kind="banner"
          label="Background image (optional)"
          helperText="Wide image, at least 1920×1080px. Keep logos and faces centered — edges get cropped on some screens. A darkening gradient sits over it so the name stays readable."
          draftId={draftId}
          value={backgroundImageUrl}
          onChange={setBackgroundImageUrl}
          disabled={submitting}
        />

        <ArtworkPreview
          name={name}
          imageUrl={imageUrl}
          backgroundImageUrl={backgroundImageUrl}
          startTimeValue={startTimeValue}
          durationDays={Number(durationDaysValue)}
          timeZone={timeZone}
        />

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-gold text-base font-bold text-brand-navy transition-colors hover:bg-brand-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
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

/* ------------------------------------------------------------------ *
 * Live artwork preview
 * ------------------------------------------------------------------ */

/** `YYYY-MM-DD` from the `datetime-local` value, and that date plus
 * `durationDays - 1` — the same inclusive-day convention the engine's own
 * `startDate`/`endDate` pair uses. Preview-only framing; the engine
 * derives the real values and this never sends them. */
function previewDates(
  startTimeValue: string,
  durationDays: number,
): { startDate: string | null; endDate: string | null } {
  const startDate = /^\d{4}-\d{2}-\d{2}/.test(startTimeValue) ? startTimeValue.slice(0, 10) : null;
  if (!startDate || !Number.isInteger(durationDays) || durationDays <= 0) {
    return { startDate, endDate: null };
  }
  const [year, month, day] = startDate.split("-").map(Number);
  const end = new Date(year, month - 1, day + durationDays - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    startDate,
    endDate: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
}

/**
 * Shows the uploaded artwork through `CompetitionHero` — the SAME
 * component `/competitions/[id]` renders, not a lookalike. That is the
 * whole point: a preview built from its own markup drifts from the real
 * page the first time either changes, and then it is confidently wrong
 * about the one thing an admin is using it to decide.
 *
 * Two frames, because the banner has no fixed DISPLAY aspect ratio on
 * either platform — it is a full-bleed band of fixed height, so how much
 * of the (16:9-cropped) source survives depends entirely on how wide the
 * window is. A single preview would have to pick one width and silently
 * imply it was THE answer. See `BANNER_ASPECT` in
 * `src/lib/competitionArtwork.ts` for the measurements and the spec's
 * settled 16:9 source contract.
 *
 * `aria-hidden` on the frames, deliberately and narrowly: they are a
 * purely visual rendering of an image, they contain a duplicate `<h1>`
 * and a duplicate copy of the form's own values, and a screen reader user
 * gets nothing from either that the upload field's own status text does
 * not already say. The heading below the preview stays in the
 * accessibility tree.
 */
function ArtworkPreview({
  name,
  imageUrl,
  backgroundImageUrl,
  startTimeValue,
  durationDays,
  timeZone,
}: {
  name: string;
  imageUrl: string | null;
  backgroundImageUrl: string | null;
  startTimeValue: string;
  durationDays: number;
  timeZone: string;
}) {
  if (!imageUrl && !backgroundImageUrl) return null;

  const { startDate, endDate } = previewDates(startTimeValue, durationDays);
  const competition = {
    name: name.trim() || "Untitled competition",
    imageUrl,
    backgroundImageUrl,
    // Anything created here starts in the future, so `scheduled` is what
    // the engine's own onCompetitionWritten trigger will derive.
    status: "scheduled" as const,
    startDate,
    endDate,
    durationDays: Number.isInteger(durationDays) && durationDays > 0 ? durationDays : null,
    timeZone,
  };

  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-4">
      <p className="text-sm font-semibold text-foreground">Preview</p>
      <p className="mt-1 text-xs text-muted-foreground">
        How this looks on the competition page. The background is trimmed to fit the window, so it
        shows less of the image on a wide screen than on a phone.
      </p>

      <div className="mt-3 space-y-4" aria-hidden="true">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            On a phone
          </p>
          <div className="max-w-full overflow-x-auto">
            <div className="w-[390px] overflow-hidden rounded-xl border border-border">
              <CompetitionHero competition={competition} size="phone" />
              <div className="h-6 bg-background" />
            </div>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            On a wide screen
          </p>
          <div className="overflow-hidden rounded-xl border border-border">
            <CompetitionHero competition={competition} size="desktop" />
            <div className="h-6 bg-background" />
          </div>
        </div>
      </div>
    </div>
  );
}
