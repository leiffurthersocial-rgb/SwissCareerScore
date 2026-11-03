import { describe, expect, it } from "vitest";
import type { DimensionId } from "../dimensions";
import { percentileRanks, percentileRanksByPool } from "./normalize";
import { normalizeWeights, setWeight, toPercentages } from "./weights";
import { compositeFor, scoreEntities, sigmaFor } from "./score";
import type { ScorableEntity } from "./types";

const m = (raw: number | null, confidence: "measured" | "estimated" | "expert-judgment" = "measured") => ({
  raw,
  confidence,
  matchLevel: "exact" as const,
});

describe("percentileRanks", () => {
  it("maps min→0 and max→100 linearly by rank", () => {
    expect(percentileRanks([10, 20, 30, 40, 50])).toEqual([0, 25, 50, 75, 100]);
  });
  it("is invariant to monotone transforms (not min-max)", () => {
    const a = percentileRanks([1, 2, 3, 1000]);
    const b = percentileRanks([1, 2, 3, 4]);
    expect(a).toEqual(b);
  });
  it("gives ties the mean rank", () => {
    expect(percentileRanks([5, 5, 10])).toEqual([25, 25, 100]);
  });
  it("keeps nulls null and ranks only present values", () => {
    expect(percentileRanks([null, 3, null, 1])).toEqual([null, 100, null, 0]);
  });
  it("returns 50 for a single value and [] semantics for all-null", () => {
    expect(percentileRanks([7])).toEqual([50]);
    expect(percentileRanks([null, null])).toEqual([null, null]);
  });
  it("flips direction when lower is better", () => {
    expect(percentileRanks([1, 2, 3], false)).toEqual([100, 50, 0]);
  });
  it("ignores NaN/Infinity like nulls", () => {
    expect(percentileRanks([Number.NaN, 1, 2])).toEqual([null, 0, 100]);
  });
  it("normalizes within pools independently", () => {
    expect(percentileRanksByPool([1, 100, 2, 3], ["a", "b", "a", "b"])).toEqual([0, 100, 100, 0]);
  });
});

describe("weights", () => {
  it("normalizes to shares summing to 1", () => {
    const s = normalizeWeights({ pay: 2, stability: 1, demand: 1 });
    expect(s.pay).toBeCloseTo(0.5);
    expect(Object.values(s).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it("treats negatives and NaN as 0, all-zero as all-zero", () => {
    const s = normalizeWeights({ pay: -3, stability: Number.NaN });
    expect(Object.values(s).every((v) => v === 0)).toBe(true);
  });
  it("toPercentages sums to 100", () => {
    const p = toPercentages({ pay: 1, stability: 3 });
    expect(p.pay + p.stability).toBeCloseTo(100);
    expect(p.stability).toBeCloseTo(75);
  });
  it("setWeight rescales unlocked weights proportionally and keeps total 100", () => {
    const active: DimensionId[] = ["pay", "stability", "demand"];
    const out = setWeight({ pay: 50, stability: 25, demand: 25 }, new Set(), "pay", 80, active);
    expect(out.pay).toBeCloseTo(80);
    expect(out.stability).toBeCloseTo(10);
    expect(out.demand).toBeCloseTo(10);
  });
  it("setWeight never changes locked weights and clamps infeasible targets", () => {
    const active: DimensionId[] = ["pay", "stability", "demand"];
    const out = setWeight({ pay: 20, stability: 60, demand: 20 }, new Set<DimensionId>(["stability"]), "pay", 95, active);
    expect(out.stability).toBeCloseTo(60);
    expect(out.pay).toBeCloseTo(40);
    expect(out.demand).toBeCloseTo(0);
  });
  it("setWeight splits remainder evenly when all other unlocked weights are zero", () => {
    const active: DimensionId[] = ["pay", "stability", "demand"];
    const out = setWeight({ pay: 100 }, new Set(), "pay", 40, active);
    expect(out.stability).toBeCloseTo(30);
    expect(out.demand).toBeCloseTo(30);
  });
});

describe("null handling in composite", () => {
  it("drops missing dimensions and redistributes their weight", () => {
    const shares = normalizeWeights({ pay: 1, stability: 1 });
    const r = compositeFor({ pay: 80, stability: null }, shares);
    expect(r.composite).toBeCloseTo(80);
    expect(r.coverage).toBeCloseTo(0.5);
    const c = r.contributions.find((x) => x.dimension === "pay")!;
    expect(c.effectiveWeight).toBeCloseTo(1);
  });
  it("returns null composite when nothing is present", () => {
    const r = compositeFor({ pay: null }, normalizeWeights({ pay: 1 }));
    expect(r.composite).toBeNull();
    expect(r.coverage).toBe(0);
  });
  it("flags insufficient data below the coverage threshold and excludes from ranking", () => {
    const ents: ScorableEntity[] = [
      { id: "occ-a", pool: "o", metrics: { pay: m(1), stability: m(1), demand: m(1) } },
      { id: "occ-b", pool: "o", metrics: { pay: m(2), stability: m(null), demand: m(null) } },
      { id: "occ-c", pool: "o", metrics: { pay: m(3), stability: m(2), demand: m(2) } },
    ];
    const res = scoreEntities(ents, { pay: 1, stability: 1, demand: 1 }, { draws: 0 });
    const b = res.find((r) => r.id === "occ-b")!;
    expect(b.insufficientData).toBe(true);
    expect(b.rank).toBeNull();
    expect(b.composite).not.toBeNull();
    expect(res.find((r) => r.id === "occ-c")!.rank).toBe(1);
  });
});

describe("scoreEntities", () => {
  const ents: ScorableEntity[] = Array.from({ length: 12 }, (_, i) => ({
    id: `occ-${String(i).padStart(2, "0")}`,
    pool: "o",
    metrics: {
      pay: m(4000 + i * 500),
      stability: m(6 - i * 0.4), // lower unemployment is better
      demand: m(i % 3, "estimated"),
    },
  }));

  it("ranks consistently with weights", () => {
    const res = scoreEntities(ents, { pay: 1, stability: 1 }, { draws: 0 });
    const top = res.find((r) => r.rank === 1)!;
    expect(top.id).toBe("occ-11");
    expect(top.composite).toBeCloseTo(100);
  });

  it("is deterministic for a fixed seed", () => {
    const a = scoreEntities(ents, { pay: 1, demand: 1 }, { draws: 200, seed: 7 });
    const b = scoreEntities(ents, { pay: 1, demand: 1 }, { draws: 200, seed: 7 });
    expect(a.map((r) => r.band)).toEqual(b.map((r) => r.band));
  });

  it("uncertainty bands contain the point estimate and widen with lower confidence", () => {
    const res = scoreEntities(ents, { pay: 1, demand: 1 }, { draws: 300 });
    for (const r of res) {
      expect(r.band!.p10).toBeLessThanOrEqual(r.composite!);
      expect(r.band!.p90).toBeGreaterThanOrEqual(r.composite!);
    }
    const measuredOnly = scoreEntities(ents, { pay: 1 }, { draws: 300 });
    const width = (rs: typeof res) =>
      rs.reduce((s, r) => s + (r.band!.p90 - r.band!.p10), 0) / rs.length;
    expect(width(res)).toBeGreaterThan(width(measuredOnly));
  });

  it("sigma combines confidence and proxy-match penalty", () => {
    expect(sigmaFor("measured", "exact")).toBe(4);
    expect(sigmaFor("measured", "isco2")).toBeGreaterThan(sigmaFor("measured", "exact"));
    expect(sigmaFor("expert-judgment", "exact")).toBeGreaterThan(sigmaFor("estimated", "exact"));
  });
});

describe("ranking stability / sensitivity", () => {
  it("reports zero shift when one dimension fully determines the order", () => {
    const ents: ScorableEntity[] = Array.from({ length: 6 }, (_, i) => ({
      id: `occ-${i}`,
      pool: "o",
      metrics: { pay: m(i), stability: m(10 - i) }, // both agree: higher i better
    }));
    const res = scoreEntities(ents, { pay: 1, stability: 1 }, { draws: 0 });
    for (const r of res) expect(r.sensitivity!.maxShift).toBe(0);
    expect(res.every((r) => !r.sensitivity!.fragile)).toBe(true);
  });

  it("flags fragile entities when ±20% weight changes reorder them", () => {
    // Two dimensions in direct conflict with near-balanced weights: small weight changes flip order.
    const ents: ScorableEntity[] = Array.from({ length: 10 }, (_, i) => ({
      id: `occ-${i}`,
      pool: "o",
      metrics: { pay: m(i), stability: m(i) }, // pay: higher better; stability raw = unemployment, higher worse
    }));
    const res = scoreEntities(ents, { pay: 1, stability: 1 }, { draws: 0, fragileShift: 3 });
    expect(res.some((r) => r.sensitivity!.fragile)).toBe(true);
    const extremes = res.filter((r) => r.id === "occ-0" || r.id === "occ-9");
    expect(extremes.every((r) => r.sensitivity!.maxShift >= 3)).toBe(true);
  });

  it("dimension-level shifts are reported for weighted dims only", () => {
    const ents: ScorableEntity[] = Array.from({ length: 5 }, (_, i) => ({
      id: `occ-${i}`,
      pool: "o",
      metrics: { pay: m(i), demand: m(4 - i) },
    }));
    const res = scoreEntities(ents, { pay: 3, demand: 1 }, { draws: 0 });
    for (const r of res) {
      expect(Object.keys(r.sensitivity!.byDimension).sort()).toEqual(["demand", "pay"]);
    }
  });
});
