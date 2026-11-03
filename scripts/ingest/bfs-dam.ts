/**
 * BFS tables downloaded from the BFS asset server (dam-api.bfs.admin.ch).
 * Asset ids are versioned by BFS: when a newer edition is published, update the id here,
 * re-run `npm run data:ingest`, review the diff of data/ingested/*.json and commit.
 */
import * as XLSX from "xlsx";
import { fetchRaw, parseNum, round, writeIngested } from "./lib";

export const DAM = (id: number) => `https://dam-api.bfs.admin.ch/hub/api/dam/assets/${id}/master`;
export const BFS_ASSET_PAGE = (id: number) => `https://www.bfs.admin.ch/asset/de/${id}`;

export const ASSETS = {
  recruitApprentice: 36829817, // BESTA: Schwierigkeiten Rekrutierung Arbeitskräfte mit Berufslehre
  recruitHigherVet: 36829811, // … mit höherer Berufsausbildung
  recruitHigherEd: 36829823, // … mit Hochschulabschluss
  telework: 36508654, // SAKE: Teleheimarbeit (Tablang_3 by NOGA section)
  hours: 36576942, // SAKE/AVOL: übliche Arbeitszeit der Vollzeitarbeitnehmenden nach Wirtschaftsabschnitten
  nightWork: 304654, // SAKE 2013: Nachtarbeit nach Berufshauptgruppen ISCO-08
  studySuccess: 36077550, // LABB: Studienerfolgsquote an den Hochschulen nach Fachbereich
  vetCertification: 36304956, // LABB: Zertifikationsstatus berufliche Grundbildung nach Beruf
  gradIncome: 36732664, // EHA: Standardisiertes Bruttoerwerbseinkommen 1 Jahr nach Abschluss
} as const;

type Grid = (string | number | undefined)[][];

async function workbook(id: number, ext: "xlsx" | "xls"): Promise<XLSX.WorkBook> {
  const buf = await fetchRaw(DAM(id), `bfs-dam/${id}.${ext}`);
  return XLSX.read(buf, { type: "buffer" });
}
function grid(wb: XLSX.WorkBook, sheet: string): Grid {
  const ws = wb.Sheets[sheet];
  if (!ws) throw new Error(`sheet ${sheet} missing (have: ${wb.SheetNames.join(", ")})`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: undefined }) as Grid;
}
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v)).replace(/[\u00a0\u202f]/g, " ").replace(/\s+/g, " ").trim();

// ---------- BESTA recruitment difficulty -------------------------------------------------------
async function recruitment(id: number, prefix: "BL" | "HBB" | "HS") {
  const wb = await workbook(id, "xlsx");
  const sheets = {
    easy: grid(wb, `${prefix} leicht gefunden BESCH`),
    hard: grid(wb, `${prefix} schwer gefunden BESCH`),
    none: grid(wb, `${prefix} nicht gefunden BESCH`),
  };
  // Division rows have a NOGA code range in column 0 (e.g. "10-33", "62-63", "84").
  const rows = (g: Grid) => {
    const out: Record<string, { label: string; values: (number | null)[] }> = {};
    for (const r of g) {
      const code = str(r[0]);
      if (!/^\d{1,2}(-\d{1,2})?$/.test(code) || out[code]) continue; // first block only (BESCH-weighted)
      out[code] = { label: str(r[1]), values: r.slice(2).map(parseNum) };
    }
    return out;
  };
  const e = rows(sheets.easy);
  const h = rows(sheets.hard);
  const n = rows(sheets.none);
  // Quarter labels: header row with years then a row of I..IV; values align with columns 2..
  const result: Record<string, { label: string; difficultyPct: number; quarters: number }> = {};
  for (const code of Object.keys(e)) {
    if (!h[code] || !n[code]) continue;
    const len = Math.min(e[code].values.length, h[code].values.length, n[code].values.length);
    const shares: number[] = [];
    for (let i = len - 1; i >= 0 && shares.length < 4; i--) {
      const a = e[code].values[i];
      const b = h[code].values[i];
      const c = n[code].values[i];
      if (a === null || b === null || c === null || a + b + c <= 0) continue;
      shares.push((100 * (b + c)) / (a + b + c));
    }
    if (shares.length === 4)
      result[code] = { label: e[code].label, difficultyPct: round(shares.reduce((s, v) => s + v, 0) / 4, 1), quarters: 4 };
  }
  return result;
}

// ---------- SAKE telework by NOGA section (latest year, total = occasional+regular+usual) ----
async function telework() {
  const g = grid(await workbook(ASSETS.telework, "xlsx"), "Tablang_3");
  const header = g.find((r) => r.some((c) => /^20\d\d/.test(str(c))))!;
  const years = header.map(str).filter((c) => /^20\d\d/.test(c));
  const latestYear = Number(years.at(-1)!.slice(0, 4));
  const out: Record<string, { label: string; pct: number }> = {};
  for (const r of g) {
    const label = str(r[1]);
    const m = /^Total$/.test(label) ? ["", "*", "Total (whole economy)"] : label.match(/^([A-Z](?:\/[A-Z])*(?:-[A-Z])?)\s*-?\s*(.*)$/);
    if (!m || out[m[1].trim()]) continue;
    const nums = r.slice(2).map(parseNum);
    const total = nums[years.length * 4 - 1]; // last block's "Total" column
    if (total !== null && total !== undefined) out[m[1].trim()] = { label: m[2].trim(), pct: round(total * 100, 1) };
  }
  return { year: latestYear, bySection: out };
}

// ---------- usual weekly hours of full-time employees by NOGA section ------------------------
async function hours() {
  const wb = await workbook(ASSETS.hours, "xlsx");
  const sheet = wb.SheetNames.filter((s) => /^20\d\d$/.test(s)).sort().at(-1)!;
  const g = grid(wb, sheet);
  const start = g.findIndex((r) => /Wöchentliche übliche Arbeitszeit/.test(str(r[0])));
  const out: Record<string, { label: string; hours: number }> = {};
  for (const r of g.slice(start + 1)) {
    const code = str(r[0]);
    if (!/^[A-Z](\/[A-Z])*(-[A-Z])?$/.test(code)) continue;
    const nums = r.slice(2).map(parseNum).filter((x): x is number => x !== null);
    out[code] = { label: str(r[1]), hours: round(nums.at(-1)!, 2) };
  }
  return { year: Number(sheet), bySection: out };
}

// ---------- night work 2013 by ISCO major group ---------------------------------------------
async function nightWork() {
  const g = grid(await workbook(ASSETS.nightWork, "xls"), "Deutsch");
  const start = g.findIndex((r) => /^Berufshauptgruppen ISCO/.test(str(r[0])) && r.length > 5);
  const out: Record<string, { label: string; nightPct: number }> = {};
  let isco = 1;
  for (const r of g.slice(start + 1, start + 10)) {
    const nums = r.slice(1).map((c) => parseNum(c) ?? (str(c) === "X" ? null : parseNum(c)));
    // columns: usual(m,f,t) sometimes(m,f,t) never(m,f,t) total(m,f,t)
    const usual = nums[2] ?? null;
    const sometimes = nums[5] ?? null;
    const total = nums[11] ?? null;
    if (usual === null || sometimes === null || total === null) throw new Error("night-work row parse");
    out[String(isco)] = { label: str(r[0]), nightPct: round((100 * (usual + sometimes)) / total, 1) };
    isco++;
  }
  return { year: 2013, byIsco1: out };
}

// ---------- higher-education study success by field ----------------------------------------
async function studySuccess() {
  const g = grid(await workbook(ASSETS.studySuccess, "xlsx"), "T2");
  const out: Record<string, Record<string, { label: string; noSuccessPct: number }>> = { UH: {}, FH: {} };
  let type: "UH" | "FH" = "UH";
  for (const r of g) {
    const label = str(r[0]);
    const nums = r.slice(1).map(parseNum);
    if (nums.filter((x) => x !== null).length < 5) continue;
    if (label === "UH" || label === "FH") type = label;
    out[type][label === type ? "Total" : label] = { label, noSuccessPct: round(nums[4]!, 1) };
  }
  const cohort = str(grid(await workbook(ASSETS.studySuccess, "xlsx"), "T2")[2]?.[0] ?? "").match(/20\d\d/)?.[0];
  return { cohort: cohort ? Number(cohort) : null, byType: out };
}

// ---------- VET certification status by occupation ------------------------------------------
async function vetCertification() {
  const g = grid(await workbook(ASSETS.vetCertification, "xlsx"), "T26a");
  const title = g.slice(0, 4).map((r) => str(r[0])).join(" ");
  const cohort = Number(title.match(/Eintrittskohorte (20\d\d)/)?.[1]);
  const out: Record<string, { learners: number; passedPct: number; failedPct: number; stillInTrainingPct: number; leftSystemPct: number; nonCompletionPct: number }> = {};
  for (const r of g) {
    const name = str(r[1]);
    if (!name || str(r[0]) !== "" || name === "Total") continue; // field rows carry an ISCED code in col 0
    const nums = r.slice(2).map(parseNum);
    const [learners, , passedPct, , failedPct, , inTrainingPct, , leftPct] = nums;
    if (learners === null || passedPct === null || failedPct === null || leftPct === null || inTrainingPct === null) continue;
    out[name] = {
      learners,
      passedPct,
      failedPct,
      stillInTrainingPct: inTrainingPct,
      leftSystemPct: leftPct,
      nonCompletionPct: round(failedPct + leftPct, 1),
    };
  }
  return { cohort, observedUntil: title.match(/bis (\d{2}\.\d{2}\.20\d\d)/)?.[1] ?? null, byOccupation: out };
}

// ---------- graduate income 1 year after degree ---------------------------------------------
async function gradIncome() {
  const wb = await workbook(ASSETS.gradIncome, "xlsx");
  const parse = (sheet: string) => {
    const g = grid(wb, sheet);
    const year = Number(str(g[1]?.[0]).match(/Abschlussjahr (20\d\d)/)?.[1]);
    const out: Record<string, Record<string, { p25: number | null; median: number | null; p75: number | null }>> = {};
    let level = "";
    for (const r of g) {
      const cells = r.map(str);
      // UH sheet: [level?, field, q1, vk, med, vk, q3, vk, …]; FH sheet: [type?, level?, field, …]
      const idx = cells.findIndex((c, i) => i < 4 && parseNum(c) !== null);
      if (idx < 1) continue;
      const labels = cells.slice(0, idx).filter(Boolean);
      const field = labels.at(-1)!;
      if (labels.length >= 2) level = labels.at(-2)!;
      const nums = r.slice(idx).map(parseNum);
      (out[level] ??= {})[field] = { p25: nums[0], median: nums[2], p75: nums[4] };
    }
    return { year, byLevel: out };
  };
  return { uh: parse("TA3E61-2"), fh: parse("TA3E61-3") };
}

export async function ingestBfsDam() {
  console.log("BFS DAM assets");
  const out = {
    source: "bfs-dam",
    assets: ASSETS,
    recruitment: {
      apprenticeship: await recruitment(ASSETS.recruitApprentice, "BL"),
      higherVet: await recruitment(ASSETS.recruitHigherVet, "HBB"),
      higherEducation: await recruitment(ASSETS.recruitHigherEd, "HS"),
    },
    telework: await telework(),
    hours: await hours(),
    nightWork: await nightWork(),
    studySuccess: await studySuccess(),
    vetCertification: await vetCertification(),
    gradIncome: await gradIncome(),
  };
  writeIngested("bfs-dam", out);
  return out;
}

if (require.main === module) ingestBfsDam().catch((e) => {
  console.error(e);
  process.exit(1);
});
