import type { DimensionId } from "./dimensions";
import type { Confidence, Datapoint, EduType, EntityKind, LanguageRegion, LocalizedText, MatchLevel, Route, Source } from "./schema";

/** Input ids — the individual sourced numbers behind the dimensions. */
export const INPUT_IDS = [
  "payEntry",
  "payMid",
  "paySenior",
  "payP25",
  "payP75",
  "payP90",
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
  "payMidExpert",
  "teleworkExpert",
  "wlbExpert",
  "demandExpert",
  "aiExpert",
  "payEntryExpert",
  "unemploymentExpert",
  "nonCompletionExpert",
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
  /** education: occupations it leads to (target + berufsberatung.ch "careers after the degree"). */
  careers?: string[];
  /** education: further qualifications it gives access to (berufsberatung.ch "continuing education"). */
  nextSteps?: string[];
  /** occupation: education paths leading to it. */
  entryPaths?: string[];
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

/** Compact per-entity record shipped to the browser (ranking, filters, scoring). */
export interface CoreEntity {
  id: string;
  kind: EntityKind;
  route: Route;
  eduType?: EduType;
  name: LocalizedText;
  sector: string;
  languageRegions: LanguageRegion[];
  leadsTo: string[];
  trainedVia: string[];
  careers?: string[];
  nextSteps?: string[];
  entryPaths?: string[];
  /** dimension → [raw, confidence initial (m|e|x), match level] */
  m: Partial<Record<DimensionId, [number | null, "m" | "e" | "x", MatchLevel]>>;
  /** years to qualify */
  y: number | null;
  /** median mid-career pay */
  p: number | null;
}

export interface CoreDataset {
  version: string;
  generated: string;
  entities: CoreEntity[];
  sources: Source[];
  correlations: Dataset["correlations"];
}

/** Higher-education programme catalogue (data/derived/programmes.json). */
export type Admission = "open" | "ems" | "selection" | "work";
export interface Institution {
  name: string;
  short: string;
  type: "ETH" | "UH" | "FH" | "PH";
  city: string;
  languages: string[];
  url: string;
  /** Regional pay level where graduates typically work (1 = Swiss median), own estimate. */
  regionPay: number;
  /** BFS major regions where it teaches. */
  regions: string[];
}
/** One institution offering a programme, with institution-level pay estimates. */
export interface Offer {
  institution: string;
  /** Clearly stronger with employers in this field (own judgment). */
  strong: boolean;
  premium: number;
  note?: string;
  factor: number;
  payEntry: number | null;
  payMid: number | null;
}
/** A blended number: official statistic, own estimate, and the value used for scoring. */
export interface Blended {
  stat: number | null;
  est: number | null;
  value: number | null;
}
export interface Programme {
  id: string;
  group: string;
  entity: string;
  name: { en: string; de: string };
  type: "ETH" | "UH" | "FH" | "PH";
  institutions: string[];
  admission: Admission;
  years: number;
  masterOnly: boolean;
  note?: string;
  offers: Offer[];
  payEntry: Blended;
  payMid: Blended;
  unemployment: Blended;
  nonCompletion: Blended;
}
export interface ProgrammeCatalogue {
  sourceUrl: string;
  year: number;
  groups: Record<string, { en: string; de: string }>;
  institutions: Record<string, Institution>;
  programmes: Programme[];
}
