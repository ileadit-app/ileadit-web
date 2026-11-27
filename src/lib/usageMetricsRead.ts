// The ONLY Firestore reads of the admin usage page (WEB-PORTAL-USAGE-1):
//
//   ops/metrics/daily/*             (newest first, bounded)
//   ops/metrics/live/current
//   ops/jobRuns/usageMetrics/*      (newest run only)
//
// Reads only: getDoc / getDocs / query. Nothing here writes. Call these only
// once the strict admin gate has passed (`useStrictAdmin() === "allowed"`); the
// Firestore rules give the admin claim alone read access to ops/**. Nothing
// under users/** is touched, so no step figure, uid or email can arrive.

import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import { USAGE_PATHS, normalizeRun, type UsageRun } from "./usageMetrics";

export interface UsageSide {
  /** `ops/metrics/live/current`, reduced to what the page uses, or null. */
  live: { dates: Record<string, unknown>; computedAt: unknown } | null;
  /** Newest job run, reduced to the allowlisted fields. */
  lastRun: UsageRun | null;
}

export async function fetchDaily(n: number): Promise<unknown[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(
    query(collection(db, ...USAGE_PATHS.daily), orderBy("date", "desc"), limit(n)),
  );
  return snap.docs.map((d) => d.data());
}

export async function fetchSide(): Promise<UsageSide> {
  const db = getFirebaseDb();
  const [liveSnap, runSnap] = await Promise.all([
    getDoc(doc(db, ...USAGE_PATHS.live)),
    getDocs(query(collection(db, ...USAGE_PATHS.runs), orderBy("startedAt", "desc"), limit(1))),
  ]);
  let live: UsageSide["live"] = null;
  if (liveSnap.exists()) {
    const data = liveSnap.data() as Record<string, unknown>;
    const dates = data.dates;
    live = {
      dates: dates !== null && typeof dates === "object" ? (dates as Record<string, unknown>) : {},
      computedAt: data.computedAt,
    };
  }
  // errorMessage and the run id never leave this function: normalizeRun keeps
  // an allowlist of six fields.
  return { live, lastRun: runSnap.empty ? null : normalizeRun(runSnap.docs[0].data()) };
}
