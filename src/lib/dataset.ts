import raw from "../../data/derived/dataset.json";
import type { Dataset, DatasetEntity } from "./dataset-types";
import type { FilterableEntity } from "./filters";
import type { ScorableEntity } from "./scoring";

export const dataset = raw as unknown as Dataset;
export const entities: DatasetEntity[] = dataset.entities;
const byId = new Map(entities.map((e) => [e.id, e]));

export function getEntity(id: string): DatasetEntity | undefined {
  return byId.get(id);
}

export function displayName(e: DatasetEntity, locale: string): string {
  const n = e.name as Record<string, string | null>;
  return n[locale] ?? n.en ?? e.id;
}

export const scorable: ScorableEntity[] = entities.map((e) => ({ id: e.id, pool: e.kind, metrics: e.metrics }));

export function filterable(e: DatasetEntity): FilterableEntity {
  return {
    kind: e.kind,
    route: e.route,
    eduType: e.eduType,
    languageRegions: e.languageRegions,
    names: [e.name.en, e.name.de, e.name.fr, e.name.it].filter((x): x is string => !!x),
    yearsToQualify: e.inputs.yearsToQualify?.value ?? null,
    medianPay: e.inputs.payMid?.value ?? null,
  };
}

export function sourceById(id: string) {
  return dataset.sources.find((s) => s.id === id);
}
