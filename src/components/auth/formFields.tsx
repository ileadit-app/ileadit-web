"use client";

import { useId, useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

const INPUT_CLASS =
  "h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30";

/**
 * Page-level error banner — spec §4.5. Reserved for non-field-specific
 * failures (network error, popup-blocked, an `ensureAccount` failure).
 * Contrast note from the spec: #D14451 text on white is ~4.5:1 — right at
 * the AA line — so this always pairs with the icon and stays `font-medium`,
 * never relying on colour alone.
 */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}

export function EmailField({
  value,
  onChange,
  error,
  autoFocusOnDesktopRef,
  disabled,
  readOnly,
}: {
  value: string;
  onChange?: (value: string) => void;
  error?: string;
  autoFocusOnDesktopRef?: React.Ref<HTMLInputElement>;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        Email
      </label>
      <input
        ref={autoFocusOnDesktopRef}
        id={id}
        type="email"
        autoComplete="email"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`mt-1.5 ${INPUT_CLASS} ${error ? "border-destructive" : ""} ${readOnly ? "cursor-not-allowed bg-muted" : ""}`}
      />
      {error ? <FieldError id={errorId} message={error} /> : null}
    </div>
  );
}

export function PasswordField({
  value,
  onChange,
  error,
  helperText,
  autoComplete,
  disabled,
  label = "Password",
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
  label?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${INPUT_CLASS} pr-12 ${error ? "border-destructive" : ""}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </div>
      {error ? (
        <FieldError id={errorId} message={error} />
      ) : helperText ? (
        <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}
