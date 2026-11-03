/**
 * Run all ingestion steps. `npm run data:ingest` downloads fresh copies; add `-- --offline` to
 * re-parse the committed raw files in data/raw without network access.
 */
import { ingestBerufsberatung } from "./berufsberatung";
import { ingestBfsDam } from "./bfs-dam";
import { ingestLse, ingestLseEducation } from "./bfs-lse";
import { ingestSeco } from "./seco";

(async () => {
  await ingestLse();
  await ingestLseEducation();
  await ingestSeco();
  await ingestBfsDam();
  await ingestBerufsberatung();
  console.log("done.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
