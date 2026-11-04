import { DIMENSIONS, DIMENSION_IDS, type DimensionId } from "../dimensions";
import type { Confidence, MatchLevel } from "../schema";
import { percentileRanksByPool } from "./normalize";
import { ABSOLUTE_CURVES, applyCurve, flawExponent, type FlawPenaltyId, type ScoringMode } from "./curves";
import { mulberry32, quantile } from "./rng";
import type {
  Contribution,
  DimensionScore,
  EntityResult,
  ScorableEntity,
  ScoreOptions,
  SensitivityResult,
  Weights,
} from "./types";
import { normalizeWeights, perturbWeight } from "./weights";

/** 1σ (percentile points) attributable to the datapoint's confidence class. */
export const CONFIDENCE_SIGMA: Record<Confidence, number> = {
  measured: 4,
  estimated: 10,
  "expert-judgment": 18,
};

/** Additional 1σ (percentile points) for using a proxy statistic instead of an exact one. */
export const MATCH_SIGMA: Record<MatchLevel, number> = {
  exact: 0,
  isco4: 2,
  isco3: 4,
  isco2: 6,
  isco1: 10,
  field: 6,
  sector: 10,
  "education-level": 12,
  derived: 8,
};

export function sigmaFor(confidence: Confidence, matchLevel: MatchLevel): number {
  const a = CONFIDENCE_SIGMA[confidence];
  const b = MATCH_SIGMA[matchLevel];
  return Math.sqrt(a * a + b * b);
}

const DEFAULTS: Required<ScoreOptions> = {
  mode: "absolute",
  flawPenalty: "moderate",
  minCoverage: 0.6,
  draws: 400,
  seed: 20261103,
  sensitivityDelta: 0.2,
  fragileShift: 3,
  skipSensitivity: false,
};

type ScoreMatrix = Record<DimensionId, (number | null)[]>;

/**
 * Dimension scores 0–100. `absolute`: fixed value curves (magnitude matters, comparable across
 * pools). `relative`: percentile rank within each entity's pool.
 */
export function computeDimensionScores(entities: ReadonlyArray<ScorableEntity>, mode: ScoringMode = "absolute"): ScoreMatrix {
  const pools = entities.map((e) => e.pool);
  const out = {} as ScoreMatrix;
  for (const id of DIMENSION_IDS) {
    const raw = entities.map((e) => e.metrics[id]?.raw ?? null);
    out[id] =
      mode === "absolute"
        ? raw.map((x) => applyCurve(x, ABSOLUTE_CURVES[id]))
        : percentileRanksByPool(raw, pools, DIMENSIONS[id].higherIsBetter);
  }
  return out;
}

/**
 * Weighted power mean M_p = (Σ wᵢ·sᵢ^p)^(1/p) over present dimensions (weights renormalized).
 * p = 1 is the plain weighted average; p < 1 pulls the result towards the weakest dimensions, so
 * one serious flaw costs more than an equal strength gains (p = 0 → geometric mean, p = −1 →
 * harmonic). Scores are floored at 1 for p ≤ 0 so a single 0 does not zero everything.
 */
export function powerMean(values: ReadonlyArray<number>, weights: ReadonlyArray<number>, p: number): number {
  const W = weights.reduce((a, b) => a + b, 0);
  if (W <= 0 || !values.length) return NaN;
  if (p === 1) return values.reduce((s, v, i) => s + weights[i] * v, 0) / W;
  const v = values.map((x) => (p <= 0 ? Math.max(1, x) : Math.max(0, x)));
  if (p === 0) return Math.exp(v.reduce((s, x, i) => s + weights[i] * Math.log(x), 0) / W);
  return Math.pow(v.reduce((s, x, i) => s + weights[i] * Math.pow(x, p), 0) / W, 1 / p);
}

interface CompositeRow {
  composite: number | null;
  /** Plain weighted average (what the composite would be without a flaw penalty). */
  linear: number | null;
  /** linear − composite: points lost to the flaw penalty. */
  penalty: number;
  coverage: number;
  contributions: Contribution[];
}

/**
 * Weighted mean over the dimensions that have data. Missing dimensions are dropped and the
 * remaining weights renormalized — never imputed. `coverage` reports the share of nominal weight
 * that is backed by data.
 */
export function compositeFor(
  scores: Partial<Record<DimensionId, number | null>>,
  shares: Record<DimensionId, number>,
  p = 1,
): CompositeRow {
  let presentWeight = 0;
  let totalWeight = 0;
  for (const id of DIMENSION_IDS) {
    const w = shares[id];
    if (w <= 0) continue;
    totalWeight += w;
    if (scores[id] !== null && scores[id] !== undefined) presentWeight += w;
  }
  const contributions: Contribution[] = [];
  let composite = 0;
  for (const id of DIMENSION_IDS) {
    const w = shares[id];
    if (w <= 0) continue;
    const s = scores[id] ?? null;
    const eff = s === null || presentWeight === 0 ? 0 : w / presentWeight;
    const points = s === null ? 0 : eff * s;
    composite += points;
    contributions.push({
      dimension: id,
      nominalWeight: w,
      effectiveWeight: eff,
      score: s,
      points,
    });
  }
  let final = presentWeight > 0 ? composite : null;
  if (final !== null && p !== 1) {
    const present = contributions.filter((c) => c.score !== null);
    final = powerMean(present.map((c) => c.score as number), present.map((c) => c.effectiveWeight), p);
  }
  return {
    composite: final,
    linear: presentWeight > 0 ? composite : null,
    penalty: final !== null && presentWeight > 0 ? composite - final : 0,
    coverage: totalWeight > 0 ? presentWeight / totalWeight : 0,
    contributions,
  };
}

/**
 * Rank (1 = best) entities by composite, descending, separately within each pool (scores are
 * percentiles within a pool, so ranks across pools would compare unlike things). Ties are broken
 * by id for determinism. Ineligible (insufficient-data) entities get null.
 */
export function rankOrder(
  ids: ReadonlyArray<string>,
  composites: ReadonlyArray<number | null>,
  eligible: ReadonlyArray<boolean>,
  pools?: ReadonlyArray<string>,
): (number | null)[] {
  const ranks: (number | null)[] = ids.map(() => null);
  const byPool = new Map<string, { id: string; i: number; c: number }[]>();
  ids.forEach((id, i) => {
    const c = composites[i];
    if (!eligible[i] || c === null) return;
    const key = pools?.[i] ?? "";
    const arr = byPool.get(key) ?? [];
    arr.push({ id, i, c });
    byPool.set(key, arr);
  });
  for (const arr of byPool.values()) {
    arr.sort((a, b) => b.c - a.c || a.id.localeCompare(b.id));
    arr.forEach((x, r) => (ranks[x.i] = r + 1));
  }
  return ranks;
}

function pointComposites(matrix: ScoreMatrix, n: number, weights: Weights, p: number): (number | null)[] {
  const shares = normalizeWeights(weights);
  const out: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    const s: Partial<Record<DimensionId, number | null>> = {};
    for (const id of DIMENSION_IDS) s[id] = matrix[id][i];
    out.push(compositeFor(s, shares, p).composite);
  }
  return out;
}

/**
 * Full scoring pipeline: percentile normalization → weighted composite with null-aware weight
 * redistribution → ranking → Monte-Carlo uncertainty bands → ±δ weight sensitivity.
 */
export function scoreEntities(
  entities: ReadonlyArray<ScorableEntity>,
  weights: Weights,
  options: ScoreOptions = {},
): EntityResult[] {
  const opt = { ...DEFAULTS, ...options };
  const n = entities.length;
  const ids = entities.map((e) => e.id);
  const matrix = computeDimensionScores(entities, opt.mode);
  const p = flawExponent(opt.flawPenalty as FlawPenaltyId);
  const shares = normalizeWeights(weights);
  const active = DIMENSION_IDS.filter((id) => shares[id] > 0);

  const rows = entities.map((_, i) => {
    const s: Partial<Record<DimensionId, number | null>> = {};
    for (const id of DIMENSION_IDS) s[id] = matrix[id][i];
    return compositeFor(s, shares, p);
  });
  const eligible = rows.map((r) => r.composite !== null && r.coverage >= opt.minCoverage);
  const pools = entities.map((e) => e.pool);
  const ranks = rankOrder(
    ids,
    rows.map((r) => r.composite),
    eligible,
    pools,
  );

  const sigmas: Record<DimensionId, number[]> = {} as Record<DimensionId, number[]>;
  for (const id of DIMENSION_IDS) {
    sigmas[id] = entities.map((e) => {
      const m = e.metrics[id];
      return m ? sigmaFor(m.confidence, m.matchLevel) : 0;
    });
  }

  // ---- Monte-Carlo uncertainty ------------------------------------------------------------
  const bands: ({ p10: number; p90: number } | null)[] = ids.map(() => null);
  const rankBands: ({ best: number; worst: number } | null)[] = ids.map(() => null);
  if (opt.draws > 0 && active.length > 0) {
    const rand = mulberry32(opt.seed);
    const drawsComposite: number[][] = ids.map(() => []);
    const drawsRank: number[][] = ids.map(() => []);
    // Flat typed arrays for speed: score (NaN = missing) and sigma per entity × active dimension.
    const k = active.length;
    const S = new Float64Array(n * k);
    const SG = new Float64Array(n * k);
    const W = new Float64Array(k);
    active.forEach((id, j) => {
      W[j] = shares[id];
      for (let i = 0; i < n; i++) {
        const v = matrix[id][i];
        S[i * k + j] = v === null ? NaN : v;
        SG[i * k + j] = sigmas[id][i];
      }
    });
    const Wsum = W.reduce((a, b) => a + b, 0);
    // Eligible entity indices per pool, pre-sorted by id for deterministic tie-breaking.
    const poolIdx = new Map<string, number[]>();
    for (let i = 0; i < n; i++) {
      if (!eligible[i]) continue;
      const arr = poolIdx.get(pools[i]) ?? [];
      arr.push(i);
      poolIdx.set(pools[i], arr);
    }
    const idOrder = new Float64Array(n);
    [...ids.keys()].sort((a, b) => ids[a].localeCompare(ids[b])).forEach((i, r) => (idOrder[i] = r));
    const comp = new Float64Array(n);
    let spare: number | null = null;
    const gauss = () => {
      if (spare !== null) {
        const v = spare;
        spare = null;
        return v;
      }
      let u = 0;
      while (u === 0) u = rand();
      const r = Math.sqrt(-2 * Math.log(u));
      const th = 2 * Math.PI * rand();
      spare = r * Math.sin(th);
      return r * Math.cos(th);
    };
    for (let d = 0; d < opt.draws; d++) {
      for (let i = 0; i < n; i++) {
        if (rows[i].composite === null) continue;
        let acc = 0;
        for (let j = 0; j < k; j++) {
          const sv = S[i * k + j];
          // Missing → could be anywhere: uniform on [0,100]. Present → Gaussian noise, clamped.
          let x = sv !== sv ? rand() * 100 : sv + SG[i * k + j] * gauss();
          x = x < 0 ? 0 : x > 100 ? 100 : x;
          if (p === 1) acc += W[j] * x;
          else if (p === 0) acc += W[j] * Math.log(x < 1 ? 1 : x);
          else acc += W[j] * Math.pow(p < 0 && x < 1 ? 1 : x, p);
        }
        const total = p === 1 ? acc / Wsum : p === 0 ? Math.exp(acc / Wsum) : Math.pow(acc / Wsum, 1 / p);
        comp[i] = total;
        drawsComposite[i].push(total);
      }
      for (const idx of poolIdx.values()) {
        idx.sort((a, b) => comp[b] - comp[a] || idOrder[a] - idOrder[b]);
        for (let r = 0; r < idx.length; r++) drawsRank[idx[r]].push(r + 1);
      }
    }
    for (let i = 0; i < n; i++) {
      const c = rows[i].composite;
      if (c === null) continue;
      const sorted = drawsComposite[i].sort((a, b) => a - b);
      bands[i] = {
        p10: Math.min(c, quantile(sorted, 0.1)),
        p90: Math.max(c, quantile(sorted, 0.9)),
      };
      if (eligible[i] && drawsRank[i].length > 0) {
        const rs = drawsRank[i].sort((a, b) => a - b);
        const rk = ranks[i] as number;
        rankBands[i] = {
          best: Math.min(rk, Math.round(quantile(rs, 0.1))),
          worst: Math.max(rk, Math.round(quantile(rs, 0.9))),
        };
      }
    }
  }

  // ---- Sensitivity: each active weight × (1 ± δ) -------------------------------------------
  const sens: (SensitivityResult | null)[] = ids.map(() => null);
  if (!opt.skipSensitivity && active.length > 1) {
    const byDim: Partial<Record<DimensionId, number>>[] = ids.map(() => ({}));
    for (const id of active) {
      for (const f of [1 - opt.sensitivityDelta, 1 + opt.sensitivityDelta]) {
        const comp = pointComposites(matrix, n, perturbWeight(weights, id, f), p);
        const r = rankOrder(ids, comp, eligible, pools);
        for (let i = 0; i < n; i++) {
          if (ranks[i] === null || r[i] === null) continue;
          const shift = Math.abs((r[i] as number) - (ranks[i] as number));
          byDim[i][id] = Math.max(byDim[i][id] ?? 0, shift);
        }
      }
    }
    // Threshold scales with pool size: ≥ fragileShift places or ≥ 5 % of the ranked pool.
    const poolSize = new Map<string, number>();
    ranks.forEach((r, i) => r !== null && poolSize.set(pools[i], (poolSize.get(pools[i]) ?? 0) + 1));
    for (let i = 0; i < n; i++) {
      if (ranks[i] === null) continue;
      const maxShift = Math.max(0, ...Object.values(byDim[i]).map((v) => v ?? 0));
      const threshold = Math.max(opt.fragileShift, Math.ceil(0.05 * (poolSize.get(pools[i]) ?? 0)));
      sens[i] = { maxShift, byDimension: byDim[i], fragile: maxShift >= threshold };
    }
  }

  return entities.map((e, i) => {
    const dimensionScores: Partial<Record<DimensionId, DimensionScore>> = {};
    for (const id of DIMENSION_IDS) {
      if (e.metrics[id] === undefined && matrix[id][i] === null) continue;
      dimensionScores[id] = { score: matrix[id][i], sigma: sigmas[id][i] };
    }
    return {
      id: e.id,
      pool: e.pool,
      composite: rows[i].composite,
      linearComposite: rows[i].linear,
      penalty: rows[i].penalty,
      coverage: rows[i].coverage,
      insufficientData: !eligible[i],
      contributions: rows[i].contributions,
      dimensionScores,
      band: bands[i],
      rank: ranks[i],
      rankBand: rankBands[i],
      sensitivity: sens[i],
    };
  });
}
