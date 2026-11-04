# SwissCareerScore

Decision-support web app that scores **Swiss occupations and education paths** — EBA/EFZ
apprenticeships, Berufsmaturität, Höhere Berufsbildung (HF, federal exams), Fachhochschule/PH and
UH/ETH — across up to 13 dimensions, with **fully adjustable weights**.

> **Scores are decision support, not career advice.** They describe averages of broad occupation
> groups and sectors, built from official statistics plus documented estimates. Talk to a career
> counsellor ([berufsberatung.ch](https://www.berufsberatung.ch)) before deciding.

## What it does

- **1,262 entries**: 461 occupations (every official CH-ISCO-19 occupation type except residual
  categories) and 801 education paths — 185 EFZ and 60 EBA apprenticeships, 50 HF diplomas,
  226 federal professional exams (BP), 133 advanced federal exams (HFP), Berufsmaturität,
  Gymnasiale Matura, Fachmaturität, 54 FH/PH bachelor's and 11 FH master's programmes,
  73 university/ETH programmes, 5 doctorates, and a "no qualification"
  baseline. Where a statistic does not exist the value is shown as missing; where we had to estimate
  (rubrics, AI task profiles, sector or code assignments), the entry says so.
- **Dimensions:** pay, job stability, demand, AI/automation resilience, training ease, entry access,
  time to qualify, career growth, work-life balance, remote/flexibility, international mobility,
  regional availability, and meaning (disabled: no defensible source yet).
- **Official data:** BFS/FSO (wage structure survey LSE 2024, labour force survey SAKE, employment
  statistics BESTA, longitudinal education analyses LABB, graduate survey), SECO (unemployment by
  occupation), berufsberatung.ch (official training durations). Every number has its source,
  year, confidence and match level — click it in the app.
- **Scoring:** absolute value curves per dimension (log scale for pay: CHF 300k/year = 100) or
  percentile ranks; weighted power-mean composite with a selectable penalty for weak spots;
  explicit missing-data handling, Monte-Carlo **uncertainty ranges**, ±20 % weight
  **sensitivity** with *fragile* flags, correlation overlap warnings.
- **Weighting UX:** evidence-based *Balanced* default (equal weights), presets (Money first, Security
  first, Future-proof, Low stress, Fast start), sliders with **locks**, a pairwise **AHP wizard**,
  hard filters (type, route, max. years, language region, min. wage), all state **in the URL**.
- **UI:** ranked lists, entry pages with radar chart and score breakdown, compare up to 4,
  mobile-first, WCAG 2.1 AA (axe-tested in light and dark mode), EN + DE (FR/IT scaffolded).

Docs: [Methodology](docs/methodology.md) · [Data dictionary](docs/data-dictionary.md) ·
[Contributing](CONTRIBUTING.md) · [Original plan](docs/PLAN.md)

## Quick start

Requires Node.js ≥ 22.

```bash
npm install
npm run dev          # http://localhost:3000 → redirects to /en
```

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / serve the build |
| `npm test` | Unit tests (scoring engine, URL state, filters, dataset invariants) — Vitest |
| `npm run test:e2e` | Playwright interaction tests + axe accessibility scans (needs `npm run build` first and `npx playwright install chromium`) |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run data:ingest` | Download and parse all sources into `data/raw` + `data/ingested` (`-- --offline` re-parses committed raw files) |
| `npm run data:build` | Validate entity files, join statistics, write `data/derived/dataset.json` |
| `npm run data:validate` | CI check: committed dataset equals a fresh build |

## Architecture

```
data/
  entities/*.json        one file per occupation / education path (hand-curated, zod-validated)
  inputs/                hand-curated lookup tables (AI task content per ISCO unit group)
  raw/                   untouched source downloads + sha256 manifest
  ingested/              parsed tables (generated)
  derived/dataset.json   what the app loads (generated)
scripts/
  ingest/                one script per source (BFS PXWeb, BFS asset server, SECO, berufsberatung.ch)
  build-data.ts          join + validate + derive dimension metrics + correlations
src/
  lib/scoring/           pure TypeScript scoring engine (no UI dependency), fully unit-tested
  lib/schema/            zod schema = single source of truth for data files
  lib/url-state.ts       app state ⇄ URL search params
  app/[locale]/          Next.js App Router pages (ranking, entity/[id], compare, methodology)
  components/            UI (Radix primitives in shadcn/ui style, Recharts)
messages/                next-intl translations (en, de; fr/it fall back to en)
e2e/                     Playwright + axe tests
```

Everything is statically generated (no backend, no database); scoring runs in the browser.

## Deploy on Vercel

The app is a standard Next.js project — no environment variables or services are needed.

1. Go to <https://vercel.com/new>, **Import** the GitHub repository `SwissCareerScore`.
2. Framework preset **Next.js** is detected automatically; keep the defaults
   (build `npm run build`, install `npm install`, Node 22).
3. Click **Deploy**. Every push to `main` then deploys to production and every PR gets a preview URL.

Alternatively with the CLI: `npx vercel` (preview) and `npx vercel --prod`.

## CI

GitHub Actions (`.github/workflows/ci.yml`): conventional-commit lint on PRs, ESLint, typecheck,
unit tests, dataset freshness check, production build, then Playwright e2e + accessibility tests.

## Data licence and attribution

Statistics © Bundesamt für Statistik (BFS), Staatssekretariat für Wirtschaft (SECO) and SDBB /
berufsberatung.ch, used under their open-data terms with attribution. Rubric scores and AI
task-content shares are the project's documented expert judgments.
