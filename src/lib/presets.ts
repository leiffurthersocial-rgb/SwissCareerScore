import type { DimensionId } from "./dimensions";

export const PRESET_IDS = [
  "balanced",
  "money",
  "security",
  "futureProof",
  "lowStress",
  "fastStart",
] as const;
export type PresetId = (typeof PRESET_IDS)[number];

/**
 * Weight presets in percent (they are re-normalized anyway).
 *
 * "balanced" uses equal weights across all dimensions that currently have data. Equal weighting is
 * the documented default for multi-criteria decisions when no validated importance ratings exist
 * for the target population (Dawes 1979, "The robust beauty of improper linear models"; OECD/JRC
 * Handbook on Constructing Composite Indicators 2008, §6). "meaning" has no defensible per-occupation
 * Swiss source yet, so it is 0 in every preset (opt-in only). See docs/methodology.md §4.
 */
export const PRESETS: Record<PresetId, Partial<Record<DimensionId, number>>> = {
  balanced: {
    pay: 1,
    stability: 1,
    demand: 1,
    aiResilience: 1,
    trainingEase: 1,
    entryAccess: 1,
    timeToQualify: 1,
    careerGrowth: 1,
    workLifeBalance: 1,
    flexibility: 1,
    mobility: 1,
    regional: 1,
    meaning: 0,
  },
  money: {
    pay: 40,
    careerGrowth: 20,
    stability: 10,
    demand: 10,
    aiResilience: 10,
    mobility: 5,
    timeToQualify: 5,
  },
  security: {
    stability: 30,
    demand: 20,
    aiResilience: 20,
    regional: 10,
    pay: 10,
    trainingEase: 5,
    entryAccess: 5,
  },
  futureProof: {
    aiResilience: 35,
    demand: 20,
    careerGrowth: 15,
    mobility: 10,
    stability: 10,
    flexibility: 10,
  },
  lowStress: {
    workLifeBalance: 35,
    flexibility: 15,
    stability: 15,
    trainingEase: 15,
    entryAccess: 10,
    pay: 10,
  },
  fastStart: {
    timeToQualify: 35,
    entryAccess: 15,
    trainingEase: 15,
    pay: 15,
    stability: 10,
    demand: 10,
  },
};
