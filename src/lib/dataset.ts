import raw from "../../data/derived/core.json";
import type { CoreDataset, CoreEntity } from "./dataset-types";
import type { DimensionId } from "./dimensions";
import type { FilterableEntity } from "./filters";
import type { Confidence } from "./schema";
import type { DimensionMetric, ScorableEntity } from "./scoring";

/** Compact dataset shipped to the browser. Full per-entity details: lib/dataset-server.ts or /data/e/<id>.json. */
export const core = raw as unknown as CoreDataset;
export const entities: CoreEntity[] = core.entities;
export const dataset = core; // sources, correlations, version
const byId = new Map(entities.map((e) => [e.id, e]));

const CONF: Record<string, Confidence> = { m: "measured", e: "estimated", x: "expert-judgment" };

export function getEntity(id: string): CoreEntity | undefined {
  return byId.get(id);
}

export function displayName(e: Pick<CoreEntity, "name" | "id">, locale: string): string {
  const n = e.name as Record<string, string | null>;
  return n[locale] ?? n.en ?? e.id;
}

export function metric(e: CoreEntity, d: DimensionId): DimensionMetric | undefined {
  const m = e.m[d];
  return m ? { raw: m[0], confidence: CONF[m[1]], matchLevel: m[2] } : undefined;
}

export const scorable: ScorableEntity[] = entities.map((e) => ({
  id: e.id,
  pool: e.kind,
  metrics: Object.fromEntries(Object.keys(e.m).map((d) => [d, metric(e, d as DimensionId)])),
}));

export function filterable(e: CoreEntity): FilterableEntity {
  return {
    kind: e.kind,
    route: e.route,
    eduType: e.eduType,
    languageRegions: e.languageRegions,
    names: [e.name.en, e.name.de, e.name.fr, e.name.it].filter((x): x is string => !!x),
    yearsToQualify: e.y,
    medianPay: e.p,
  };
}

export function sourceById(id: string) {
  return core.sources.find((s) => s.id === id);
}
