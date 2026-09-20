"use client";

import { useId } from "react";
import { FieldError } from "@/components/auth/formFields";

/**
 * Generic form field primitives, factored out of the sign-in flow so the
 * competition creation form (P1.4) uses the SAME visual language as
 * `EmailField`/`PasswordField` in `src/components/auth/formFields.tsx`
 * (per the P1.4 ticket: "reuse the AuthCard form treatment... same visual
 * language, not a second one") without importing auth-specific components.
 * `ErrorBanner`/`FieldError` themselves stay in `formFields.tsx` and are
 * reused directly (they were already generic in content, just co-located
 * with auth) — only the styled `<input>`/`<select>`/`<textarea>` wrappers
 * are duplicated here, deliberately, so this file has no reason to ever
 * import anything auth-specific and future non-auth forms have an obvious,
 * neutral home to import from.
 */
const INPUT_CLASS =
  "h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30";

interface BaseFieldProps {
  label: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
}

export function TextField({
  label,
  value,
  onChange,
  error,
  helperText,
  disabled,
  required,
  type = "text",
  placeholder,
  maxLength,
  inputRef,
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "url" | "datetime-local";
  placeholder?: string;
  maxLength?: number;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
        {required ? <span className="text-brand-coral" aria-hidden="true"> *</span> : null}
      </label>
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`mt-1.5 ${INPUT_CLASS} ${error ? "border-destructive" : ""}`}
      />
      {error ? (
        <FieldError id={errorId} message={error} />
      ) : helperText ? (
        <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  error,
  helperText,
  disabled,
  required,
  min,
  step = 1,
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  step?: number;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
        {required ? <span className="text-brand-coral" aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={min}
        step={step}
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`mt-1.5 ${INPUT_CLASS} ${error ? "border-destructive" : ""}`}
      />
      {error ? (
        <FieldError id={errorId} message={error} />
      ) : helperText ? (
        <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  error,
  helperText,
  disabled,
  required,
  options,
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
        {required ? <span className="text-brand-coral" aria-hidden="true"> *</span> : null}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`mt-1.5 ${INPUT_CLASS} ${error ? "border-destructive" : ""}`}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error ? (
        <FieldError id={errorId} message={error} />
      ) : helperText ? (
        <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  error,
  helperText,
  disabled,
  required,
  placeholder,
  rows = 3,
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
        {required ? <span className="text-brand-coral" aria-hidden="true"> *</span> : null}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 ${error ? "border-destructive" : ""}`}
      />
      {error ? (
        <FieldError id={errorId} message={error} />
      ) : helperText ? (
        <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}
