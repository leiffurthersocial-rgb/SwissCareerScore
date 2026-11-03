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
      if (!e.inputs.recruitmentDifficulty || e.inputs.recruitmentDifficulty.value === null)
        expect(e.metrics.demand?.raw ?? null).toBeNull();
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
