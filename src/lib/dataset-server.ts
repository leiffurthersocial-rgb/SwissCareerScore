import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Dataset, DatasetEntity } from "./dataset-types";

let cache: Map<string, DatasetEntity> | null = null;

/** Full entity record (all datapoints, formulas, pathway). Server/build time only. */
export function getEntityDetail(id: string): DatasetEntity | undefined {
  if (!cache) {
    const ds = JSON.parse(readFileSync(path.join(process.cwd(), "data", "derived", "dataset.json"), "utf8")) as Dataset;
    cache = new Map(ds.entities.map((e) => [e.id, e]));
  }
  return cache.get(id);
}
