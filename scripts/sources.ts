/**
 * Source registry. Each statistic used in the dataset points at one of these ids.
 * `rawFiles` link a source to the files in data/raw (sha256 + retrieval date come from
 * data/raw/manifest.json and are copied into data/derived/sources.json at build time).
 */
import type { Source } from "../src/lib/schema";
import { ASSETS, BFS_ASSET_PAGE } from "./ingest/bfs-dam";

export const LSE_URL = "https://www.pxweb.bfs.admin.ch/pxweb/de/px-x-0304010000_205/-/px-x-0304010000_205.px/";
export const LSE_EDU_URL = "https://www.pxweb.bfs.admin.ch/pxweb/de/px-x-0304010000_202/-/px-x-0304010000_202.px/";
export const SECO_STMP_URL = "https://www.arbeit.swiss/de/arbeitgebende/stellenmeldepflicht-checkup-2027";
export const SECO_STATS_URL = "https://www.arbeit.swiss/de/informationszentrum/arbeitsmarktstatistik-schweiz";
export const METHODOLOGY_URL =
  "https://github.com/leiffurthersocial-rgb/SwissCareerScore/blob/main/docs/methodology.md";

export type SourceDef = Omit<Source, "retrieved" | "sha256" | "rawFile"> & { rawFiles?: string[] };

export const SOURCES: SourceDef[] = [
  {
    id: "bfs-lse-2024",
    publisher: "Bundesamt für Statistik (BFS)",
    title: "Schweizerische Lohnstrukturerhebung (LSE) 2024 — Monatlicher Bruttolohn nach Berufsgruppe, Lebensalter (px-x-0304010000_205)",
    url: LSE_URL,
    year: 2024,
    licence: "OGD Switzerland (opendata.swiss terms of use, attribution)",
    rawFiles: ["bfs-lse/px-x-0304010000_205-2024-ch.json"],
  },
  {
    id: "bfs-lse-2024-education",
    publisher: "Bundesamt für Statistik (BFS)",
    title: "LSE 2024 — Monatlicher Bruttolohn nach Ausbildung (px-x-0304010000_202)",
    url: LSE_EDU_URL,
    year: 2024,
    licence: "OGD Switzerland",
    rawFiles: ["bfs-lse/px-x-0304010000_202-2024-ch.json"],
  },
  {
    id: "seco-stmp-2027",
    publisher: "Staatssekretariat für Wirtschaft (SECO)",
    title: "Meldepflichtige Berufsarten 2027 (Arbeitslosenquote je CH-ISCO-19-Berufsart, Q4 2025 – Q3 2026)",
    url: SECO_STMP_URL,
    year: 2026,
    rawFiles: ["seco/meldepflichtige-berufsarten-2027-de.pdf"],
  },
  {
    id: "seco-lage-2026",
    publisher: "Staatssekretariat für Wirtschaft (SECO)",
    title: "Die Lage auf dem Arbeitsmarkt (monthly), Tabelle 14: Arbeitslosenquote nach Berufshauptgruppe, average Jan–Sep 2026",
    url: SECO_STATS_URL,
    year: 2026,
  },
  {
    id: "bfs-besta-recruitment",
    publisher: "Bundesamt für Statistik (BFS)",
    title: "Beschäftigungsstatistik (BESTA): Schwierigkeiten bei der Rekrutierung von Arbeitskräften nach Ausbildungsniveau und Wirtschaftsabteilung",
    url: BFS_ASSET_PAGE(ASSETS.recruitApprentice),
    year: 2026,
    rawFiles: [`bfs-dam/${ASSETS.recruitCompulsory}.xlsx`, `bfs-dam/${ASSETS.recruitApprentice}.xlsx`, `bfs-dam/${ASSETS.recruitHigherVet}.xlsx`, `bfs-dam/${ASSETS.recruitHigherEd}.xlsx`],
  },
  {
    id: "bfs-sake-telework",
    publisher: "Bundesamt für Statistik (BFS)",
    title: "Schweizerische Arbeitskräfteerhebung (SAKE): Teleheimarbeit nach NOGA-Wirtschaftsabschnitt",
    url: BFS_ASSET_PAGE(ASSETS.telework),
    year: 2025,
    rawFiles: [`bfs-dam/${ASSETS.telework}.xlsx`],
  },
  {
    id: "bfs-sake-hours",
    publisher: "Bundesamt für Statistik (BFS)",
    title: "Übliche wöchentliche Arbeitszeit der Vollzeitarbeitnehmenden nach Wirtschaftsabschnitten",
    url: BFS_ASSET_PAGE(ASSETS.hours),
    year: 2025,
    rawFiles: [`bfs-dam/${ASSETS.hours}.xlsx`],
  },
  {
    id: "bfs-sake-night-2013",
    publisher: "Bundesamt für Statistik (BFS)",
    title: "SAKE 2013: Nachtarbeit der Erwerbstätigen nach Berufshauptgruppen ISCO-08",
    url: BFS_ASSET_PAGE(ASSETS.nightWork),
    year: 2013,
    rawFiles: [`bfs-dam/${ASSETS.nightWork}.xls`],
  },
  {
    id: "bfs-labb-study-success",
    publisher: "Bundesamt für Statistik (BFS)",
    title: "Längsschnittanalysen im Bildungsbereich (LABB): Studienerfolgsquote an den Hochschulen nach Fachbereich",
    url: BFS_ASSET_PAGE(ASSETS.studySuccess),
    year: 2025,
    rawFiles: [`bfs-dam/${ASSETS.studySuccess}.xlsx`],
  },
  {
    id: "bfs-labb-vet-certification",
    publisher: "Bundesamt für Statistik (BFS)",
    title: "LABB: Lehrvertragsauflösung, Wiedereinstieg, Zertifikationsstatus — Zertifikationsstatus nach Beruf (Eintrittskohorte 2019)",
    url: BFS_ASSET_PAGE(ASSETS.vetCertification),
    year: 2024,
    rawFiles: [`bfs-dam/${ASSETS.vetCertification}.xlsx`],
  },
  {
    id: "bfs-eha-grad-income",
    publisher: "Bundesamt für Statistik (BFS)",
    title: "Befragung der Hochschulabsolvent/-innen (EHA): Standardisiertes Bruttoerwerbseinkommen ein Jahr nach Abschluss, Abschlussjahr 2024",
    url: BFS_ASSET_PAGE(ASSETS.gradIncome),
    year: 2025,
    rawFiles: [`bfs-dam/${ASSETS.gradIncome}.xlsx`],
  },
  {
    id: "bfs-eha-grad-income-5y",
    publisher: "Bundesamt für Statistik (BFS)",
    title: "Befragung der Hochschulabsolvent/-innen (EHA): Standardisiertes Bruttoerwerbseinkommen fünf Jahre nach Abschluss, Abschlussjahr 2020",
    url: BFS_ASSET_PAGE(ASSETS.gradIncome5),
    year: 2025,
    rawFiles: [`bfs-dam/${ASSETS.gradIncome5}.xlsx`],
  },
  {
    id: "bfs-eha-grad-unemployment",
    publisher: "Bundesamt für Statistik (BFS)",
    title: "EHA: Erwerbslosenquote gemäss ILO der Hochschulabsolvent/-innen ein Jahr nach Abschluss nach Bildungsfeld (ISCED)",
    url: BFS_ASSET_PAGE(ASSETS.gradUnemployment),
    year: 2025,
    rawFiles: [`bfs-dam/${ASSETS.gradUnemployment}.xlsx`],
  },
  {
    id: "berufsberatung",
    publisher: "SDBB / berufsberatung.ch",
    title: "Offizielles Schweizer Informationsportal der Studien-, Berufs- und Laufbahnberatung — Berufs- und Studienprofile",
    url: "https://www.berufsberatung.ch/",
    year: 2026,
  },
  {
    id: "ai-task-content",
    publisher: "SwissCareerScore (expert judgment)",
    title: "Task-content shares per ISCO-08 unit group and AI/automation exposure weights (data/inputs/ai-task-content.json)",
    url: `${METHODOLOGY_URL}#4-ai--automation-resilience`,
    year: 2026,
  },
  {
    id: "expert-occupations",
    publisher: "SwissCareerScore (expert judgment)",
    title: "Per-occupation expert estimates (pay, remote work, work-life balance, shortage, AI exposure) — data/inputs/expert-occupations.tsv",
    url: `${METHODOLOGY_URL}#13-expert-judgment-layer`,
    year: 2026,
  },
  {
    id: "expert-rubric",
    publisher: "SwissCareerScore (expert judgment)",
    title: "Documented scoring rubrics (entry access, international mobility, regional availability)",
    url: METHODOLOGY_URL,
    year: 2026,
  },
];
