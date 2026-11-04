import { DIMENSION_IDS, type DimensionId } from "../dimensions";

/**
 * Absolute value curves: map a raw value onto 0–100 using fixed, documented anchors instead of
 * ranking it against the other entries. This keeps magnitude: a CHF 25,000/month job scores far
 * above a CHF 8,000 one even if both are "top 10 %".
 *
 *   t = (f(x) − f(worst)) / (f(best) − f(worst)),  clamped to [0, 1]
 *   score = 100 · t^gamma
 *
 * with f = identity (linear) or natural log (log curve: each doubling adds the same amount,
 * i.e. diminishing but never-ending returns — the standard model of utility from income).
 * `worst` may be larger than `best` for dimensions where lower raw values are better.
 */
export interface Curve {
  kind: "linear" | "log";
  worst: number;
  best: number;
  /** >1 makes the curve convex (you need to get close to `best` to score well), <1 concave. */
  gamma?: number;
  /** Why these anchors (shown in the methodology). */
  rationale: string;
}

export const ABSOLUTE_CURVES: Record<DimensionId, Curve> = {
  pay: {
    kind: "log",
    worst: 3500,
    best: 25000,
    rationale:
      "CHF/month. 3,500 ≈ below the low-wage threshold (2/3 of the 2024 median of 7,024); 25,000 ≈ CHF 300,000 a year. Log scale: every doubling of pay adds ~35 points (4,000→8,000 and 8,000→16,000 count the same).",
  },
  stability: {
    kind: "linear",
    worst: 8,
    best: 1,
    rationale: "Unemployment rate %. 1 % ≈ frictional minimum; 8 % ≈ the worst Swiss occupation groups (unskilled work).",
  },
  demand: {
    kind: "linear",
    worst: 15,
    best: 85,
    rationale: "% of firms reporting recruiting difficulties. Observed range in BESTA is roughly 15–85 %.",
  },
  aiResilience: {
    kind: "linear",
    worst: 75,
    best: 15,
    rationale: "Task-based exposure index. 75 ≈ mostly routine office work; 15 ≈ mostly physical/interpersonal non-routine work.",
  },
  trainingEase: {
    kind: "linear",
    worst: 25,
    best: 3,
    rationale: "% who do not complete the training. 3 % ≈ best observed; 25 % ≈ worst observed.",
  },
  entryAccess: { kind: "linear", worst: 3, best: 0, rationale: "Admission-hurdle rubric 0–3." },
  timeToQualify: {
    kind: "linear",
    worst: 11,
    best: 0,
    rationale: "Years after compulsory school. 0 = direct entry; 11 ≈ medicine incl. Matura.",
  },
  careerGrowth: {
    kind: "linear",
    worst: 1.0,
    best: 1.8,
    rationale: "Wage ratio age ≥50 / age ≤29. 1.0 = flat career; 1.8 ≈ steepest groups.",
  },
  workLifeBalance: { kind: "linear", worst: 0, best: 100, rationale: "Already an index 0–100." },
  flexibility: {
    kind: "linear",
    worst: 5,
    best: 85,
    rationale: "% working from home at least occasionally (sector). Observed range ≈ 10–82 %.",
  },
  mobility: { kind: "linear", worst: 0, best: 9, rationale: "Rubric 0–9." },
  regional: { kind: "linear", worst: 1, best: 6, rationale: "Rubric 1–6." },
  meaning: { kind: "linear", worst: 0, best: 100, rationale: "No data yet." },
};

export function applyCurve(x: number | null, c: Curve): number | null {
  if (x === null || !Number.isFinite(x)) return null;
  const f = c.kind === "log" ? (v: number) => Math.log(Math.max(v, 1e-9)) : (v: number) => v;
  const t = (f(x) - f(c.worst)) / (f(c.best) - f(c.worst));
  const clamped = Math.min(1, Math.max(0, t));
  return 100 * Math.pow(clamped, c.gamma ?? 1);
}

/** Flaw-penalty levels → exponent p of the weighted power mean (see aggregate.ts). */
export const FLAW_PENALTIES = [
  { id: "none", p: 1 },
  { id: "moderate", p: 0.5 },
  { id: "strong", p: 0 },
  { id: "severe", p: -1 },
] as const;
export type FlawPenaltyId = (typeof FLAW_PENALTIES)[number]["id"];
export const DEFAULT_FLAW_PENALTY: FlawPenaltyId = "moderate";
export function flawExponent(id: FlawPenaltyId): number {
  return FLAW_PENALTIES.find((f) => f.id === id)?.p ?? 1;
}

export type ScoringMode = "absolute" | "relative";
export const DEFAULT_SCORING_MODE: ScoringMode = "absolute";

void DIMENSION_IDS;
