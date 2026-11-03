import { DIMENSION_IDS, type DimensionId } from "../dimensions";
import { percentileRanks } from "./normalize";

/**
 * Spearman rank correlation between two series, using only pairs where both are present.
 * Returns null when fewer than `minPairs` complete pairs exist.
 */
export function spearman(
  x: ReadonlyArray<number | null>,
  y: ReadonlyArray<number | null>,
  minPairs = 8,
): number | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < x.length; i++) {
    const a = x[i];
    const b = y[i];
    if (a !== null && b !== null && Number.isFinite(a) && Number.isFinite(b)) {
      xs.push(a);
      ys.push(b);
    }
  }
  if (xs.length < minPairs) return null;
  const rx = percentileRanks(xs) as number[];
  const ry = percentileRanks(ys) as number[];
  return pearson(rx, ry);
}

export function pearson(x: ReadonlyArray<number>, y: ReadonlyArray<number>): number | null {
  const n = x.length;
  if (n < 2) return null;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export type CorrelationMatrix = Partial<Record<DimensionId, Partial<Record<DimensionId, number | null>>>>;

/** Spearman matrix over direction-adjusted dimension scores (so + means "move together for the user"). */
export function correlationMatrix(
  scores: Record<DimensionId, ReadonlyArray<number | null>>,
): CorrelationMatrix {
  const m: CorrelationMatrix = {};
  for (const a of DIMENSION_IDS) {
    m[a] = {};
    for (const b of DIMENSION_IDS) {
      m[a]![b] = a === b ? 1 : spearman(scores[a] ?? [], scores[b] ?? []);
    }
  }
  return m;
}

export interface OverlapWarning {
  a: DimensionId;
  b: DimensionId;
  rho: number;
}

/** Pairs of *weighted* dimensions whose |ρ| exceeds the threshold — shown as double-counting warnings. */
export function overlapWarnings(
  matrix: CorrelationMatrix,
  activeDims: ReadonlyArray<DimensionId>,
  threshold = 0.6,
): OverlapWarning[] {
  const out: OverlapWarning[] = [];
  for (let i = 0; i < activeDims.length; i++) {
    for (let j = i + 1; j < activeDims.length; j++) {
      const a = activeDims[i];
      const b = activeDims[j];
      const rho = matrix[a]?.[b];
      if (rho !== null && rho !== undefined && Math.abs(rho) >= threshold) out.push({ a, b, rho });
    }
  }
  return out.sort((x, y) => Math.abs(y.rho) - Math.abs(x.rho));
}
