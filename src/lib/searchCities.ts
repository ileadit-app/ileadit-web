import { httpsCallable } from "firebase/functions";
import { getFunctionsClient } from "./functions";

/**
 * Wrapper for the engine's `searchCities` callable (CITY-1 / CITY-1b, engine
 * branch `engine/city-picker`, read at `functions/src/callables/
 * searchCities.ts`): a signed-in, read-only type-ahead lookup against the
 * bundled GeoNames gazetteer.
 *
 * Contract as read from that source (NOT exercised against a deployed
 * engine from here):
 *   request   { query: string, limit?: int, countryHint?: string }
 *             query is 2-60 characters after folding, otherwise the engine
 *             refuses with `invalid-argument`; limit defaults to 8, max 10.
 *   response  { results: Array<{ cityId, name, regionName, countryIso2,
 *             countryName, label }> }
 *
 * This is the web portal's first client for it (the account page still has
 * a plain free-text City field). Single call site, like every other
 * callable in `src/lib`; the picker component never calls `httpsCallable`.
 */

export const CITY_SEARCH_MIN_QUERY_LENGTH = 2;
export const CITY_SEARCH_MAX_QUERY_LENGTH = 60;

export interface CitySearchResult {
  cityId: number;
  name: string;
  regionName: string | null;
  countryIso2: string;
  countryName: string | null;
  /** Ready-made display string, e.g. "Leeds, England, United Kingdom". */
  label: string;
}

export type SearchCitiesOutcome =
  | { status: "success"; results: CitySearchResult[] }
  | { status: "failure"; cause: unknown };

function readResult(raw: unknown): CitySearchResult | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.cityId !== "number" ||
    !Number.isInteger(r.cityId) ||
    typeof r.name !== "string" ||
    r.name.trim() === "" ||
    typeof r.countryIso2 !== "string"
  ) {
    return null;
  }
  return {
    cityId: r.cityId,
    name: r.name,
    regionName: typeof r.regionName === "string" ? r.regionName : null,
    countryIso2: r.countryIso2,
    countryName: typeof r.countryName === "string" ? r.countryName : null,
    label: typeof r.label === "string" && r.label.trim() !== "" ? r.label : r.name,
  };
}

export async function searchCities(query: string, limit?: number): Promise<SearchCitiesOutcome> {
  const callable = httpsCallable(getFunctionsClient(), "searchCities");
  try {
    const result = await callable({ query, ...(limit ? { limit } : {}) });
    const data = result.data as { results?: unknown } | undefined;
    const rows = Array.isArray(data?.results) ? data.results : [];
    return {
      status: "success",
      results: rows.map(readResult).filter((r): r is CitySearchResult => r !== null),
    };
  } catch (error) {
    return { status: "failure", cause: error };
  }
}
