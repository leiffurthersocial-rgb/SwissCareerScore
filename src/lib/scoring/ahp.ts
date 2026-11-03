/**
 * Analytic Hierarchy Process (Saaty) — derive weights from pairwise "what matters more?" answers.
 *
 * judgments[i][j] = how much more important item i is than item j on Saaty's 1–9 scale
 * (reciprocals for the reverse). Weights = normalized principal eigenvector (power iteration).
 * Consistency ratio CR = CI / RI with CI = (λmax − n)/(n − 1); CR > 0.10 means answers are
 * noticeably inconsistent and the user should revisit them.
 */

/** Saaty random consistency index by matrix size (n = 1..10). */
export const RANDOM_INDEX = [0, 0, 0, 0.58, 0.9, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49];

export interface PairwiseJudgment {
  a: number; // index of item a
  b: number; // index of item b
  /** Positive: a is `value` times as important as b; values in [1/9, 9]. */
  value: number;
}

export function buildMatrix(n: number, judgments: ReadonlyArray<PairwiseJudgment>): number[][] {
  const m = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 1)));
  for (const { a, b, value } of judgments) {
    if (a === b || a < 0 || b < 0 || a >= n || b >= n) throw new Error(`invalid pair ${a},${b}`);
    const v = Math.min(9, Math.max(1 / 9, value));
    m[a][b] = v;
    m[b][a] = 1 / v;
  }
  return m;
}

export interface AhpResult {
  weights: number[];
  lambdaMax: number;
  consistencyIndex: number;
  consistencyRatio: number;
  consistent: boolean;
}

export function ahpWeights(matrix: ReadonlyArray<ReadonlyArray<number>>, iterations = 200): AhpResult {
  const n = matrix.length;
  if (n === 0) return { weights: [], lambdaMax: 0, consistencyIndex: 0, consistencyRatio: 0, consistent: true };
  let w = Array(n).fill(1 / n);
  for (let it = 0; it < iterations; it++) {
    const next = matrix.map((row) => row.reduce((s, v, j) => s + v * w[j], 0));
    const sum = next.reduce((s, v) => s + v, 0);
    const normalized = next.map((v) => v / sum);
    const delta = normalized.reduce((s, v, i) => s + Math.abs(v - w[i]), 0);
    w = normalized;
    if (delta < 1e-12) break;
  }
  const aw = matrix.map((row) => row.reduce((s, v, j) => s + v * w[j], 0));
  const lambdaMax = aw.reduce((s, v, i) => s + v / w[i], 0) / n;
  const ci = n > 1 ? (lambdaMax - n) / (n - 1) : 0;
  const ri = RANDOM_INDEX[n] ?? 1.49;
  const cr = ri > 0 ? ci / ri : 0;
  return { weights: w, lambdaMax, consistencyIndex: ci, consistencyRatio: cr, consistent: cr <= 0.1 };
}

/** All unordered pairs (i<j) for n items — the questions the wizard asks. */
export function allPairs(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
  return out;
}
