/**
 * SECO labour-market statistics (arbeit.swiss):
 *  1. "Meldepflichtige Berufsarten 2027" — registered unemployment rate per CH-ISCO-19 Berufsart
 *     for every occupation type with a rate ≥ 5 % (reference period Q4 2025 – Q3 2026).
 *  2. Monthly "Die Lage auf dem Arbeitsmarkt" reports, Table 14 — unemployment rate by ISCO major
 *     group (1-digit). We average all monthly reports in the same reference window.
 * Occupations NOT on list (1) are known to have a rate < 5 % for that period (censoring); the
 * build step uses the major-group rate, capped at 4.9 %, for them.
 */
import { fetchRaw, parseNum, round, writeIngested } from "./lib";
import { pdfLines } from "./pdf";

const BASE = "https://www.arbeit.swiss";
const STMP_PAGE = `${BASE}/de/arbeitgebende/stellenmeldepflicht-checkup-2027`;
const STATS_PAGE = `${BASE}/de/informationszentrum/arbeitsmarktstatistik-schweiz`;
export const SECO_STMP_SOURCE = STMP_PAGE;
export const SECO_STATS_SOURCE = STATS_PAGE;
const WINDOW = { from: "2025-10", to: "2026-09" };

function findFiles(html: string): { url: string; name: string }[] {
  const out: { url: string; name: string }[] = [];
  const re = /(\/api\/media\/fileservice\/[^"\\]+\.(?:pdf|xlsx))/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    const after = html.slice(m.index + m[1].length, m.index + m[1].length + 400);
    const name = after.match(/([\w\-. äöüÄÖÜ%]+\.(?:pdf|xlsx))/)?.[1]?.trim() ?? "";
    out.push({ url: BASE + m[1], name });
  }
  return out;
}

async function ingestStmpList() {
  const html = (await fetchRaw(STMP_PAGE, "seco/stellenmeldepflicht-checkup-2027.html")).toString();
  const file = findFiles(html).find((f) => /meldepflichtigen Berufsarten DE von 2027/i.test(f.name));
  if (!file) throw new Error("2027 list PDF not found on page");
  const pdf = await fetchRaw(file.url, "seco/meldepflichtige-berufsarten-2027-de.pdf");
  const lines = await pdfLines(pdf);
  const rows: Record<string, { code: string; name: string; unemployed: number; employed: number; rate: number }> = {};
  let last: string | null = null;
  for (const l of lines) {
    const first = l.items[0]?.str.trim() ?? "";
    const tail = l.items[l.items.length - 1]?.str.trim() ?? "";
    if (/^\d{4,5}$/.test(first) && /%$/.test(tail) && l.items.length >= 5) {
      const name = l.items.filter((i) => i.x > l.items[0].x + 20 && i.x < 380).map((i) => i.str).join(" ");
      const nums = l.items.filter((i) => i.x >= 380).map((i) => i.str);
      rows[first] = {
        code: first,
        name: name.trim(),
        unemployed: parseNum(nums[0])!,
        employed: parseNum(nums[1])!,
        rate: parseNum(nums[2])!,
      };
      last = first;
    } else if (last && l.items.length === 1 && l.items[0].x > 100 && l.items[0].x < 380) {
      rows[last].name += " " + l.text;
    } else {
      last = null;
    }
  }
  const n = Object.keys(rows).length;
  if (n < 30) throw new Error(`parsed only ${n} rows from list`);
  console.log(`  parsed ${n} occupation types ≥ 5 %`);
  return { sourceUrl: STMP_PAGE, fileUrl: file.url, period: "2025-Q4 to 2026-Q3", threshold: 5, rows };
}

async function ingestMajorGroups() {
  const html = (await fetchRaw(STATS_PAGE, "seco/arbeitsmarktstatistik-schweiz.html")).toString();
  const files = findFiles(html)
    .map((f) => ({ ...f, month: f.name.match(/^(\d{4}-\d{2})_Die_Lage_auf_dem_Arbeitsmarkt_DE\.pdf$/)?.[1] }))
    .filter((f): f is typeof f & { month: string } => !!f.month && f.month >= WINDOW.from && f.month <= WINDOW.to)
    .sort((a, b) => a.month.localeCompare(b.month));
  if (!files.length) throw new Error("no monthly reports found in window");
  const perMonth: Record<string, Record<string, number>> = {};
  const labels: Record<string, string> = {};
  for (const f of files) {
    const lines = await pdfLines(await fetchRaw(f.url, `seco/lage-${f.month}.pdf`));
    const start = lines.findIndex((l) => /Tabelle\s*14/.test(l.text.replace(/\s/g, "")) || /^Tabelle14/.test(l.text.replace(/\s/g, "")));
    if (start < 0) throw new Error(`table 14 not found in ${f.month}`);
    const rates: Record<string, number> = {};
    for (const l of lines.slice(start + 1, start + 30)) {
      if (/^Quelle/.test(l.text)) break;
      const m = l.text.match(/^([0-9])\s+(.+?)\s+(\d+,\d)\s/);
      if (m) {
        rates[m[1]] = parseNum(m[3])!;
        labels[m[1]] = m[2].trim();
      }
    }
    if (Object.keys(rates).length < 9) throw new Error(`table 14 incomplete in ${f.month}`);
    perMonth[f.month] = rates;
  }
  const months = Object.keys(perMonth);
  const avg: Record<string, { label: string; rate: number; months: number }> = {};
  for (const code of Object.keys(labels)) {
    const vals = months.map((m) => perMonth[m][code]).filter((x) => x !== undefined);
    avg[code] = { label: labels[code], rate: round(vals.reduce((s, v) => s + v, 0) / vals.length, 2), months: vals.length };
  }
  console.log(`  averaged major-group rates over ${months.length} monthly reports (${months[0]}…${months.at(-1)})`);
  return { sourceUrl: STATS_PAGE, window: WINDOW, monthsUsed: months, perMonth, average: avg };
}

export async function ingestSeco() {
  console.log("SECO unemployment");
  const stmp = await ingestStmpList();
  const major = await ingestMajorGroups();
  const out = { source: "seco", stmp, majorGroups: major };
  writeIngested("seco-unemployment", out);
  return out;
}

if (require.main === module) ingestSeco().catch((e) => {
  console.error(e);
  process.exit(1);
});
