/**
 * Data schema — single source of truth for entity files in /data/entities and for
 * the derived dataset consumed by the app. Every number carries provenance.
 */
import { z } from "zod";

export const CONFIDENCE = ["measured", "estimated", "expert-judgment"] as const;
export const Confidence = z.enum(CONFIDENCE);
export type Confidence = z.infer<typeof Confidence>;

/**
 * How closely a statistic matches the entity it is attached to.
 * `exact` — the statistic is about this very occupation/programme.
 * `isco4`…`isco1` — statistic is for the enclosing ISCO-08 / CH-ISCO-19 group at that level.
 * `field` — statistic is for a field of study / education field (e.g. BFS Fachbereichsgruppe).
 * `sector` — statistic is for an economic sector (NOGA section).
 * `education-level` — statistic is for an education level (e.g. "all EFZ").
 * `derived` — computed from other entities (e.g. an education path inheriting from target occupations).
 */
export const MATCH_LEVELS = [
  "exact",
  "isco4",
  "isco3",
  "isco2",
  "isco1",
  "field",
  "sector",
  "education-level",
  "derived",
] as const;
export const MatchLevel = z.enum(MATCH_LEVELS);
export type MatchLevel = z.infer<typeof MatchLevel>;

export const LANGUAGE_REGIONS = ["de", "fr", "it"] as const;
export const LanguageRegion = z.enum(LANGUAGE_REGIONS);
export type LanguageRegion = z.infer<typeof LanguageRegion>;

export const LOCALES = ["en", "de", "fr", "it"] as const;
export type Locale = (typeof LOCALES)[number];

export const LocalizedText = z.object({
  en: z.string().min(1),
  de: z.string().min(1),
  fr: z.string().min(1).nullable().default(null),
  it: z.string().min(1).nullable().default(null),
});
export type LocalizedText = z.infer<typeof LocalizedText>;

/** A single sourced datapoint. `value: null` means "missing" and must never be silently filled. */
export const Datapoint = z
  .object({
    value: z.number().nullable(),
    unit: z.string().min(1),
    sourceId: z.string().min(1),
    sourceUrl: z.url(),
    year: z.number().int().min(1990).max(2100),
    confidence: Confidence,
    matchLevel: MatchLevel,
    /** Human-readable label of the statistic actually used, e.g. "ISCO 72 Metallarbeiter…". */
    statisticLabel: z.string().optional(),
    n: z.number().int().positive().optional(),
    note: z.string().optional(),
  })
  .strict();
export type Datapoint = z.infer<typeof Datapoint>;

export const ENTITY_KINDS = ["occupation", "education"] as const;
export const EntityKind = z.enum(ENTITY_KINDS);
export type EntityKind = z.infer<typeof EntityKind>;

export const EDU_TYPES = [
  "NONE",
  "GYM",
  "FMS",
  "EBA",
  "EFZ",
  "BM",
  "BP",
  "HFP",
  "HF",
  "FH-BSc",
  "FH-MSc",
  "UH-BSc",
  "UH-MSc",
  "ETH-MSc",
  "UH-MMed",
  "DR",
] as const;
export const EduType = z.enum(EDU_TYPES);
export type EduType = z.infer<typeof EduType>;

export const Route = z.enum(["vocational", "academic", "mixed"]);
export type Route = z.infer<typeof Route>;

/**
 * Raw inputs per entity. Keys are input ids (see INPUT_DEFS in src/lib/dimensions.ts).
 * Hand-curated entity files may contain only some inputs; the build step adds ingested ones.
 */
export const RawInputs = z.record(z.string(), Datapoint);

export const EntityFile = z
  .object({
    id: z.string().regex(/^(occ|edu)-[a-z0-9-]+$/),
    kind: EntityKind,
    route: Route,
    eduType: EduType.optional(),
    name: LocalizedText,
    summary: LocalizedText.optional(),
    codes: z
      .object({
        /** ISCO-08 / CH-ISCO-19 4-digit unit group. */
        isco08: z.string().regex(/^\d{4}$/).optional(),
        /** CH-ISCO-19 5-digit Berufsart (SECO/AVAM). */
        chIsco19: z.string().regex(/^\d{4,5}$/).optional(),
      })
      .strict(),
    sector: z.string().min(1),
    /**
     * Keys used by the build step to join ingested statistics. Every key is optional; a missing
     * key means "no statistic available" and yields a null datapoint, never a guess.
     */
    refs: z
      .object({
        /** BESTA economic-division code used for recruitment difficulty, e.g. "86-88". */
        besta: z.string().optional(),
        /** Qualification level of the job / path for BESTA recruitment difficulty. */
        qualLevel: z.enum(["compulsory", "apprenticeship", "higherVet", "higherEducation"]).optional(),
        /** NOGA section letter(s) for SAKE tables by economic section (telework, hours). */
        nogaSection: z.string().regex(/^([A-U]|\*)$/).optional(), // "*" = whole economy
        /** Exact occupation name in BFS LABB certification table (VET only). */
        vetName: z.string().optional(),
        /** BFS study-success field: "UH:<Fachbereichsgruppe>" or "FH:<Fachbereich>". */
        studyField: z.string().optional(),
        /** BFS graduate-survey income field: "uh:Master:<field>" / "fh:Bachelor:<field>". */
        gradIncome: z.string().optional(),
        /** BFS graduate-survey ILO unemployment field: "uh:<ISCED field>" (UH master) / "fh:<ISCED field>" (FH bachelor). */
        gradField: z.string().optional(),
        /** SECO unemployment by education level, for paths without a target occupation. */
        eduLevel: z.enum(["Sekundarstufe I", "Sekundarstufe II", "Tertiärstufe"]).optional(),
        /** berufsberatung.ch page whose "continuing education" / "careers" links define the career graph. */
        infoPage: z.url().optional(),
        /** Direct entry into work after compulsory school (time to qualify = 0). */
        directEntry: z.boolean().optional(),
        /** BFS graduate income level override, e.g. "uh:Doktorat:<field>". Uses gradIncome otherwise. */
        /** LSE education category code (PXWeb px-x-0304010000_202) for paths without a target occupation. */
        lseEducation: z.string().optional(),
      })
      .strict()
      .default({}),
    /**
     * Shortest standard full-time route from the end of compulsory school, stage by stage.
     * Each stage cites the page stating its official minimum duration.
     */
    pathway: z
      .array(
        z
          .object({
            label: z.string(),
            years: z.number().positive().max(10),
            sourceUrl: z.url(),
            confidence: Confidence.default("measured"),
            note: z.string().optional(),
          })
          .strict(),
      )
      .default([]),
    /** education → occupations it typically leads to; occupation → typical training paths. */
    leadsTo: z.array(z.string()).default([]),
    trainedVia: z.array(z.string()).default([]),
    /** Language regions where the training is offered / the occupation is broadly practised. */
    languageRegions: z.array(LanguageRegion).min(1),
    /** Hand-curated datapoints (rubric scores etc.). Ingested statistics are joined at build time. */
    raw: RawInputs.default({}),
    meta: z
      .object({
        addedBy: z.string().min(1),
        reviewed: z.iso.date(),
        notes: z.string().optional(),
      })
      .strict(),
  })
  .strict();
export type EntityFile = z.infer<typeof EntityFile>;

export const Source = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    publisher: z.string(),
    title: z.string(),
    url: z.url(),
    year: z.number().int(),
    licence: z.string().optional(),
    retrieved: z.iso.date().optional(),
    /** Path of the raw file in /data/raw if the source was downloaded by an ingest script. */
    rawFile: z.string().optional(),
    sha256: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();
export type Source = z.infer<typeof Source>;
export const SourceRegistry = z.array(Source);
