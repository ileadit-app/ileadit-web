import { describe, expect, it } from "vitest";
import { DEFAULT_LOCAL_RADIUS_KM, LOCAL_RADIUS_OPTIONS_KM, localToLine, parseLocalTo } from "./localTo";

describe("localTo", () => {
  it("default radius is 25 and is one of the offered options", () => {
    expect(DEFAULT_LOCAL_RADIUS_KM).toBe(25);
    expect(LOCAL_RADIUS_OPTIONS_KM).toEqual([10, 15, 25, 40]);
  });

  it("parses a complete localTo map", () => {
    expect(parseLocalTo({ cityId: 1, cityName: " Leeds ", countryIso2: "GB", radiusKm: 25 })).toEqual({
      cityId: 1,
      cityName: "Leeds",
      countryIso2: "GB",
      radiusKm: 25,
    });
  });

  it("returns null for absent or half-formed values", () => {
    expect(parseLocalTo(undefined)).toBeNull();
    expect(parseLocalTo(null)).toBeNull();
    expect(parseLocalTo("Leeds")).toBeNull();
    expect(parseLocalTo({ cityId: 1, cityName: "", countryIso2: "GB", radiusKm: 25 })).toBeNull();
    expect(parseLocalTo({ cityId: 1, cityName: "Leeds", countryIso2: "GB" })).toBeNull();
    expect(parseLocalTo({ cityId: "1", cityName: "Leeds", countryIso2: "GB", radiusKm: 25 })).toBeNull();
  });

  it("formats the line", () => {
    expect(localToLine({ cityName: "Leeds", radiusKm: 25 })).toBe("Local to Leeds \u00b7 25 km");
  });
});
