# Data dictionary

All data lives in `/data`. Nothing in `/data/derived` or `/data/ingested` is edited by hand.

```
data/
  entities/<id>.json     hand-curated entity definitions (one file per occupation / education path)
  inputs/*.json          hand-curated lookup tables (AI task content per ISCO unit group)
  raw/                   untouched downloads + manifest.json (sha256, retrieval date, URL);
                         berufsberatung.ch pages are not committed (size) — see manifest + ingested/berufsberatung.json
  ingested/*.json        tidy tables parsed from raw/ by scripts/ingest/*
  derived/dataset.json   full dataset (all datapoints; server/build time and tests)
  derived/core.json      compact dataset shipped to the browser (names, filters, dimension raw values)
```

`npm run build` first runs `scripts/split-details.ts`, which writes one detail file per entry to
`public/data/e/<id>.json` (fetched by the compare view). Entry pages are rendered at build time with
the full details.

## Entity file (`data/entities/<id>.json`)

Validated by `EntityFile` in [`src/lib/schema/index.ts`](../src/lib/schema/index.ts).

| Field | Type | Meaning |
|---|---|---|
| `id` | `occ-…` / `edu-…` | Stable id, equals the file name. Used in URLs. |
| `kind` | `occupation` \| `education` | Occupations and education paths are ranked in **separate normalization pools**. |
| `route` | `vocational` \| `academic` \| `mixed` | `mixed` = vocational entry with a later academic stage (e.g. EFZ + BM → FH). |
| `eduType` | `EBA` `EFZ` `BM` `BP` `HFP` `HF` `FH-BSc` `FH-MSc` `UH-BSc` `UH-MSc` `ETH-MSc` `UH-MMed` | Education paths only. |
| `name` | `{en, de, fr, it}` | `fr`/`it` may be `null` → UI falls back to English. |
| `codes.isco08` | 4 digits | ISCO-08 / CH-ISCO-19 unit group. Drives LSE wage group (first 2 digits), SECO unemployment (major group = first digit), night work (first digit) and AI task content. |
| `codes.chIsco19` | 4–5 digits | CH-ISCO-19 Berufsart, matched against SECO's occupation-type unemployment list. |
| `sector` | text | Human-readable sector label. |
| `refs.besta` | e.g. `"86-88"` | BFS BESTA economic-division code for recruitment difficulty (demand). |
| `refs.qualLevel` | `apprenticeship` \| `higherVet` \| `higherEducation` | Which BESTA qualification level applies. |
| `refs.nogaSection` | `A`…`U` or `*` | NOGA section for telework and weekly hours; `*` = whole economy (cross-sector jobs). |
| `refs.vetName` | text | Exact occupation name in the BFS LABB certification table (EBA/EFZ). |
| `refs.studyField` | `UH:<field>` / `FH:<field>` | BFS study-success field. |
| `refs.gradIncome` | `uh:Master:<field>` / `fh:Bachelor:<field>` | BFS graduate-survey income cell. |
| `refs.lseEducation` | code | LSE wage by highest education (paths without a target occupation, e.g. BM). |
| `pathway[]` | `{label, years, sourceUrl, confidence, note?}` | Shortest standard full-time route after compulsory school. The build **fails** if `years` is not stated on the cited berufsberatung.ch page. |
| `leadsTo[]` | entity ids | Education → target occupation. Outcome inputs (wages, unemployment, AI exposure …) are inherited from `leadsTo[0]` and marked `derived`. |
| `trainedVia[]` | entity ids | Occupation → typical training path. Training inputs (time, completion, entry access) are inherited from `trainedVia[0]`. |
| `languageRegions[]` | `de` `fr` `it` | Where the training is offered / occupation broadly practised. Used by the language filter and the regional dimension. |
| `raw.entryAccess` | Datapoint | Admission-hurdle rubric 0–3 (education paths). |
| `raw.mobility` | Datapoint | International-mobility rubric 0–9 (occupations). |
| `raw.regionalUbiquity` | Datapoint | Spatial ubiquity rubric 0–3 (occupations). |
| `meta` | `{addedBy, reviewed, notes?}` | Provenance of the entry itself. |

## Datapoint

Every number in the dataset is a Datapoint:

| Field | Meaning |
|---|---|
| `value` | number or **`null`** (missing — never silently filled) |
| `unit` | e.g. `CHF/month`, `%`, `years`, `rubric 0–3` |
| `sourceId` | id in the source registry (`scripts/sources.ts` → `dataset.sources`) |
| `sourceUrl` | deep link to the table / page |
| `year` | reference year of the statistic |
| `confidence` | `measured` (official statistic), `estimated` (official statistic used beyond its intended scope, e.g. outdated year, or a computed proxy), `expert-judgment` (documented rubric) |
| `matchLevel` | how closely the statistic matches the entity: `exact`, `isco4`, `isco3`, `isco2`, `isco1`, `field`, `sector`, `education-level`, `derived` |
| `statisticLabel` | the exact table cell used, human readable |
| `note` | caveats |
| `inheritedFrom` | (dataset only) entity id the value was copied from |

## Inputs in `dataset.json`

| Input id | Unit | Source | Used by dimension |
|---|---|---|---|
| `payEntry` | CHF/month | LSE 2024 median age ≤29 (occupations) / BFS graduate survey ÷ 12 (FH/UH/PH paths) | pay |
| `payMid` | CHF/month | LSE 2024 median age 30–49 | pay |
| `paySenior` | CHF/month | LSE 2024 median age ≥50 | careerGrowth |
| `payP25`, `payP75` | CHF/month | LSE 2024, all ages | display only |
| `unemploymentRate` | % | SECO occupation-type list (≥5 %) or SECO major-group average (capped 4.9 %) | stability |
| `recruitmentDifficulty` | % firms | BFS BESTA, last 4 quarters | demand |
| `aiExposure` | index 0–100 | task-content table × exposure weights | aiResilience |
| `nonCompletion` | % | BFS LABB (VET certification / higher-ed study success) | trainingEase |
| `entryAccess` | rubric 0–3 | rubric | entryAccess |
| `yearsToQualify` | years | sum of pathway stages (berufsberatung.ch) | timeToQualify |
| `nightWork` | % | SAKE 2013 by ISCO major group | workLifeBalance |
| `weeklyHours` | h/week | SAKE 2025 usual hours of full-time employees by NOGA section | workLifeBalance |
| `telework` | % | SAKE 2025 telework by NOGA section | flexibility |
| `mobility` | rubric 0–9 | rubric | mobility |
| `regionalUbiquity` | rubric 0–3 | rubric | regional |
| `trainingRegions` | 1–3 | count of `languageRegions` | regional |
| `apprenticeWage` | CHF/month | berufsberatung.ch recommendation, final year | display only |

## `dataset.json` → `metrics`

For each dimension: `{ raw, confidence, matchLevel, inputs[], formula }`. `raw` is in the unit
listed in [`src/lib/dimensions.ts`](../src/lib/dimensions.ts); `confidence` and `matchLevel` are the
*worst* of the contributing inputs; `formula` shows the computation with real numbers.

`correlations` holds the Spearman matrix between direction-adjusted dimension values.
