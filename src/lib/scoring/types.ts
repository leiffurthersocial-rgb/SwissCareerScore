import type { DimensionId } from "../dimensions";
import type { Confidence, MatchLevel } from "../schema";

/** The per-dimension raw metric of one entity, as produced by the data build. */
export interface DimensionMetric {
  /** Raw value in the dimension's unit; null = missing (never imputed). */
  raw: number | null;
  confidence: Confidence;
  matchLevel: MatchLevel;
}

/** Minimal shape the engine needs. The app passes richer objects; extra fields are ignored. */
export interface ScorableEntity {
  id: string;
  /** Normalization pool. Percentiles are computed within a pool (e.g. "occupation" vs "education"). */
  pool: string;
  metrics: Partial<Record<DimensionId, DimensionMetric>>;
}

export type Weights = Partial<Record<DimensionId, number>>;

export interface DimensionScore {
  /** 0–100 percentile score, direction-adjusted (higher = better); null if raw missing. */
  score: number | null;
  /** 1σ uncertainty in percentile points, from confidence + match level. */
  sigma: number;
}

export interface Contribution {
  dimension: DimensionId;
  /** Effective weight share after renormalization over present dimensions (0–1). */
  effectiveWeight: number;
  /** User weight share before renormalization (0–1). */
  nominalWeight: number;
  score: number | null;
  /** effectiveWeight × score (points of composite), 0 if missing. */
  points: number;
}

export interface EntityResult {
  id: string;
  pool: string;
  composite: number | null;
  /** Plain weighted average before the flaw penalty. */
  linearComposite: number | null;
  /** Points lost to the flaw penalty (linearComposite − composite). */
  penalty: number;
  /** Share of total nominal weight that is backed by data (0–1). */
  coverage: number;
  insufficientData: boolean;
  contributions: Contribution[];
  dimensionScores: Partial<Record<DimensionId, DimensionScore>>;
  /** Monte-Carlo P10/P90 composite. */
  band: { p10: number; p90: number } | null;
  /** 1-based rank among sufficient-data entities in the ranked set (null if insufficient). */
  rank: number | null;
  /** Monte-Carlo P10/P90 rank (best/worst plausible). */
  rankBand: { best: number; worst: number } | null;
  sensitivity: SensitivityResult | null;
}

export interface SensitivityResult {
  /** Max absolute rank shift across all ±20% single-weight perturbations. */
  maxShift: number;
  /** Per-dimension worst shift, for display. */
  byDimension: Partial<Record<DimensionId, number>>;
  fragile: boolean;
}

export interface ScoreOptions {
  /** "absolute" (fixed value curves, default) or "relative" (percentile within pool). */
  mode?: import("./curves").ScoringMode;
  /** How hard weak dimensions pull the composite down. Default "moderate" (power mean p = 0.5). */
  flawPenalty?: import("./curves").FlawPenaltyId;
  /** Coverage threshold below which an entity is flagged "insufficient data". Default 0.6. */
  minCoverage?: number;
  /** Monte-Carlo draws for uncertainty bands. 0 disables. Default 400. */
  draws?: number;
  seed?: number;
  /** Relative weight perturbation for sensitivity analysis. Default 0.2 (±20%). */
  sensitivityDelta?: number;
  /** Rank shift at or above which an entity is flagged fragile. Default 3. */
  fragileShift?: number;
  /** Skip sensitivity analysis (cheaper for live slider drags). */
  skipSensitivity?: boolean;
}
