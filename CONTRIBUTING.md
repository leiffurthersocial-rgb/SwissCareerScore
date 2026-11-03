# Contributing

Thanks for helping make SwissCareerScore more useful. The bar for data is high: **every number must
be traceable to a public source, and a missing value is `null`, never a guess.**

## Setup

```bash
npm install
npm run dev            # app on http://localhost:3000
npm test               # unit tests
npm run data:validate  # verifies data/derived/dataset.json is a fresh build of the inputs
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`,
`docs:`, `data:` is not a type — use `feat(data):` / `fix(data):`). A commit-msg hook enforces it.

## Adding an occupation or education path

1. **Create `data/entities/<id>.json`.** Copy a similar entry (e.g. `occ-polymechaniker.json` /
   `edu-efz-polymechaniker.json`). Field meanings: [docs/data-dictionary.md](docs/data-dictionary.md).
   - Occupations need `codes.isco08` (4-digit ISCO-08 / CH-ISCO-19 unit group), `refs.besta`,
     `refs.qualLevel`, `refs.nogaSection`, `trainedVia`, and the `mobility` and `regionalUbiquity`
     rubric datapoints with a written justification in `note`.
   - Education paths need a `pathway` (each stage citing the berufsberatung.ch page that states its
     official minimum duration), `leadsTo` (target occupation), `entryAccess` rubric, and where
     available `refs.vetName` / `refs.studyField` / `refs.gradIncome`.
2. **AI task content.** If the ISCO-08 unit group is new, add it to `data/inputs/ai-task-content.json`
   with task shares that sum to 100 and a one-line rationale based on the ISCO-08 task description.
3. **Ingest and build.**
   ```bash
   npm run data:ingest   # fetches any new berufsberatung.ch pages you cite (and refreshes sources)
   npm run data:build    # fails loudly on typos, unknown refs, or durations not stated on the page
   ```
4. **Commit** the entity file, any new `data/raw/**` files, `data/raw/manifest.json`,
   `data/ingested/*.json` and `data/derived/dataset.json`.

### Rubric scores (expert judgment)

Rubrics are defined in [docs/methodology.md](docs/methodology.md) (§6, §11, §12). Apply the criteria
literally and explain the score in the `note`. Rubric values are always labelled
`confidence: "expert-judgment"` and carry the widest uncertainty in the scoring engine.

## Updating official statistics

BFS publishes new editions under new asset ids. To update:

1. Find the new asset (e.g. via `https://dam-api.bfs.admin.ch/hub/api/dam/assets?language=de&title=<words>`).
2. Update the id in `scripts/ingest/bfs-dam.ts` (or the year in `bfs-lse.ts`, the window in `seco.ts`).
3. `npm run data:ingest && npm run data:build`, review the diff of `data/ingested/*.json`, update
   year references in `docs/methodology.md`, commit.

## Code

- `src/lib/scoring` is a pure TypeScript module (no React, no I/O). Every change needs unit tests.
- UI strings go through `next-intl` (`messages/en.json`, `messages/de.json`; FR/IT fall back to EN).
- Keep components accessible: keyboard operable, visible focus, labels for every control,
  colour never the only carrier of meaning, AA contrast in both themes.
