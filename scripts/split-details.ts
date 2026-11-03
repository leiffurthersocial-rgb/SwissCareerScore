/**
 * Runs before `next build`: splits data/derived/dataset.json into one small JSON file per entity
 * under public/data/e/, fetched on demand by the compare view. Generated, not committed.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Dataset } from "../src/lib/dataset-types";

const ROOT = path.resolve(__dirname, "..");
const ds = JSON.parse(readFileSync(path.join(ROOT, "data", "derived", "dataset.json"), "utf8")) as Dataset;
const dir = path.join(ROOT, "public", "data", "e");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
for (const e of ds.entities) writeFileSync(path.join(dir, `${e.id}.json`), JSON.stringify(e));
console.log(`split-details: ${ds.entities.length} files → public/data/e/`);
