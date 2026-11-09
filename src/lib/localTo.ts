/**
 * "Local to" competitions (LOCAL-2, portal half of LOCAL-1).
 *
 * Engine contract (LOCAL-1, Ivor, built in parallel; do not rename):
 *   - `createCompetition` accepts two OPTIONAL inputs, both or neither:
 *       `localToCityId`  int, a gazetteer city id from `searchCities`;
 *       `localRadiusKm`  int, 5 to 50, default 25.
 *   - The engine writes `localTo: { cityId, cityName, countryIso2, radiusKm }`
 *     on the competition document. Clients can never write it.
 *
 * Everything the form and the detail page both need lives here so the two
 * cannot disagree about the radius options, the default, or the wording.
 */

/** The distances the form offers. The engine accepts any int 5-50; the form
 * deliberately offers only these four. */
export const LOCAL_RADIUS_OPTIONS_KM = [10, 15, 25, 40] as const;

/** Engine default, and the form's initial selection. */
export const DEFAULT_LOCAL_RADIUS_KM = 25;

export const LOCAL_TO_HELP_TEXT =
  "Only players whose home town is within this distance will see the competition in the app. Anyone with the invite link can still join. Leave blank to show it to everyone.";

/** The `localTo` map the engine writes on `competitions/{id}`. */
export interface LocalTo {
  cityId: number;
  cityName: string;
  countryIso2: string;
  radiusKm: number;
}

/**
 * Defensive read of the document's `localTo` field. Returns `null` unless
 * every part has the expected type: a half-formed value renders nothing
 * rather than a line with a blank town or an "undefined km" distance.
 */
export function parseLocalTo(value: unknown): LocalTo | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const cityName = typeof v.cityName === "string" ? v.cityName.trim() : "";
  if (
    typeof v.cityId !== "number" ||
    !Number.isInteger(v.cityId) ||
    cityName === "" ||
    typeof v.countryIso2 !== "string" ||
    typeof v.radiusKm !== "number" ||
    !Number.isFinite(v.radiusKm) ||
    v.radiusKm <= 0
  ) {
    return null;
  }
  return { cityId: v.cityId, cityName, countryIso2: v.countryIso2, radiusKm: v.radiusKm };
}

/** "Local to {cityName} · {radiusKm} km" */
export function localToLine(localTo: Pick<LocalTo, "cityName" | "radiusKm">): string {
  return `Local to ${localTo.cityName} \u00b7 ${localTo.radiusKm} km`;
}
