/**
 * Build the app dataset: data/entities/*.json + data/ingested/*.json + data/inputs/*.json
 *   → data/derived/dataset.json
 *
 * Rules enforced here (the build fails otherwise):
 *  - every entity file validates against the zod schema;
 *  - every ref (vetName, studyField, gradIncome, BESTA code, ISCO code …) must resolve — a
 *    missing statistic is recorded as an explicit null datapoint, but a *typo* is an error;
 *  - every pathway stage's years must be stated on the cited berufsberatung.ch page;
 *  - no value is ever imputed: derived values are copied from a named entity and flagged.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DIMENSIONS, DIMENSION_IDS, type DimensionId } from "../src/lib/dimensions";
import type { Dataset, DatasetDatapoint, DatasetEntity, DatasetMetric, InputId } from "../src/lib/dataset-types";
import { EntityFile, type Confidence, type MatchLevel } from "../src/lib/schema";
import { correlationMatrix } from "../src/lib/scoring/correlation";
import { percentileRanks } from "../src/lib/scoring/normalize";
import { DAM, ASSETS, BFS_ASSET_PAGE } from "./ingest/bfs-dam";
import { LSE_EDU_URL, LSE_URL, METHODOLOGY_URL, SECO_STATS_URL, SECO_STMP_URL, SOURCES } from "./sources";

const ROOT = path.resolve(__dirname, "..");
const read = <T>(rel: string): T => JSON.parse(readFileSync(path.join(ROOT, rel), "utf8")) as T;

/* eslint-disable @typescript-eslint/no-explicit-any */
const lse = read<any>("data/ingested/bfs-lse-2024.json");
const lseEdu = read<any>("data/ingested/bfs-lse-2024-education.json");
const seco = read<any>("data/ingested/seco-unemployment.json");
const dam = read<any>("data/ingested/bfs-dam.json");
const bb = read<any>("data/ingested/berufsberatung.json");
const ai = read<any>("data/inputs/ai-task-content.json");
const manifest = read<Record<string, { sha256: string; retrieved: string }>>("data/raw/manifest.json");
/* eslint-enable @typescript-eslint/no-explicit-any */

const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);

// ------------------------------------------------------------------ load entity files
const entityDir = path.join(ROOT, "data", "entities");
const files = readdirSync(entityDir).filter((f) => f.endsWith(".json")).sort();
const entities: EntityFile[] = [];
for (const f of files) {
  const parsed = EntityFile.safeParse(JSON.parse(readFileSync(path.join(entityDir, f), "utf8")));
  if (!parsed.success) {
    fail(`${f}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    continue;
  }
  if (`${parsed.data.id}.json` !== f) fail(`${f}: file name must equal id`);
  entities.push(parsed.data);
}
const byId = new Map(entities.map((e) => [e.id, e]));
for (const e of entities) {
  for (const ref of [...e.leadsTo, ...e.trainedVia]) if (!byId.has(ref)) fail(`${e.id}: unknown reference ${ref}`);
  if (e.kind === "occupation" && e.trainedVia.length === 0) fail(`${e.id}: occupation needs trainedVia`);
  if (e.kind === "education" && e.pathway.length === 0) fail(`${e.id}: education path needs a pathway`);
}

// ------------------------------------------------------------------ helpers
const dp = (
  value: number | null,
  unit: string,
  sourceId: string,
  sourceUrl: string,
  year: number,
  confidence: Confidence,
  matchLevel: MatchLevel,
  statisticLabel?: string,
  note?: string,
): DatasetDatapoint => ({
  value: value === null ? null : Math.round(value * 100) / 100,
  unit,
  sourceId,
  sourceUrl,
  year,
  confidence,
  matchLevel,
  ...(statisticLabel ? { statisticLabel } : {}),
  ...(note ? { note } : {}),
});
const CONF_ORDER: Confidence[] = ["measured", "estimated", "expert-judgment"];
const worstConf = (cs: Confidence[]) => cs.reduce((a, b) => (CONF_ORDER.indexOf(b) > CONF_ORDER.indexOf(a) ? b : a), "measured" as Confidence);
const MATCH_ORDER: MatchLevel[] = ["exact", "isco4", "isco3", "isco2", "field", "derived", "isco1", "sector", "education-level"];
const worstMatch = (ms: MatchLevel[]) => ms.reduce((a, b) => (MATCH_ORDER.indexOf(b) > MATCH_ORDER.indexOf(a) ? b : a), "exact" as MatchLevel);

const SECTION_KEY = (letter: string, keys: string[]): string | undefined =>
  keys.find((k) => k === letter) ??
  keys.find((k) => k.split("/").includes(letter)) ??
  keys.find((k) => {
    const m = k.match(/^([A-Z])-([A-Z])$/);
    return m ? letter >= m[1] && letter <= m[2] : false;
  });

// ------------------------------------------------------------------ own (non-derived) inputs
type Inputs = Partial<Record<InputId, DatasetDatapoint>>;

function lseInputs(isco08: string): Inputs {
  const g = lse.groups[isco08.slice(0, 2)];
  if (!g) {
    fail(`ISCO ${isco08}: 2-digit group not in LSE`);
    return {};
  }
  const label = `LSE 2024, ISCO ${g.label}`;
  const v = (age: string, pct = "Zentralwert") => g.values[age]?.[pct] ?? null;
  const mk = (val: number | null, what: string) =>
    dp(val, "CHF/month", "bfs-lse-2024", LSE_URL, 2024, "measured", "isco2", `${label} — ${what}`, "Full-time equivalent gross monthly wage incl. 1/12 of 13th salary; private and public sector.");
  return {
    payEntry: mk(v("<=29 Jahre"), "median, age ≤29"),
    payMid: mk(v("30-49 Jahre"), "median, age 30–49"),
    paySenior: mk(v("> =50 Jahre"), "median, age ≥50"),
    payP25: mk(v("Lebensalter - Total", "P25"), "P25, all ages"),
    payP75: mk(v("Lebensalter - Total", "P75"), "P75, all ages"),
  };
}

function unemploymentInput(isco08: string): DatasetDatapoint {
  const rows = seco.stmp.rows as Record<string, { code: string; name: string; rate: number }>;
  const candidates = [isco08 + "0", isco08];
  const hit = Object.values(rows).find((r) => candidates.includes(r.code) || (r.code.length === 4 && isco08 === r.code));
  if (hit)
    return dp(hit.rate, "%", "seco-stmp-2027", SECO_STMP_URL, 2026, "measured", "isco4", `SECO Berufsart ${hit.code} ${hit.name}`, "Registered unemployed ÷ employed, Q4 2025 – Q3 2026.");
  const major = seco.majorGroups.average[isco08[0]];
  if (!major) {
    fail(`ISCO ${isco08}: no SECO major group`);
    return dp(null, "%", "seco-lage-2026", SECO_STATS_URL, 2026, "measured", "isco1");
  }
  const capped = Math.min(major.rate, 4.9);
  return dp(
    capped,
    "%",
    "seco-lage-2026",
    SECO_STATS_URL,
    2026,
    "measured",
    "isco1",
    `SECO Berufshauptgruppe ${isco08[0]} ${major.label} (avg. of ${major.months} monthly reports)`,
    capped < major.rate
      ? `Major-group rate ${major.rate}% capped at 4.9%: this occupation type is not on SECO's list of occupations ≥ 5%.`
      : "Occupation type not on SECO's list of occupations with ≥ 5 % unemployment, so its own rate is < 5 %; the major-group rate is used as the best available estimate.",
  );
}

function recruitmentInput(besta: string | undefined, level: string | undefined): DatasetDatapoint | undefined {
  if (!level) return undefined;
  const levelKey = { apprenticeship: "apprenticeship", higherVet: "higherVet", higherEducation: "higherEducation" }[level]!;
  const asset = { apprenticeship: ASSETS.recruitApprentice, higherVet: ASSETS.recruitHigherVet, higherEducation: ASSETS.recruitHigherEd }[level]!;
  const levelLabel = { apprenticeship: "Berufslehre", higherVet: "höhere Berufsbildung", higherEducation: "Hochschulabschluss" }[level];
  if (!besta) return dp(null, "% firms", "bfs-besta-recruitment", BFS_ASSET_PAGE(asset), 2026, "measured", "sector", undefined, "Sector not covered by BESTA (e.g. agriculture).");
  const row = dam.recruitment[levelKey][besta];
  if (!row) {
    fail(`BESTA code ${besta} not found`);
    return undefined;
  }
  return dp(row.difficultyPct, "% firms", "bfs-besta-recruitment", BFS_ASSET_PAGE(asset), 2026, "measured", "sector", `BESTA ${besta} ${row.label || ""} — staff with ${levelLabel}`.trim(), "Share of firms (weighted by employment) that found recruiting staff at this qualification level difficult or impossible, among firms that recruited; mean of the last 4 quarters.");
}

function sectionInputs(letter: string | undefined): Inputs {
  if (!letter) return {};
  const out: Inputs = {};
  const tk = SECTION_KEY(letter, Object.keys(dam.telework.bySection));
  if (!tk) fail(`NOGA ${letter}: no telework row`);
  else
    out.telework = dp(dam.telework.bySection[tk].pct, "%", "bfs-sake-telework", BFS_ASSET_PAGE(ASSETS.telework), dam.telework.year, "measured", "sector", `SAKE ${dam.telework.year}, NOGA ${tk} ${dam.telework.bySection[tk].label}`, "Employed persons doing telework from home at least occasionally.");
  const hk = SECTION_KEY(letter, Object.keys(dam.hours.bySection));
  if (!hk) fail(`NOGA ${letter}: no hours row`);
  else
    out.weeklyHours = dp(dam.hours.bySection[hk].hours, "h/week", "bfs-sake-hours", BFS_ASSET_PAGE(ASSETS.hours), dam.hours.year, "measured", "sector", `Usual weekly hours of full-time employees ${dam.hours.year}, NOGA ${hk} ${dam.hours.bySection[hk].label}`);
  return out;
}

function nightInput(isco08: string): DatasetDatapoint {
  const r = dam.nightWork.byIsco1[isco08[0]];
  return dp(r?.nightPct ?? null, "%", "bfs-sake-night-2013", BFS_ASSET_PAGE(ASSETS.nightWork), 2013, "estimated", "isco1", r ? `SAKE 2013, ISCO major group ${isco08[0]} ${r.label}` : undefined, "Employed persons usually or sometimes working nights. Latest occupation breakdown published by BFS is 2013, hence 'estimated'.");
}

function aiInput(isco08: string): DatasetDatapoint {
  const o = ai.occupations[isco08];
  if (!o) {
    fail(`ISCO ${isco08}: no AI task-content entry`);
    return dp(null, "index 0–100", "ai-task-content", `${METHODOLOGY_URL}#4-ai--automation-resilience`, 2026, "expert-judgment", "isco4");
  }
  const s = o.shares as Record<string, number>;
  const w = ai.weights as Record<string, number>;
  const exposure = Object.keys(w).reduce((sum, k) => sum + (s[k] ?? 0) * w[k], 0);
  return dp(exposure, "index 0–100", "ai-task-content", `${METHODOLOGY_URL}#4-ai--automation-resilience`, 2026, "expert-judgment", "isco4", `ISCO ${isco08} ${o.label}: NRA ${s.NRA}%, NRI ${s.NRI}%, RC ${s.RC}%, RM ${s.RM}%, NRM ${s.NRM}%`, `Estimate. ${o.rationale}`);
}

function educationOwnInputs(e: EntityFile): Inputs {
  const out: Inputs = {};
  // time to qualify — sum of pathway stages, each verified against the cited page
  let years = 0;
  const confs: Confidence[] = [];
  for (const s of e.pathway) {
    years += s.years;
    confs.push(s.confidence);
    const page = bb.pages[s.sourceUrl];
    if (s.sourceUrl.includes("berufsberatung.ch")) {
      if (!page) fail(`${e.id}: page not ingested ${s.sourceUrl} (run npm run data:ingest)`);
      else if (!page.yearsMentioned.includes(s.years))
        fail(`${e.id}: stage "${s.label}" = ${s.years} y not stated on ${s.sourceUrl} (page says: ${page.durationSnippets.join(" / ")})`);
    }
  }
  out.yearsToQualify = dp(years, "years", "berufsberatung", e.pathway[e.pathway.length - 1].sourceUrl, 2026, worstConf(confs), "exact", e.pathway.map((s) => `${s.label} (${s.years} y)`).join(" + "), "Shortest standard full-time route after compulsory school. Bridging years, gap years and specialist training are not included.");
  // apprentice wage (display only)
  const last = bb.pages[e.pathway[e.pathway.length - 1].sourceUrl];
  if ((e.eduType === "EFZ" || e.eduType === "EBA") && last?.apprenticeWages?.length) {
    const lastYear = last.apprenticeWages[last.apprenticeWages.length - 1];
    const nums = String(lastYear.chf).match(/\d[\d’']*/g)?.map((x: string) => Number(x.replace(/[’']/g, ""))) ?? [];
    const val = nums.length ? nums.reduce((a: number, b: number) => a + b, 0) / nums.length : null;
    out.apprenticeWage = dp(val, "CHF/month", "berufsberatung", e.pathway[e.pathway.length - 1].sourceUrl, 2026, "measured", "exact", `Recommended apprentice wage, final year: CHF ${lastYear.chf}`, "Recommendation of the professional association; varies by region and employer. Display only, not scored.");
  }
  // training completion
  if (e.refs.vetName) {
    const r = dam.vetCertification.byOccupation[e.refs.vetName];
    if (!r) fail(`${e.id}: vetName "${e.refs.vetName}" not in BFS table`);
    else
      out.nonCompletion = dp(r.nonCompletionPct, "%", "bfs-labb-vet-certification", BFS_ASSET_PAGE(ASSETS.vetCertification), 2024, "measured", "exact", `${e.refs.vetName}: failed final exam ${r.failedPct}% + left VET system ${r.leftSystemPct}% (cohort ${dam.vetCertification.cohort}, n=${r.learners})`, `Status ${dam.vetCertification.observedUntil}; ${r.stillInTrainingPct}% were still in training and are not counted.`);
  } else if (e.refs.studyField) {
    const [type, field] = e.refs.studyField.split(":");
    const r = dam.studySuccess.byType[type]?.[field];
    if (!r) fail(`${e.id}: studyField "${e.refs.studyField}" not in BFS table`);
    else
      out.nonCompletion = dp(r.noSuccessPct, "%", "bfs-labb-study-success", BFS_ASSET_PAGE(ASSETS.studySuccess), 2025, "measured", "field", `${type} ${field}: no bachelor degree within 8 years`, "Bachelor entrants; a degree in another field or at another type of higher education institution counts as success.");
  } else {
    out.nonCompletion = dp(null, "%", "bfs-labb-study-success", BFS_ASSET_PAGE(ASSETS.studySuccess), 2025, "measured", "education-level", undefined, "No completion statistic published for this programme type.");
  }
  // graduate income (entry pay) for higher-education paths
  if (e.refs.gradIncome) {
    const [t, level, field] = e.refs.gradIncome.split(":");
    const r = dam.gradIncome[t]?.byLevel?.[level]?.[field];
    if (!r || r.median === null) fail(`${e.id}: gradIncome "${e.refs.gradIncome}" not in BFS table`);
    else {
      const label = `EHA, ${t.toUpperCase()} ${level} ${field}, graduates ${dam.gradIncome[t].year}, 1 year after degree`;
      const mk = (v: number | null, what: string) => dp(v === null ? null : v / 12, "CHF/month", "bfs-eha-grad-income", BFS_ASSET_PAGE(ASSETS.gradIncome), dam.gradIncome[t].year + 1, "measured", "field", `${label} — ${what} (annual ÷ 12)`, "Standardised gross annual income for a full-time position, divided by 12 to compare with LSE monthly wages.");
      out.payEntry = mk(r.median, "median");
    }
  }
  // own rubric
  if (e.raw.entryAccess) out.entryAccess = { ...e.raw.entryAccess } as DatasetDatapoint;
  out.trainingRegions = dp(e.languageRegions.length, "language regions", "berufsberatung", "https://www.berufsberatung.ch/", 2026, "expert-judgment", "exact", `Offered in: ${e.languageRegions.join(", ")}`);
  return out;
}

function occupationOwnInputs(e: EntityFile): Inputs {
  const isco = e.codes.isco08!;
  const out: Inputs = {
    ...lseInputs(isco),
    unemploymentRate: unemploymentInput(isco),
    aiExposure: aiInput(isco),
    nightWork: nightInput(isco),
    ...sectionInputs(e.refs.nogaSection),
  };
  const rec = recruitmentInput(e.refs.besta, e.refs.qualLevel);
  if (rec) out.recruitmentDifficulty = rec;
  if (e.raw.mobility) out.mobility = { ...e.raw.mobility } as DatasetDatapoint;
  if (e.raw.regionalUbiquity) out.regionalUbiquity = { ...e.raw.regionalUbiquity } as DatasetDatapoint;
  out.trainingRegions = dp(e.languageRegions.length, "language regions", "berufsberatung", "https://www.berufsberatung.ch/", 2026, "expert-judgment", "exact", `Practised/trained in: ${e.languageRegions.join(", ")}`);
  return out;
}

// ------------------------------------------------------------------ assemble inputs with inheritance
const own = new Map<string, Inputs>();
for (const e of entities) own.set(e.id, e.kind === "occupation" ? occupationOwnInputs(e) : educationOwnInputs(e));

const OUTCOME_INPUTS: InputId[] = ["payEntry", "payMid", "paySenior", "payP25", "payP75", "unemploymentRate", "aiExposure", "nightWork", "mobility", "regionalUbiquity"];
const TRAINING_INPUTS: InputId[] = ["yearsToQualify", "nonCompletion", "entryAccess"];

function inherit(dpIn: DatasetDatapoint, from: string): DatasetDatapoint {
  return { ...dpIn, matchLevel: "derived", inheritedFrom: from, note: [`Inherited from ${from}.`, dpIn.note].filter(Boolean).join(" ") };
}

const allInputs = new Map<string, Inputs>();
for (const e of entities) {
  const mine: Inputs = { ...own.get(e.id)! };
  if (e.kind === "education") {
    const target = e.leadsTo[0];
    if (target) {
      const t = own.get(target)!;
      for (const k of OUTCOME_INPUTS) if (!mine[k] && t[k]) mine[k] = inherit(t[k]!, target);
      // Demand/sector inputs use the path's own qualification level in the target's sector.
      const rec = recruitmentInput(e.refs.besta, e.refs.qualLevel);
      if (rec) mine.recruitmentDifficulty = rec;
      Object.assign(mine, sectionInputs(e.refs.nogaSection));
    } else if (e.refs.lseEducation) {
      const r = lseEdu.byEducation[e.refs.lseEducation];
      if (!r) fail(`${e.id}: lseEducation ${e.refs.lseEducation} not found`);
      else {
        const mk = (v: number | null, what: string) => dp(v, "CHF/month", "bfs-lse-2024-education", LSE_EDU_URL, 2024, "measured", "education-level", `LSE 2024, highest education: ${r.label} — ${what}`, "No age breakdown available: the all-ages median is used for both entry and mid-career pay.");
        mine.payEntry = mk(r.values.Zentralwert, "median, all ages");
        mine.payMid = mk(r.values.Zentralwert, "median, all ages");
        mine.payP25 = mk(r.values.P25, "P25");
        mine.payP75 = mk(r.values.P75, "P75");
      }
      const rec = recruitmentInput(e.refs.besta, e.refs.qualLevel);
      if (rec) mine.recruitmentDifficulty = rec;
      Object.assign(mine, sectionInputs(e.refs.nogaSection));
    }
  } else {
    const via = e.trainedVia[0];
    const t = own.get(via)!;
    for (const k of TRAINING_INPUTS) if (!mine[k] && t[k]) mine[k] = inherit(t[k]!, via);
  }
  allInputs.set(e.id, mine);
}

// ------------------------------------------------------------------ dimension metrics
const fmt = (x: number | null | undefined, d = 1) => (x === null || x === undefined ? "n/a" : Number(x).toFixed(d));

// WLB sub-indicator percentiles across the whole dataset (lower night share / hours = better)
const ids = entities.map((e) => e.id);
const nightVals = ids.map((id) => allInputs.get(id)!.nightWork?.value ?? null);
const hourVals = ids.map((id) => allInputs.get(id)!.weeklyHours?.value ?? null);
const nightPct = percentileRanks(nightVals, false);
const hourPct = percentileRanks(hourVals, false);

function metricsFor(e: EntityFile, idx: number): Partial<Record<DimensionId, DatasetMetric>> {
  const I = allInputs.get(e.id)!;
  const m: Partial<Record<DimensionId, DatasetMetric>> = {};
  const from = (inputs: InputId[], raw: number | null, formula: string): DatasetMetric => {
    const dps = inputs.map((k) => I[k]).filter((x): x is DatasetDatapoint => !!x);
    return {
      raw: raw === null || !Number.isFinite(raw) ? null : Math.round(raw * 1000) / 1000,
      confidence: worstConf(dps.map((d) => d.confidence)),
      matchLevel: worstMatch(dps.map((d) => d.matchLevel)),
      inputs,
      formula,
    };
  };
  const v = (k: InputId) => I[k]?.value ?? null;

  const entry = v("payEntry");
  const mid = v("payMid");
  m.pay = from(["payEntry", "payMid"], entry !== null && mid !== null ? 0.35 * entry + 0.65 * mid : null, `0.35 × entry ${fmt(entry, 0)} + 0.65 × mid-career ${fmt(mid, 0)} CHF/month`);
  m.stability = from(["unemploymentRate"], v("unemploymentRate"), `registered unemployment rate ${fmt(v("unemploymentRate"))} %`);
  if (I.recruitmentDifficulty) m.demand = from(["recruitmentDifficulty"], v("recruitmentDifficulty"), `${fmt(v("recruitmentDifficulty"))} % of firms found recruiting hard or impossible`);
  m.aiResilience = from(["aiExposure"], v("aiExposure"), `task-based exposure index ${fmt(v("aiExposure"))} (lower = more resilient)`);
  m.trainingEase = from(["nonCompletion"], v("nonCompletion"), `${fmt(v("nonCompletion"))} % did not complete`);
  m.entryAccess = from(["entryAccess"], v("entryAccess"), `admission hurdle ${fmt(v("entryAccess"), 0)} on 0–3 rubric`);
  m.timeToQualify = from(["yearsToQualify"], v("yearsToQualify"), `${fmt(v("yearsToQualify"))} years after compulsory school`);
  const senior = v("paySenior");
  const entryLse = I.payEntry?.sourceId === "bfs-lse-2024" ? entry : (e.kind === "education" ? allInputs.get(e.leadsTo[0] ?? "")?.payEntry?.value ?? null : null);
  const growthEntry = e.kind === "occupation" ? entry : entryLse;
  m.careerGrowth = from(["paySenior", "payEntry"], senior !== null && growthEntry ? senior / growthEntry : null, `median age ≥50 ${fmt(senior, 0)} ÷ median age ≤29 ${fmt(growthEntry, 0)} (LSE, same ISCO group)`);
  const np = nightPct[idx];
  const hp = hourPct[idx];
  m.workLifeBalance = from(["nightWork", "weeklyHours"], np !== null && hp !== null ? (np + hp) / 2 : null, `mean of percentile(low night-work share ${fmt(v("nightWork"))} %) = ${fmt(np, 0)} and percentile(low weekly hours ${fmt(v("weeklyHours"), 2)} h) = ${fmt(hp, 0)}`);
  m.flexibility = from(["telework"], v("telework"), `${fmt(v("telework"))} % of employed in the sector work from home at least occasionally`);
  m.mobility = from(["mobility"], v("mobility"), `rubric ${fmt(v("mobility"), 0)} / 9`);
  const ub = v("regionalUbiquity");
  const tr = v("trainingRegions");
  m.regional = from(["regionalUbiquity", "trainingRegions"], ub !== null && tr !== null ? ub + tr : null, `spatial ubiquity ${fmt(ub, 0)}/3 + language regions ${fmt(tr, 0)}/3`);
  // meaning: no defensible per-occupation Swiss source (see methodology) → explicit null
  m.meaning = { raw: null, confidence: "expert-judgment", matchLevel: "exact", inputs: [], formula: "no defensible data source yet — dimension disabled by default" };
  return m;
}

const out: DatasetEntity[] = entities.map((e, idx) => ({
  id: e.id,
  kind: e.kind,
  route: e.route,
  ...(e.eduType ? { eduType: e.eduType } : {}),
  name: e.name,
  sector: e.sector,
  codes: e.codes,
  leadsTo: e.leadsTo,
  trainedVia: e.trainedVia,
  languageRegions: e.languageRegions,
  pathway: e.pathway,
  inputs: allInputs.get(e.id)!,
  metrics: metricsFor(e, idx),
  ...(e.meta.notes ? { notes: e.meta.notes } : {}),
}));

// ------------------------------------------------------------------ correlations
const dirScores = {} as Record<DimensionId, (number | null)[]>;
for (const d of DIMENSION_IDS) {
  dirScores[d] = percentileRanks(out.map((e) => e.metrics[d]?.raw ?? null), DIMENSIONS[d].higherIsBetter);
}
const corr = correlationMatrix(dirScores);
for (const a of DIMENSION_IDS) for (const b of DIMENSION_IDS) {
  const r = corr[a]?.[b];
  if (r !== null && r !== undefined) corr[a]![b] = Math.round(r * 100) / 100;
}

// ------------------------------------------------------------------ sources
const usedSources = new Set(out.flatMap((e) => Object.values(e.inputs).map((d) => d!.sourceId)));
for (const s of usedSources) if (!SOURCES.find((x) => x.id === s)) fail(`unknown sourceId ${s}`);
const sources = SOURCES.map(({ rawFiles, ...s }) => ({
  ...s,
  rawFiles: (rawFiles ?? []).map((f) => {
    const m = manifest[f];
    if (!m) fail(`raw file ${f} missing from manifest`);
    return { file: `data/raw/${f}`, sha256: m?.sha256 ?? "", retrieved: m?.retrieved ?? "" };
  }),
}));

if (errors.length) {
  console.error(`\n✖ build-data: ${errors.length} problem(s)\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}

const dataset: Dataset = {
  version: "1.0.0",
  generated: new Date().toISOString().slice(0, 10),
  entities: out,
  sources,
  correlations: corr,
};
const target = path.join(ROOT, "data", "derived", "dataset.json");
if (process.argv.includes("--check")) {
  // CI mode: the committed dataset must equal a fresh build (ignoring the build date).
  const strip = (d: Dataset) => JSON.stringify({ ...d, generated: "" });
  if (!existsSync(target) || strip(JSON.parse(readFileSync(target, "utf8"))) !== strip(dataset)) {
    console.error("✖ data/derived/dataset.json is stale — run `npm run data:build` and commit the result.");
    process.exit(1);
  }
  console.log(`✔ dataset.json is up to date (${out.length} entities, all references and pathway durations verified)`);
  process.exit(0);
}
mkdirSync(path.join(ROOT, "data", "derived"), { recursive: true });
writeFileSync(target, JSON.stringify(dataset, null, 1) + "\n");

// summary
const coverage = DIMENSION_IDS.map((d) => `${d}: ${out.filter((e) => e.metrics[d]?.raw !== null && e.metrics[d]?.raw !== undefined).length}/${out.length}`);
console.log(`✔ dataset.json — ${out.length} entities (${out.filter((e) => e.kind === "occupation").length} occupations)\n  coverage ${coverage.join(", ")}`);
void DAM;
