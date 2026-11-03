import type { DimensionId } from "./dimensions";
import type { Confidence, Datapoint, EduType, EntityKind, LanguageRegion, LocalizedText, MatchLevel, Route, Source } from "./schema";

/** Input ids — the individual sourced numbers behind the dimensions. */
export const INPUT_IDS = [
  "payEntry",
  "payMid",
  "paySenior",
  "payP25",
  "payP75",
  "unemploymentRate",
  "recruitmentDifficulty",
  "aiExposure",
  "nonCompletion",
  "entryAccess",
  "yearsToQualify",
  "nightWork",
  "weeklyHours",
  "telework",
  "mobility",
  "regionalUbiquity",
  "trainingRegions",
  "apprenticeWage",
] as const;
export type InputId = (typeof INPUT_IDS)[number];

export interface DatasetDatapoint extends Datapoint {
  /** Where the value was inherited from (entity id), for derived values. */
  inheritedFrom?: string;
}

export interface DatasetMetric {
  raw: number | null;
  confidence: Confidence;
  matchLevel: MatchLevel;
  /** Inputs that feed this dimension. */
  inputs: InputId[];
  /** Human-readable formula with the actual numbers plugged in. */
  formula: string;
}

export interface DatasetEntity {
  id: string;
  kind: EntityKind;
  route: Route;
  eduType?: EduType;
  name: LocalizedText;
  sector: string;
  codes: { isco08?: string; chIsco19?: string };
  leadsTo: string[];
  trainedVia: string[];
  languageRegions: LanguageRegion[];
  pathway: { label: string; years: number; sourceUrl: string; confidence: Confidence; note?: string }[];
  inputs: Partial<Record<InputId, DatasetDatapoint>>;
  metrics: Partial<Record<DimensionId, DatasetMetric>>;
  notes?: string;
}

export interface Dataset {
  version: string;
  generated: string;
  entities: DatasetEntity[];
  sources: (Source & { rawFiles?: { file: string; sha256: string; retrieved: string }[] })[];
  /** Spearman rank correlations between direction-adjusted dimension raw values (all entities). */
  correlations: Partial<Record<DimensionId, Partial<Record<DimensionId, number | null>>>>;
}
