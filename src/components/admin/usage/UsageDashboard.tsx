"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { DEFAULT_RANGE, RANGE_KEYS, buildModel, type RangeKey } from "@/lib/usageMetrics";
import { useUsageMetrics } from "@/lib/useUsageMetrics";
import { UsageBanner, UsageContent, UsageLastRun, UsageMeta, UsageNotes } from "./UsageView";

const RANGE_LABEL: Record<RangeKey, string> = { "7": "7 days", "28": "28 days", "90": "90 days", all: "All" };

const BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy";

/**
 * The usage page body. MOUNT ONLY AFTER the strict admin gate has passed:
 * `useUsageMetrics` reads Firestore as soon as it renders.
 */
export function UsageDashboard() {
  const [range, setRange] = useState<RangeKey>(DEFAULT_RANGE);
  const load = useUsageMetrics(range);
  const data = load.data;

  const model = useMemo(
    () =>
      data
        ? buildModel({ docs: data.docs, live: data.live, lastRun: data.lastRun, alertPresent: data.alertPresent, now: new Date(), rangeKey: range })
        : null,
    [data, range],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <h1 className="text-3xl font-extrabold text-brand-navy sm:text-4xl">Usage</h1>
      {model ? <UsageMeta model={model} /> : null}
      {model ? <UsageLastRun run={model.lastRun} /> : null}

      <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
        {RANGE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={range === key}
            onClick={() => setRange(key)}
            className={`${BUTTON} ${
              range === key
                ? "border-brand-navy bg-brand-navy text-on-navy-foreground"
                : "border-border bg-card text-brand-navy hover:border-brand-navy/40"
            }`}
          >
            {RANGE_LABEL[key]}
          </button>
        ))}
        <button
          type="button"
          onClick={load.reload}
          disabled={load.status === "loading"}
          className={`${BUTTON} border-border bg-card text-brand-navy hover:border-brand-navy/40 disabled:opacity-60`}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      <div className="mt-6 space-y-5">
        {load.status === "error" ? (
          <div role="alert" className="rounded-2xl border border-destructive bg-card p-4 text-sm text-foreground">
            The usage numbers could not be read. Check that this account has admin access and try again.
          </div>
        ) : null}
        {load.status === "loading" && !model ? (
          <p role="status" aria-live="polite" className="text-muted-foreground">
            Loading the usage numbers…
          </p>
        ) : null}
        {model ? (
          <>
            <UsageBanner model={model} />
            <UsageContent model={model} />
            <UsageNotes />
          </>
        ) : null}
      </div>
    </div>
  );
}
