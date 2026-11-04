# Authoring helpers (one-off generators)

These scripts generated the bulk of `data/entities/*.json` (EFZ/EBA/HF/BP/HFP profiles and study
fields). After generation, **the JSON files are the source of truth** — edit them directly; re-running
`expand.py` regenerates generated entries (hand-curated `initial-dataset` entries are kept).

```bash
npm run data:ingest                      # needs data/ingested/seco-avam.json + bfs-dam.json
python3 scripts/authoring/fetch_bb.py    # list + cache berufsberatung.ch profiles from the sitemap
python3 scripts/authoring/parse_bb.py    # extract titles and duration statements
python3 scripts/authoring/expand.py      # write entity files (logs unmatched titles to .work/log.json)
python3 scripts/authoring/expand2.py     # baselines, FH masters, doctorates, all remaining occupation types, graduate fields
npm run data:ingest && npm run data:build
```

How codes are assigned: the masculine/feminine titles of each berufsberatung.ch profile are matched
against the SECO/AVAM occupation list (exact, then fuzzy ≥ 0.9). Titles absent from that list get a
manually chosen CH-ISCO-19 code (`MANUAL` in `expand.py`) and are flagged in the entry notes. Titles
that cannot be classified are skipped and listed in `.work/log.json`.
