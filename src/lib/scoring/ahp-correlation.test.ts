import { describe, expect, it } from "vitest";
import { ahpWeights, allPairs, buildMatrix } from "./ahp";
import { overlapWarnings, pearson, spearman } from "./correlation";

describe("AHP", () => {
  it("returns equal weights for an all-ones matrix (perfectly consistent)", () => {
    const r = ahpWeights(buildMatrix(4, []));
    r.weights.forEach((w) => expect(w).toBeCloseTo(0.25));
    expect(r.consistencyRatio).toBeCloseTo(0);
    expect(r.consistent).toBe(true);
  });

  it("recovers the generating weights of a consistent matrix", () => {
    const truth = [0.5, 0.3, 0.2];
    const judgments = allPairs(3).map(([a, b]) => ({ a, b, value: truth[a] / truth[b] }));
    const r = ahpWeights(buildMatrix(3, judgments));
    r.weights.forEach((w, i) => expect(w).toBeCloseTo(truth[i], 6));
    expect(r.lambdaMax).toBeCloseTo(3, 6);
  });

  it("matches Saaty's textbook example within tolerance and flags inconsistency", () => {
    // A ≫ B, B ≫ C but C ≫ A — circular preferences must yield CR > 0.1
    const r = ahpWeights(buildMatrix(3, [
      { a: 0, b: 1, value: 5 },
      { a: 1, b: 2, value: 5 },
      { a: 2, b: 0, value: 5 },
    ]));
    expect(r.consistent).toBe(false);
    expect(r.consistencyRatio).toBeGreaterThan(0.1);
  });

  it("clamps judgments to the 1/9..9 scale and rejects self-pairs", () => {
    const m = buildMatrix(2, [{ a: 0, b: 1, value: 100 }]);
    expect(m[0][1]).toBe(9);
    expect(m[1][0]).toBeCloseTo(1 / 9);
    expect(() => buildMatrix(2, [{ a: 1, b: 1, value: 2 }])).toThrow();
  });

  it("enumerates n(n-1)/2 questions", () => {
    expect(allPairs(5)).toHaveLength(10);
  });
});

describe("correlation", () => {
  it("pearson of identical series is 1, of reversed is -1", () => {
    expect(pearson([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
  });
  it("spearman uses only complete pairs and needs a minimum count", () => {
    expect(spearman([1, 2, null, 4], [1, 2, 3, null], 2)).toBeCloseTo(1);
    expect(spearman([1, 2], [1, 2])).toBeNull();
  });
  it("spearman is rank-based (monotone transform invariant)", () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(spearman(x, x.map((v) => v ** 3))).toBeCloseTo(1);
  });
  it("overlap warnings only cover weighted pairs above threshold", () => {
    const matrix = { pay: { careerGrowth: 0.8, demand: 0.2 }, careerGrowth: { pay: 0.8 }, demand: { pay: 0.2 } };
    const w = overlapWarnings(matrix, ["pay", "careerGrowth", "demand"], 0.6);
    expect(w).toEqual([{ a: "pay", b: "careerGrowth", rho: 0.8 }]);
  });
});
