import { DIMENSIONS, DIMENSION_IDS, type DimensionId } from "../dimensions";
import type { Confidence, MatchLevel } from "../schema";
import { percentileRanksByPool } from "./normalize";
import { gaussian, mulberry32, quantile } from "./rng";
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
  minCoverage: 0.6,
  draws: 400,
  seed: 20261103,
  sensitivityDelta: 0.2,
  fragileShift: 3,
  skipSensitivity: false,
};

type ScoreMatrix = Record<DimensionId, (number | null)[]>;

/** Percentile scores for every dimension, computed within each entity's pool. */
export function computeDimensionScores(entities: ReadonlyArray<ScorableEntity>): ScoreMatrix {
  const pools = entities.map((e) => e.pool);
  const out = {} as ScoreMatrix;
  for (const id of DIMENSION_IDS) {
    const raw = entities.map((e) => e.metrics[id]?.raw ?? null);
    out[id] = percentileRanksByPool(raw, pools, DIMENSIONS[id].higherIsBetter);
  }
  return out;
}

interface CompositeRow {
  composite: number | null;
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
  return {
    composite: presentWeight > 0 ? composite : null,
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

function pointComposites(matrix: ScoreMatrix, n: number, weights: Weights): (number | null)[] {
  const shares = normalizeWeights(weights);
  const out: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    const s: Partial<Record<DimensionId, number | null>> = {};
    for (const id of DIMENSION_IDS) s[id] = matrix[id][i];
    out.push(compositeFor(s, shares).composite);
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
  const matrix = computeDimensionScores(entities);
  const shares = normalizeWeights(weights);
  const active = DIMENSION_IDS.filter((id) => shares[id] > 0);

  const rows = entities.map((_, i) => {
    const s: Partial<Record<DimensionId, number | null>> = {};
    for (const id of DIMENSION_IDS) s[id] = matrix[id][i];
    return compositeFor(s, shares);
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
    for (let d = 0; d < opt.draws; d++) {
      const comp: (number | null)[] = [];
      for (let i = 0; i < n; i++) {
        if (rows[i].composite === null) {
          comp.push(null);
          continue;
        }
        let total = 0;
        for (const id of active) {
          const s = matrix[id][i];
          // Missing → could be anywhere: uniform on [0,100]. Present → Gaussian noise, clamped.
          const x =
            s === null ? rand() * 100 : Math.min(100, Math.max(0, s + sigmas[id][i] * gaussian(rand)));
          total += shares[id] * x;
        }
        comp.push(total);
        drawsComposite[i].push(total);
      }
      const r = rankOrder(ids, comp, eligible, pools);
      r.forEach((rk, i) => rk !== null && drawsRank[i].push(rk));
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
        const comp = pointComposites(matrix, n, perturbWeight(weights, id, f));
        const r = rankOrder(ids, comp, eligible, pools);
        for (let i = 0; i < n; i++) {
          if (ranks[i] === null || r[i] === null) continue;
          const shift = Math.abs((r[i] as number) - (ranks[i] as number));
          byDim[i][id] = Math.max(byDim[i][id] ?? 0, shift);
        }
      }
    }
    for (let i = 0; i < n; i++) {
      if (ranks[i] === null) continue;
      const maxShift = Math.max(0, ...Object.values(byDim[i]).map((v) => v ?? 0));
      sens[i] = { maxShift, byDimension: byDim[i], fragile: maxShift >= opt.fragileShift };
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
