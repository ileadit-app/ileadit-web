"use client";

import { useEffect, useState } from "react";
import { fetchDaily, fetchSide, type UsageSide } from "./usageMetricsRead";
import { rangeLimit } from "./usageMetrics";

export interface UsageData extends UsageSide {
  docs: unknown[];
  /** How many daily documents were requested for `docs`. */
  limit: number;
  /** The reload counter this data was read under. */
  attempt: number;
}

export type UsageLoad =
  | { status: "loading"; data: UsageData | null }
  | { status: "error"; data: UsageData | null }
  | { status: "ready"; data: UsageData };

/**
 * Loads the usage documents for a range. MOUNT ONLY AFTER the strict admin gate
 * has passed: the first thing this hook does is read Firestore.
 *
 * Re-reads the daily documents only when a wider range needs more of them than
 * were already fetched. `reload` re-reads everything. Errors are logged as a
 * code only and surface as `status: "error"`, never as an empty page.
 */
export function useUsageMetrics(rangeKey: string): UsageLoad & { reload: () => void } {
  const need = rangeLimit(rangeKey);
  const [data, setData] = useState<UsageData | null>(null);
  const [failedNeed, setFailedNeed] = useState<{ need: number; attempt: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const have = data?.limit ?? 0;
  const loadedAttempt = data ? data.attempt : -1;

  useEffect(() => {
    if (have >= need && loadedAttempt === attempt) return;
    let cancelled = false;
    const reuse =
      have >= need && loadedAttempt === attempt && data !== null ? Promise.resolve(data.docs) : fetchDaily(need);
    Promise.all([reuse, fetchSide()])
      .then(([docs, side]) => {
        if (cancelled) return;
        setData({ docs, limit: Math.max(have, need), attempt, ...side });
        setFailedNeed(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const code = (error as { code?: unknown } | null)?.code;
        console.error("[useUsageMetrics] could not read usage data:", typeof code === "string" ? code : "unknown");
        setFailedNeed({ need, attempt });
      });
    return () => {
      cancelled = true;
    };
    // `data` is read only to reuse already-fetched documents; `have` and
    // `loadedAttempt` carry its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [need, have, attempt, loadedAttempt]);

  const reload = () => setAttempt((a) => a + 1);
  if (failedNeed && failedNeed.need === need && failedNeed.attempt === attempt) {
    return { status: "error", data, reload };
  }
  if (data && have >= need && loadedAttempt === attempt) return { status: "ready", data, reload };
  return { status: "loading", data, reload };
}
