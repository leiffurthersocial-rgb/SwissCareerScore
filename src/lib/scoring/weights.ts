import { DIMENSION_IDS, type DimensionId } from "../dimensions";
import type { Weights } from "./types";

/** Clamp negatives/NaN to 0 and return weights as shares summing to 1. All-zero → all zero. */
export function normalizeWeights(weights: Weights): Record<DimensionId, number> {
  const clean = {} as Record<DimensionId, number>;
  let total = 0;
  for (const id of DIMENSION_IDS) {
    const w = weights[id];
    const v = typeof w === "number" && Number.isFinite(w) && w > 0 ? w : 0;
    clean[id] = v;
    total += v;
  }
  if (total === 0) return clean;
  for (const id of DIMENSION_IDS) clean[id] = clean[id] / total;
  return clean;
}

/** Weights expressed as integer-ish percentages summing to 100 (for display / URLs). */
export function toPercentages(weights: Weights): Record<DimensionId, number> {
  const shares = normalizeWeights(weights);
  const out = {} as Record<DimensionId, number>;
  for (const id of DIMENSION_IDS) out[id] = shares[id] * 100;
  return out;
}

/**
 * Set one weight (in percent, 0–100) and rescale the *unlocked* other weights so the total stays
 * 100. Locked weights never change. If the requested value is infeasible (locked weights leave
 * less room), it is clamped. If all other unlocked weights are zero, the remainder is split evenly
 * among them.
 */
export function setWeight(
  current: Weights,
  locked: ReadonlySet<DimensionId>,
  id: DimensionId,
  valuePct: number,
  active: ReadonlyArray<DimensionId> = DIMENSION_IDS,
): Record<DimensionId, number> {
  const pct = toPercentages(current);
  const lockedTotal = active
    .filter((d) => d !== id && locked.has(d))
    .reduce((s, d) => s + pct[d], 0);
  const others = active.filter((d) => d !== id && !locked.has(d));
  const maxForId = others.length === 0 ? pct[id] : 100 - lockedTotal;
  const target = Math.min(Math.max(valuePct, 0), maxForId);
  const remaining = 100 - lockedTotal - target;
  const othersTotal = others.reduce((s, d) => s + pct[d], 0);
  const out = { ...pct };
  out[id] = target;
  for (const d of others) {
    out[d] = othersTotal > 0 ? (pct[d] / othersTotal) * remaining : remaining / others.length;
  }
  for (const d of DIMENSION_IDS) if (!active.includes(d)) out[d] = 0;
  return out;
}

/** Multiply a single weight by a factor and leave others unchanged (renormalized downstream). */
export function perturbWeight(weights: Weights, id: DimensionId, factor: number): Weights {
  return { ...weights, [id]: (weights[id] ?? 0) * factor };
}
