/**
 * Dimension catalogue. Pure data — shared by the scoring engine, build scripts and UI.
 * Formulas are documented in docs/methodology.md; ids here are stable API (used in URLs).
 */

export const DIMENSION_IDS = [
  "pay",
  "stability",
  "demand",
  "aiResilience",
  "trainingEase",
  "entryAccess",
  "timeToQualify",
  "careerGrowth",
  "workLifeBalance",
  "flexibility",
  "mobility",
  "regional",
  "meaning",
] as const;
export type DimensionId = (typeof DIMENSION_IDS)[number];

export interface DimensionDef {
  id: DimensionId;
  /** Short key for compact URL encoding. Must be unique and stable. */
  key: string;
  /** Does a higher raw value mean better for the user? Percentiles are flipped when false. */
  higherIsBetter: boolean;
  /** Whether the raw metric is an estimate by construction (shown with an "estimate" label). */
  alwaysEstimate: boolean;
  /** Unit of the raw composite metric shown in the UI. */
  unit: string;
}

export const DIMENSIONS: Record<DimensionId, DimensionDef> = {
  pay: { id: "pay", key: "pay", higherIsBetter: true, alwaysEstimate: false, unit: "CHF/month" },
  stability: {
    id: "stability",
    key: "stb",
    higherIsBetter: false, // raw = unemployment rate
    alwaysEstimate: false,
    unit: "%",
  },
  demand: {
    id: "demand",
    key: "dem",
    higherIsBetter: true, // raw = % of firms that found recruiting at this level hard or impossible
    alwaysEstimate: false,
    unit: "% firms",
  },
  aiResilience: {
    id: "aiResilience",
    key: "ai",
    higherIsBetter: false, // raw = exposure index
    alwaysEstimate: true,
    unit: "index 0–100",
  },
  trainingEase: {
    id: "trainingEase",
    key: "dif",
    higherIsBetter: false, // raw = non-completion / failure rate
    alwaysEstimate: false,
    unit: "%",
  },
  entryAccess: {
    id: "entryAccess",
    key: "cmp",
    higherIsBetter: false, // raw = admission-hurdle rubric 0–3
    alwaysEstimate: true,
    unit: "rubric 0–3",
  },
  timeToQualify: {
    id: "timeToQualify",
    key: "ttq",
    higherIsBetter: false, // raw = years after compulsory school
    alwaysEstimate: false,
    unit: "years",
  },
  careerGrowth: {
    id: "careerGrowth",
    key: "grw",
    higherIsBetter: true, // raw = wage ratio age 50+ / age ≤29
    alwaysEstimate: false,
    unit: "ratio",
  },
  workLifeBalance: {
    id: "workLifeBalance",
    key: "wlb",
    higherIsBetter: true, // raw = index 0–100 from night-work share and usual weekly hours (both inverted)
    alwaysEstimate: false,
    unit: "index 0–100",
  },
  flexibility: {
    id: "flexibility",
    key: "flx",
    higherIsBetter: true, // raw = % working from home at least occasionally
    alwaysEstimate: false,
    unit: "%",
  },
  mobility: {
    id: "mobility",
    key: "mob",
    higherIsBetter: true,
    alwaysEstimate: true,
    unit: "rubric 0–9",
  },
  regional: {
    id: "regional",
    key: "reg",
    higherIsBetter: true,
    alwaysEstimate: true,
    unit: "rubric 0–6",
  },
  meaning: {
    id: "meaning",
    key: "mng",
    higherIsBetter: true,
    alwaysEstimate: true,
    unit: "—",
  },
};

export const DIMENSION_BY_KEY: Record<string, DimensionId> = Object.fromEntries(
  Object.values(DIMENSIONS).map((d) => [d.key, d.id]),
);
