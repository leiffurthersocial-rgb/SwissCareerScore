import { describe, expect, it } from "vitest";
import data from "./derived/dataset.json";
import type { Dataset } from "../src/lib/dataset-types";
import { DIMENSION_IDS } from "../src/lib/dimensions";
import { Datapoint } from "../src/lib/schema";

const ds = data as unknown as Dataset;

describe("derived dataset", () => {
  it("has ~60+ entities across both kinds and routes", () => {
    expect(ds.entities.length).toBeGreaterThanOrEqual(60);
    expect(ds.entities.some((e) => e.kind === "occupation")).toBe(true);
    expect(ds.entities.some((e) => e.route === "vocational")).toBe(true);
    expect(ds.entities.some((e) => e.route === "academic")).toBe(true);
  });

  it("every datapoint carries value|null, source URL, year and confidence", () => {
    for (const e of ds.entities) {
      for (const [k, d] of Object.entries(e.inputs)) {
        const rest: Record<string, unknown> = { ...d };
        delete rest.inheritedFrom;
        const r = Datapoint.safeParse(rest);
        expect(r.success, `${e.id}.${k}: ${r.success ? "" : r.error.message}`).toBe(true);
      }
    }
  });

  it("every source id used is registered", () => {
    const ids = new Set(ds.sources.map((s) => s.id));
    for (const e of ds.entities) for (const d of Object.values(e.inputs)) expect(ids.has(d!.sourceId)).toBe(true);
  });

  it("a dimension with a raw value only uses inputs that exist", () => {
    for (const e of ds.entities)
      for (const id of DIMENSION_IDS) {
        const m = e.metrics[id];
        if (!m || m.raw === null) continue;
        for (const k of m.inputs) expect(e.inputs[k], `${e.id}.${id} needs ${k}`).toBeDefined();
      }
  });

  it("missing inputs produce null metrics, never zeros", () => {
    for (const e of ds.entities) {
      if (e.inputs.nonCompletion?.value === null) expect(e.metrics.trainingEase?.raw).toBeNull();
      const noStat = !e.inputs.recruitmentDifficulty || e.inputs.recruitmentDifficulty.value === null;
      const noExpert = !e.inputs.demandExpert || e.inputs.demandExpert.value === null;
      if (noStat && noExpert) expect(e.metrics.demand?.raw ?? null).toBeNull();
    }
  });

  it("derived (inherited) values name their origin", () => {
    for (const e of ds.entities)
      for (const d of Object.values(e.inputs)) if (d!.matchLevel === "derived") expect(d!.inheritedFrom).toBeTruthy();
  });

  it("the 'meaning' dimension stays empty until a defensible source exists", () => {
    expect(ds.entities.every((e) => e.metrics.meaning?.raw === null)).toBe(true);
  });

  it("anchors: LSE 2024 national median matches the BFS press release (CHF 7,024)", async () => {
    const lse = (await import("./ingested/bfs-lse-2024.json")).default as unknown as { groups: Record<string, { values: Record<string, Record<string, number | null>> }> };
    expect(lse.groups.total.values["Lebensalter - Total"].Zentralwert).toBe(7024);
  });
});

describe("expanded catalogue", () => {
  it("contains hundreds of occupations and education paths of every type", () => {
    const occ = ds.entities.filter((e) => e.kind === "occupation").length;
    const types = new Set(ds.entities.map((e) => e.eduType).filter(Boolean));
    expect(occ).toBeGreaterThan(250);
    expect(ds.entities.length).toBeGreaterThan(1000);
    for (const t of ["EBA", "EFZ", "BM", "HF", "BP", "HFP", "FH-BSc", "UH-MSc", "ETH-MSc", "UH-MMed"]) expect(types.has(t as never)).toBe(true);
  });

  it("every occupation has a 5-digit CH-ISCO-19 code; without a training path its training dimensions are missing", () => {
    for (const e of ds.entities.filter((x) => x.kind === "occupation")) {
      expect(e.codes.chIsco19, e.id).toMatch(/^\d{5}$/);
      if (!e.trainedVia.length) {
        expect(e.metrics.timeToQualify?.raw ?? null, e.id).toBeNull();
        expect(e.metrics.trainingEase?.raw ?? null, e.id).toBeNull();
      }
    }
  });

  it("baselines, FH masters and doctorates exist and use their own statistics", () => {
    const none = ds.entities.find((e) => e.id === "edu-none-direkteinstieg")!;
    expect(none.inputs.yearsToQualify?.value).toBe(0);
    expect(none.inputs.unemploymentRate?.matchLevel).toBe("education-level");
    expect(ds.entities.filter((e) => e.eduType === "DR").length).toBeGreaterThanOrEqual(5);
    expect(ds.entities.filter((e) => e.eduType === "FH-MSc").length).toBeGreaterThanOrEqual(8);
    const dr = ds.entities.find((e) => e.eduType === "DR")!;
    expect(dr.inputs.payMid?.sourceId).toBe("bfs-eha-grad-income-5y");
  });

  it("FH/UH paths use their own graduates' unemployment where a field statistic exists", () => {
    const withField = ds.entities.filter((e) => e.inputs.unemploymentRate?.sourceId === "bfs-eha-grad-unemployment");
    expect(withField.length).toBeGreaterThan(100);
  });

  it("no tertiary path counts only its prerequisite as time to qualify", () => {
    for (const e of ds.entities.filter((x) => ["HF", "BP", "HFP"].includes(x.eduType ?? ""))) {
      if (e.pathway.length === 1) expect(e.pathway[0].label.startsWith("EFZ apprenticeship"), e.id).toBe(false);
      if (!e.pathway.length) expect(e.inputs.yearsToQualify?.value ?? null).toBeNull();
    }
  });

  it("BP/HFP preparation durations are labelled as estimates", () => {
    const curated = new Set(["edu-bp-polizist", "edu-bp-finanz-rechnungswesen"]); // hand-checked: durations are the training itself
    for (const e of ds.entities.filter((x) => (x.eduType === "BP" || x.eduType === "HFP") && !curated.has(x.id)))
      for (const s of e.pathway.slice(1)) expect(s.confidence, e.id).toBe("estimated");
  });
});
