# Methodology

SwissCareerScore ranks Swiss **occupations** and **education paths** on up to 13 dimensions. You choose
the weights. This document explains every number: where it comes from, how it is turned into a
0–100 score, and where it is weak.

> **Scores are decision support, not career advice.** They describe averages of broad occupation
> groups and sectors, not any individual's prospects.

## 1. Principles

1. **Official data first.** Quantitative inputs come from the Federal Statistical Office (BFS/FSO),
   SECO and the official career-guidance portal berufsberatung.ch (SDBB). Where no official
   statistic exists, we use a documented rubric and label it *expert judgment*.
2. **Never invent numbers.** Every datapoint carries value, source URL, reference year, confidence
   (`measured` / `estimated` / `expert-judgment`) and a *match level* that says how closely the
   statistic matches the entry (e.g. "ISCO 2-digit group"). A missing value is `null` and is
   handled explicitly; it is never filled with an average.
3. **Reproducible.** `npm run data:ingest` downloads and parses all sources (raw files and their
   SHA-256 hashes are committed in `data/raw/`), `npm run data:build` produces the dataset, and CI
   checks that the committed dataset is a fresh build.
4. **Transparent uncertainty.** Each composite score comes with a plausible range and each rank with a
   plausible rank range; rankings that flip under small weight changes are flagged *fragile*.

## 2. Entities and how statistics are attached

- **Occupations** carry an ISCO-08 / CH-ISCO-19 unit-group code (4 digits), an economic sector
  (NOGA) and a typical training path.
- **Education paths** (EBA/EFZ apprenticeships, Berufsmaturität, HF, federal professional exams,
  FH/PH, UH/ETH) carry a *pathway* — the shortest standard full-time route after compulsory school,
  stage by stage, each stage citing the berufsberatung.ch page that states its minimum duration —
  and a target occupation.
- **Inheritance.** Labour-market outcomes of an education path (wages, unemployment, AI exposure,
  night work, mobility, ubiquity) are inherited from its target occupation; training characteristics
  of an occupation (years, completion rate, entry hurdle) are inherited from its typical training
  path. Inherited values keep their source and are marked `derived`, which widens their uncertainty.
- **Separate pools.** Occupations and education paths are normalized and ranked **separately**.
  Mixing them would make an apprenticeship compete with the job it leads to on the same scale.

## 3. Normalization: percentile ranks

For each dimension, raw values of all entries in the same pool that have data are converted to
**percentile ranks**:

`score = 100 × (r − 1) / (n − 1)`, where `r` is the 1-based average rank (ties share the mean rank)
and `n` the number of entries with data. The worst value gets 0, the best 100. With a single value
the score is 50. If lower raw values are better (e.g. unemployment) the score is flipped
(`100 − score`).

Why not min–max scaling? Percentile ranks are invariant to monotone transformations, robust to
outliers (one very high wage does not compress everyone else) and comparable across dimensions with
different units. The cost: differences in *magnitude* are lost — a 0.1 pp and a 3 pp gap in
unemployment both move one rank. The raw value is always shown next to the score.

## 4. Dimensions

Each dimension below lists the **source**, the **raw formula**, the **direction**, and **known
limitations**. Confidence and match level of a dimension are the *worst* of its inputs.

### 1. Pay

- **Source:** BFS, Swiss Earnings Structure Survey (LSE) 2024, PXWeb table `px-x-0304010000_205`:
  gross monthly wage (full-time equivalent, incl. 1/12 of the 13th salary and bonuses), private and
  public sector, by ISCO-08 2-digit group and age band. For FH/PH/UH paths the *entry* wage is the
  BFS graduate survey (EHA, graduates 2024, one year after degree) standardized annual income ÷ 12,
  by field. For the Berufsmaturität path: LSE 2024 by highest education (`px-x-0304010000_202`).
- **Formula:** `0.35 × median(age ≤ 29) + 0.65 × median(age 30–49)`. P25 and P75 are shown, not scored.
  The 35/65 split reflects that most of a working life is spent past entry level while keeping
  early-career pay visible.
- **Limitations:** LSE is published only at ISCO **2-digit** level in machine-readable form (48
  groups). Occupations in the same group share wages — e.g. social workers (ISCO 2635) share group
  26 with lawyers. Match level `isco2` adds uncertainty (§6). Pay is gross and not adjusted for
  regional living costs. Self-employed are not covered by LSE.

### 2. Job stability

- **Source:** SECO. (a) *Meldepflichtige Berufsarten 2027*: registered unemployment rate per
  CH-ISCO-19 occupation type for every type with a rate ≥ 5 % (reference period Q4 2025 – Q3 2026).
  (b) Monthly *Die Lage auf dem Arbeitsmarkt*, Table 14: rate by ISCO major group, averaged over the
  monthly reports available in that window (Jan–Sep 2026).
- **Formula:** raw = unemployment rate. If the occupation type is on list (a) its own rate is used
  (match `isco4`). Otherwise we know its rate is **< 5 %**; we use the major-group rate, capped at
  4.9 % (match `isco1`). Lower is better.
- **Limitations:** Registered unemployment (RAV) undercounts people not registered; ISCO major groups
  are coarse; the cap is a censoring rule, not a measurement. The ILO unemployment of graduates by
  field (BFS) is not yet used.

### 3. Demand

- **Source:** BFS Employment Statistics (BESTA), quarterly business survey: *difficulties recruiting
  staff* by economic division and qualification level (apprenticeship / higher VET / higher
  education), employment-weighted.
- **Formula:** raw = share of firms that found recruiting **difficult or impossible** among firms
  that recruited: `(hard + not found) / (easy + hard + not found)`, mean of the last 4 quarters, for
  the entry's sector and qualification level. Higher is better (for the job seeker).
- **Limitations:** Sector-level, not occupation-level (match `sector`). Agriculture is not covered
  (→ null). A more specific source — SECO's *Indikatorensystem Arbeitskräftesituation* (2023, CH-ISCO-19
  2-digit) — can be added once its data tables are available in machine-readable form.

### 4. AI / automation resilience

This is an **estimate** and always labelled as such.

- **Method (task-based exposure):** Each ISCO-08 unit group gets task-content shares (% of working
  time) in five classes following the task framework of Autor, Levy & Murnane (2003) and Acemoglu
  & Autor (2011): non-routine analytic (NRA), non-routine interpersonal (NRI), routine cognitive (RC),
  routine manual (RM), non-routine manual/physical (NRM). Shares are assigned from the ISCO-08 task
  descriptions (ILO 2012) and recorded with a rationale in `data/inputs/ai-task-content.json`.
- **Formula:** `exposure = 1.0·RC + 0.6·NRA + 0.5·RM + 0.15·NRI + 0.1·NRM` (0–100). Lower exposure =
  higher resilience.
- **Assumptions behind the weights:** routine cognitive tasks are the most exposed to both classic
  software automation and generative AI (consistent with ILO's finding that clerical work has the
  highest generative-AI exposure — Gmyrek, Berg & Bescond 2023); generative AI makes substantial
  parts of analytic/writing/coding work automatable or augmentable (Eloundou et al. 2023), hence
  0.6; routine manual tasks are exposed to robotics at a slower pace (0.5); interpersonal and
  non-routine physical tasks are least exposed.
- **Limitations:** Exposure ≠ job loss — exposed tasks can be augmented rather than replaced. Shares
  are expert judgment (widest uncertainty, §6). Within-group variation (e.g. specialisations) is
  ignored.

### 5. Training ease (difficulty, inverted)

- **Source:** BFS Longitudinal Analyses in Education (LABB). EBA/EFZ: *certification status by
  occupation* (entry cohort 2019, status end of 2024). FH/UH: *study success rate by field* (bachelor
  entrants, success within 8 years, a degree in another field counts as success).
- **Formula:** raw = non-completion rate. VET: `failed final exam % + left the VET system %`
  (learners still in training are not counted). Higher education: `no bachelor degree after 8 years`.
  Lower is better.
- **Limitations:** Non-completion mixes difficulty with motivation and fit. HF, federal exams (BP/HFP)
  and PH have no comparable statistic here (→ null). FH/UH values are by field, not by programme.

### 6. Entry competition

Rubric, **expert judgment** based on documented admission rules (cited per entry):

| Value | Admission hurdle |
|---|---|
| 0 | No selection beyond the formal prerequisite (e.g. UH/ETH with Matura, federal exams by experience) |
| 1 | Competitive application to a training company/employer (dual apprenticeships) or entrance exam with no fixed cap |
| 2 | Formal aptitude assessment with limited places (most FH health/social programmes, HF nursing, police) |
| 3 | Numerus clausus or strongly capacity-constrained selection (medicine, physiotherapy) |

Lower is better. **Limitation:** applicant-per-place statistics are not published consistently
across programme types; the rubric captures the *mechanism*, not the actual odds.

### 7. Time to qualify (inverted)

- **Source:** berufsberatung.ch profiles (official minimum durations). The build **fails** if a
  stage's years are not stated on the cited page.
- **Formula:** raw = sum of pathway stages, in years after compulsory school. Lower is better.
- **Limitations:** Uses the shortest standard full-time route; bridging years, gap years,
  part-time variants and medical specialist training (5–6 years) are excluded. Gymnasium is counted
  as 4 years after compulsory school (berufsberatung.ch: 3–6 years depending on canton, partly
  overlapping compulsory school) — marked *estimated*. Direct costs are not scored: public tuition
  in Switzerland is low, and the dominant cost (foregone earnings) is proportional to the years
  already counted here, so adding it would double count. Apprentice wages are shown for information.

### 8. Career growth

- **Source:** LSE 2024 (as Pay).
- **Formula:** raw = `median(age ≥ 50) / median(age ≤ 29)` within the ISCO 2-digit group. Higher is better.
- **Limitations:** Cross-sectional, not a cohort: it compares today's older and younger workers.
  Coarse groups (`isco2`).

### 9. Work-life balance

- **Sources:** SAKE 2013, night work by ISCO major group (latest occupational breakdown BFS has
  published; marked *estimated*); SAKE 2025, usual weekly hours of full-time employees by NOGA section.
- **Formula:** raw index = mean of two percentile ranks across all entries: low night-work share and
  low usual weekly hours. Higher is better.
- **Limitations:** Coarse (`isco1` / `sector`), the night-work figure is dated, hours differ little
  between sectors, and stress, shift rotation and weekend work are not captured directly.

### 10. Remote / flexibility

- **Source:** SAKE 2025, telework from home (occasional, regular or usual) by NOGA section.
- **Formula:** raw = % of employed in the sector working from home at least occasionally.
- **Limitations:** Sector-level: a nurse and a hospital controller share the health-sector value.

### 11. International mobility

Rubric 0–9, **expert judgment**, sum of three 0–3 criteria with written justification per entry:
(a) **recognition** of the qualification abroad — 3 for internationally standard degrees or automatic
EU recognition under Directive 2005/36 (doctors, general-care nurses, architects …), 1 for Swiss VET
certificates (EQF referencing only), 0 for nationally reserved careers; (b) **language
independence** of the work; (c) **transferability** / international demand. Higher is better.

### 12. Regional availability

Rubric 0–6, **expert judgment**: (a) spatial ubiquity 0–3 (3 = needed in every municipality, e.g.
electricians, care; 1 = concentrated in a few clusters, e.g. pharma labs) + (b) number of language
regions (de/fr/it) where the training is offered / the occupation broadly practised (1–3).
The language-region filter uses (b) directly.

### 13. Meaning / societal value

**No defensible Swiss per-occupation source was found.** Candidate proxies — the ISSP *Work
Orientations* item "my job is useful to society" (very small Swiss subsamples per occupation group)
or crisis-era "systemically relevant" occupation lists (binary, politically defined) — are too weak
to rank 70 entries. The dimension exists in the schema and UI, holds `null` for every entry, and is
weighted 0 in all presets. If a user weights it anyway, it simply has no data and its weight is
redistributed (§5).

## 5. Composite score and missing data

`composite = Σ wᵢ·sᵢ / Σ wᵢ` over the dimensions **that have data** for the entry, where `wᵢ` are the
user weights normalized to 100 % and `sᵢ` the percentile scores. Missing dimensions are dropped and
their weight redistributed proportionally — never imputed.

**Coverage** = share of the total weight backed by data. Below **60 %** the entry is flagged
*insufficient data* and shown without a rank. The breakdown table on each entry page shows nominal
weight, effective weight after redistribution, score and points per dimension.

## 6. Uncertainty range

Each dimension score gets a standard deviation (in percentile points) combining data confidence and
match level:

| Confidence | σ | | Match level | σ |
|---|---|---|---|---|
| measured | 4 | | exact | 0 |
| estimated | 10 | | ISCO 4-digit | 2 |
| expert judgment | 18 | | ISCO 3-digit | 4 |
| | | | ISCO 2-digit / field | 6 |
| | | | derived | 8 |
| | | | ISCO 1-digit / sector | 10 |
| | | | education level | 12 |

`σ = √(σ_conf² + σ_match²)`. A seeded Monte-Carlo simulation (300 draws in the app) perturbs every
dimension score with Gaussian noise (clamped to 0–100); a **missing** dimension with positive weight
is drawn uniformly from 0–100 ("could be anything"). The P10–P90 of the simulated composites is the
**plausible range**; the P10–P90 of simulated ranks is the **plausible rank range**. The σ values are
judgment calls documented here; they express *relative* trust, not a statistical sampling error.

## 7. Sensitivity analysis

For every dimension with positive weight, the weight is multiplied by 0.8 and by 1.2 (others
unchanged, then renormalized) and the pool is re-ranked. The largest absolute rank change across
these 2·k scenarios is reported per entry and per dimension. An entry is **fragile** if this change is
**≥ 3 places**. Fragile rankings mean "small changes in what you care about would reorder this part of
the list" — treat neighbouring entries as ties.

## 8. Correlated dimensions

Some dimensions move together. Spearman correlations between direction-adjusted dimension values in
the current dataset (all entries):

| Pair | ρ | Interpretation |
|---|---|---|
| Pay – Career growth | +0.90 | Higher-paid groups also have steeper age–wage profiles. |
| Pay – Time to qualify | −0.79 | Longer training pays more: a genuine trade-off, not double counting. |
| Time to qualify – Career growth | −0.77 | Same trade-off. |
| Career growth – Flexibility | +0.71 | Office-based, highly qualified jobs both grow and allow home office. |
| AI resilience – Flexibility | −0.71 | Remote-friendly tasks are the ones most exposed to AI. |

How this is handled:

1. **By construction** we avoid feeding the same statistic into two dimensions: Pay uses wage
   *levels*, Career growth the *ratio* of old to young wages, Time to qualify only durations (costs
   are excluded precisely because they are proportional to time, §4.7).
2. **Negative correlations are trade-offs** and are left as is — they are the heart of the decision.
3. **Positive correlations above |ρ| ≥ 0.6** between two dimensions you weight trigger a warning in the
   weight panel ("counts a similar signal twice"), so you can reduce one of them consciously.
4. We deliberately do **not** silently re-weight correlated dimensions (e.g. via PCA): that would
   make the weights you set no longer mean what they say.

## 9. Weights, presets and the pairwise wizard

- Weights are normalized to 100 %. Moving one slider rescales the **unlocked** others proportionally;
  locked weights never change.
- **Balanced** (default) uses **equal weights** for every dimension with data. Without validated
  importance ratings for the Swiss target population, equal weighting is the standard
  recommendation for composite indicators (OECD/JRC *Handbook on Constructing Composite Indicators*,
  2008) and performs robustly against optimized weights (Dawes 1979).
- Other presets: **Money first** (pay 40, growth 20 …), **Security first** (stability 30, demand 20,
  AI 20 …), **Future-proof** (AI 35, demand 20 …), **Low stress** (work-life 35 …), **Fast start**
  (time 35 …). Exact values: `src/lib/presets.ts`.
- **Pairwise wizard (AHP).** Dimensions are grouped into 5 clusters (money, security, low effort,
  lifestyle, place) → 10 questions on Saaty's 1–9 scale. Group weights are the principal eigenvector
  of the comparison matrix and are split equally among a group's dimensions. A consistency ratio
  CR > 0.10 triggers a warning.

## 10. Hard filters

Filters (route, type, max. years, language region, minimum median wage, search) only **hide**
entries. They never change normalization pools, so scores and ranks stay comparable whatever you
filter. Entries with unknown values are hidden when a numeric filter on that value is active.

## 11. Known limitations (summary)

- Granularity: wages are ISCO 2-digit, unemployment partly ISCO 1-digit, demand/flexibility/hours by
  sector. Entries in the same group look alike on these dimensions.
- Rubric dimensions (entry competition, mobility, regional, AI task shares) are expert judgment.
- Regional differences in wages and unemployment are not yet used for scoring (LSE regional data are
  ingested-ready via the same PXWeb table).
- The night-work statistic is from 2013.
- Gross wages ignore taxes, living costs and part-time prevalence.
- Self-employment and entrepreneurship are not modelled.

## 12. Reproducing the data

```bash
npm run data:ingest            # download + parse all sources (add -- --offline to re-parse data/raw)
npm run data:build             # validate entities, join statistics, write data/derived/dataset.json
npm run data:validate          # CI: fail if dataset.json is stale
```

Source registry with URLs, retrieval dates and SHA-256 hashes: `dataset.sources` in
`data/derived/dataset.json` (generated from `scripts/sources.ts` and `data/raw/manifest.json`).

## References

- Acemoglu, D. & Autor, D. (2011). Skills, tasks and technologies. *Handbook of Labor Economics* 4B.
- Autor, D., Levy, F. & Murnane, R. (2003). The skill content of recent technological change. *QJE* 118(4).
- Dawes, R. (1979). The robust beauty of improper linear models. *American Psychologist* 34(7).
- Eloundou, T., Manning, S., Mishkin, P. & Rock, D. (2023). GPTs are GPTs. arXiv:2303.10130.
- Gmyrek, P., Berg, J. & Bescond, D. (2023). Generative AI and jobs: a global analysis of potential effects on job quantity and quality. ILO Working Paper 96.
- ILO (2012). International Standard Classification of Occupations ISCO-08, Vol. 1.
- OECD/JRC (2008). Handbook on Constructing Composite Indicators.
- Saaty, T. (1980). *The Analytic Hierarchy Process*.
