"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  CITY_SEARCH_MAX_QUERY_LENGTH,
  CITY_SEARCH_MIN_QUERY_LENGTH,
  searchCities,
  type CitySearchResult,
} from "@/lib/searchCities";

const DEBOUNCE_MS = 250;

const INPUT_CLASS =
  "h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "results"; results: CitySearchResult[] }
  | { status: "error" };

/**
 * Type-ahead town picker over the engine's `searchCities` callable.
 *
 * Controlled: `value` is the picked town (or `null`), `onChange` reports a
 * pick or a clear. While a town is picked the input is replaced by the town's
 * label with a clear button, so the picked id and what the user sees can
 * never drift apart. Typing never changes `value` on its own: only choosing a
 * result does, so half-typed text can never be mistaken for a pick.
 *
 * Requests are debounced and stale responses discarded (a slow answer for
 * "lee" must not overwrite the answer for "leeds").
 */
export function CityPicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: CitySearchResult | null;
  onChange: (city: CitySearchResult | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;

  const [text, setText] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      // Invalidate any in-flight request so it cannot set state after unmount.
      requestSeq.current += 1;
    },
    [],
  );

  function handleInput(next: string) {
    setText(next);
    setActiveIndex(-1);
    if (timer.current) clearTimeout(timer.current);
    const seq = ++requestSeq.current;

    const trimmed = next.trim();
    if (trimmed.length < CITY_SEARCH_MIN_QUERY_LENGTH) {
      setSearch({ status: "idle" });
      setOpen(false);
      return;
    }

    setOpen(true);
    setSearch({ status: "loading" });
    timer.current = setTimeout(async () => {
      const outcome = await searchCities(trimmed.slice(0, CITY_SEARCH_MAX_QUERY_LENGTH));
      if (seq !== requestSeq.current) return; // a newer keystroke superseded this
      setSearch(
        outcome.status === "success"
          ? { status: "results", results: outcome.results }
          : { status: "error" },
      );
    }, DEBOUNCE_MS);
  }

  function choose(city: CitySearchResult) {
    requestSeq.current += 1;
    if (timer.current) clearTimeout(timer.current);
    setText("");
    setSearch({ status: "idle" });
    setOpen(false);
    setActiveIndex(-1);
    onChange(city);
  }

  function clear() {
    onChange(null);
  }

  const results = search.status === "results" ? search.results : [];

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && open && activeIndex >= 0) {
      e.preventDefault(); // pick the highlighted town, don't submit the form
      choose(results[activeIndex]);
    }
  }

  if (value) {
    return (
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <div className="mt-1.5 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-input bg-background px-4 py-2">
          <span className="min-w-0 break-words text-sm text-foreground" data-testid="city-picker-selected">
            {value.label}
          </span>
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            aria-label={`Clear ${label}`}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:cursor-not-allowed"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  const showList = open && search.status === "results" && results.length > 0;

  return (
    <div className="relative">
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined}
        autoComplete="off"
        value={text}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Start typing a town or city"
        className={`mt-1.5 ${INPUT_CLASS}`}
      />

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-card py-1 shadow-lg"
        >
          {results.map((city, index) => (
            <li
              key={city.cityId}
              id={`${id}-opt-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              // mouseDown, not click: the input's blur would otherwise close
              // the list before the click lands.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(city);
              }}
              className={`min-h-11 cursor-pointer px-4 py-2.5 text-sm text-foreground ${
                index === activeIndex ? "bg-muted" : "hover:bg-muted"
              }`}
            >
              {city.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-1 text-xs text-muted-foreground" aria-live="polite">
        {search.status === "loading" ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            Searching…
          </span>
        ) : search.status === "error" ? (
          <span>We couldn&apos;t search towns just now. Try again in a moment.</span>
        ) : search.status === "results" && results.length === 0 ? (
          <span>No towns found for that search.</span>
        ) : null}
      </div>
    </div>
  );
}
