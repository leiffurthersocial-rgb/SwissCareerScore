/**
 * Percentile-rank normalization.
 *
 * score_i = 100 · (r_i − 1) / (n − 1), where r_i is the 1-based *average* rank of value i among the
 * n non-null values (ties share the mean of the ranks they occupy). The lowest value maps to 0, the
 * highest to 100, ties get identical scores, and the result is invariant to any monotone
 * transformation of the raw data (no arbitrary min/max scaling, robust to outliers).
 * With n = 1 the single value gets 50 (no information to rank against).
 * Nulls stay null. When `higherIsBetter` is false the score is flipped (100 − score).
 */
export function percentileRanks(
  values: ReadonlyArray<number | null>,
  higherIsBetter = true,
): (number | null)[] {
  const present: { v: number; i: number }[] = [];
  values.forEach((v, i) => {
    if (v !== null && Number.isFinite(v)) present.push({ v, i });
  });
  const out: (number | null)[] = values.map(() => null);
  const n = present.length;
  if (n === 0) return out;
  if (n === 1) {
    out[present[0].i] = 50;
    return out;
  }
  present.sort((a, b) => a.v - b.v);
  let k = 0;
  while (k < n) {
    let j = k;
    while (j + 1 < n && present[j + 1].v === present[k].v) j++;
    const avgRank = (k + 1 + (j + 1)) / 2; // 1-based mean rank of the tie block
    const pct = (100 * (avgRank - 1)) / (n - 1);
    for (let t = k; t <= j; t++) out[present[t].i] = higherIsBetter ? pct : 100 - pct;
    k = j + 1;
  }
  return out;
}

/** Group indices by pool key and apply percentileRanks within each pool. */
export function percentileRanksByPool(
  values: ReadonlyArray<number | null>,
  pools: ReadonlyArray<string>,
  higherIsBetter = true,
): (number | null)[] {
  const out: (number | null)[] = values.map(() => null);
  const byPool = new Map<string, number[]>();
  pools.forEach((p, i) => {
    const arr = byPool.get(p) ?? [];
    arr.push(i);
    byPool.set(p, arr);
  });
  for (const idx of byPool.values()) {
    const ranks = percentileRanks(
      idx.map((i) => values[i]),
      higherIsBetter,
    );
    idx.forEach((i, k) => (out[i] = ranks[k]));
  }
  return out;
}
