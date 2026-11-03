import { describe, expect, it } from "vitest";
import { decodeState, defaultState, encodeState } from "./url-state";
import { passesFilters, type FilterableEntity } from "./filters";

describe("url state", () => {
  it("default state encodes to an empty query", () => {
    expect(encodeState(defaultState()).toString()).toBe("");
  });

  it("round-trips custom weights, locks, filters and compare", () => {
    const s = defaultState();
    s.preset = "custom";
    s.weights = { ...s.weights, pay: 40, stability: 60, demand: 0, aiResilience: 0, trainingEase: 0, entryAccess: 0, timeToQualify: 0, careerGrowth: 0, workLifeBalance: 0, flexibility: 0, mobility: 0, regional: 0, meaning: 0 };
    s.locked = new Set(["pay"]);
    s.filters = { kinds: ["education"], maxYears: 4, language: "fr", minPay: 6000, query: "pflege" };
    s.compare = ["occ-a", "edu-b"];
    const back = decodeState(encodeState(s));
    expect(back.preset).toBe("custom");
    expect(back.weights.pay).toBeCloseTo(40);
    expect(back.weights.stability).toBeCloseTo(60);
    expect([...back.locked]).toEqual(["pay"]);
    expect(back.filters).toEqual(s.filters);
    expect(back.compare).toEqual(["occ-a", "edu-b"]);
  });

  it("encodes a pure preset as just p=", () => {
    const s = defaultState();
    s.preset = "money";
    s.weights = decodeState(new URLSearchParams("p=money")).weights;
    expect(encodeState(s).toString()).toBe("p=money");
  });

  it("ignores garbage input without throwing", () => {
    const s = decodeState(new URLSearchParams("p=evil&w=zzz.5_pay.-3_pay&l=nope&k=alien&lang=xx&y=abc&c=../etc"));
    expect(s.preset).toBe("custom");
    expect(s.filters).toEqual({});
    expect(s.compare).toEqual([]);
    expect(s.locked.size).toBe(0);
  });

  it("caps compare at 4 and dedupes", () => {
    const s = decodeState(new URLSearchParams("c=occ-a~occ-a~occ-b~occ-c~occ-d~occ-e"));
    expect(s.compare).toEqual(["occ-a", "occ-b", "occ-c", "occ-d"]);
  });
});

describe("hard filters", () => {
  const e: FilterableEntity = {
    kind: "education",
    route: "vocational",
    eduType: "EFZ",
    languageRegions: ["de", "fr"],
    names: ["Polymechaniker/in EFZ", "Polymechanic"],
    yearsToQualify: 4,
    medianPay: 6500,
  };
  it("passes when no filters set", () => expect(passesFilters(e, {})).toBe(true));
  it("applies each filter", () => {
    expect(passesFilters(e, { maxYears: 3 })).toBe(false);
    expect(passesFilters(e, { language: "it" })).toBe(false);
    expect(passesFilters(e, { minPay: 7000 })).toBe(false);
    expect(passesFilters(e, { kinds: ["occupation"] })).toBe(false);
    expect(passesFilters(e, { query: "poly" })).toBe(true);
  });
  it("hides entities with unknown values when a numeric filter is active", () => {
    expect(passesFilters({ ...e, yearsToQualify: null }, { maxYears: 10 })).toBe(false);
    expect(passesFilters({ ...e, medianPay: null }, { minPay: 1 })).toBe(false);
  });
});
