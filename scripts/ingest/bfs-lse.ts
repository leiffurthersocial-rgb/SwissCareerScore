/**
 * BFS Lohnstrukturerhebung (LSE) 2024 — monthly gross wage (full-time equivalent, incl. 1/12 of
 * 13th salary and bonuses), private + public sector, by ISCO-08 2-digit group, age band and
 * percentile. Source: BFS PXWeb table px-x-0304010000_205 (machine-readable API).
 */
import { fetchRaw, writeIngested } from "./lib";

const TABLE = "px-x-0304010000_205";
const API = `https://www.pxweb.bfs.admin.ch/api/v1/de/${TABLE}/${TABLE}.px`;
export const LSE_SOURCE_URL = `https://www.pxweb.bfs.admin.ch/pxweb/de/${TABLE}/-/${TABLE}.px/`;

interface PxMeta {
  variables: { code: string; text: string; values: string[]; valueTexts: string[] }[];
}

export async function ingestLse(year = "2024") {
  console.log(`BFS LSE ${year} (${TABLE})`);
  const meta = JSON.parse((await fetchRaw(API, `bfs-lse/${TABLE}-meta.json`)).toString()) as PxMeta;
  const v = (code: string) => meta.variables.find((x) => x.code === code)!;
  const yearIdx = v("Jahr").valueTexts.indexOf(year);
  if (yearIdx < 0) throw new Error(`year ${year} not in ${TABLE}`);
  const query = {
    query: [
      { code: "Jahr", selection: { filter: "item", values: [v("Jahr").values[yearIdx]] } },
      { code: "Grossregion", selection: { filter: "item", values: ["-1"] } },
      { code: "Berufsgruppe", selection: { filter: "all", values: ["*"] } },
      { code: "Lebensalter", selection: { filter: "all", values: ["*"] } },
      { code: "Geschlecht", selection: { filter: "item", values: ["-1"] } },
      { code: "Zentralwert und andere Perzentile", selection: { filter: "all", values: ["*"] } },
    ],
    response: { format: "json" },
  };
  const body = JSON.stringify(query);
  const data = JSON.parse(
    (
      await fetchRaw(API, `bfs-lse/${TABLE}-${year}-ch.json`, {
        method: "POST",
        body,
        headers: { "content-type": "application/json" },
      })
    ).toString(),
  ) as { columns: { code: string }[]; data: { key: string[]; values: string[] }[] };

  const groupText = Object.fromEntries(v("Berufsgruppe").values.map((c, i) => [c, v("Berufsgruppe").valueTexts[i]]));
  const ageCode = Object.fromEntries(v("Lebensalter").values.map((c, i) => [c, v("Lebensalter").valueTexts[i]]));
  const pctCode = Object.fromEntries(
    v("Zentralwert und andere Perzentile").values.map((c, i) => [c, v("Zentralwert und andere Perzentile").valueTexts[i]]),
  );
  const cols = data.columns.map((c) => c.code);
  const iGroup = cols.indexOf("Berufsgruppe");
  const iAge = cols.indexOf("Lebensalter");
  const iPct = cols.indexOf("Zentralwert und andere Perzentile");

  type Row = Record<string, number | null>;
  const groups: Record<string, { code: string; label: string; values: Record<string, Row> }> = {};
  for (const d of data.data) {
    const gCode = d.key[iGroup];
    const label = groupText[gCode].replace(/^>\s*/, "");
    const isco = gCode === "-1" ? "total" : (label.match(/^(\d{1,2})\s/)?.[1] ?? gCode);
    const g = (groups[isco] ??= { code: isco, label, values: {} });
    const age = ageCode[d.key[iAge]];
    const pct = pctCode[d.key[iPct]];
    const raw = d.values[0];
    const num = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : null;
    (g.values[age] ??= {})[pct] = num;
  }
  const out = {
    source: "bfs-lse-2024",
    table: TABLE,
    year: Number(year),
    unit: "CHF/month (gross, full-time equivalent)",
    note: "Grossregion = Schweiz, Geschlecht = Total, private and public sector combined.",
    groups,
  };
  writeIngested("bfs-lse-2024", out);
  return out;
}

/** LSE 2024 by highest completed education (table px-x-0304010000_202), Switzerland, all positions. */
const EDU_TABLE = "px-x-0304010000_202";
const EDU_API = `https://www.pxweb.bfs.admin.ch/api/v1/de/${EDU_TABLE}/${EDU_TABLE}.px`;
export const LSE_EDU_SOURCE_URL = `https://www.pxweb.bfs.admin.ch/pxweb/de/${EDU_TABLE}/-/${EDU_TABLE}.px/`;

export async function ingestLseEducation(year = "2024") {
  console.log(`BFS LSE ${year} by education (${EDU_TABLE})`);
  const meta = JSON.parse((await fetchRaw(EDU_API, `bfs-lse/${EDU_TABLE}-meta.json`)).toString()) as PxMeta;
  const v = (code: string) => meta.variables.find((x) => x.code === code)!;
  const yearIdx = v("Jahr").valueTexts.indexOf(year);
  const query = {
    query: [
      { code: "Jahr", selection: { filter: "item", values: [v("Jahr").values[yearIdx]] } },
      { code: "Grossregion", selection: { filter: "item", values: ["-1"] } },
      { code: "Ausbildung", selection: { filter: "all", values: ["*"] } },
      { code: "Berufliche Stellung", selection: { filter: "item", values: ["-1"] } },
      { code: "Geschlecht", selection: { filter: "item", values: ["-1"] } },
      { code: "Zentralwert und andere Perzentile", selection: { filter: "all", values: ["*"] } },
    ],
    response: { format: "json" },
  };
  const data = JSON.parse(
    (
      await fetchRaw(EDU_API, `bfs-lse/${EDU_TABLE}-${year}-ch.json`, {
        method: "POST",
        body: JSON.stringify(query),
        headers: { "content-type": "application/json" },
      })
    ).toString(),
  ) as { columns: { code: string }[]; data: { key: string[]; values: string[] }[] };
  const cols = data.columns.map((c) => c.code);
  const iEdu = cols.indexOf("Ausbildung");
  const iPct = cols.indexOf("Zentralwert und andere Perzentile");
  const eduText = Object.fromEntries(v("Ausbildung").values.map((c, i) => [c, v("Ausbildung").valueTexts[i]]));
  const pctText = Object.fromEntries(
    v("Zentralwert und andere Perzentile").values.map((c, i) => [c, v("Zentralwert und andere Perzentile").valueTexts[i]]),
  );
  const out: Record<string, { label: string; values: Record<string, number | null> }> = {};
  for (const d of data.data) {
    const code = d.key[iEdu];
    const raw = d.values[0];
    (out[code] ??= { label: eduText[code], values: {} }).values[pctText[d.key[iPct]]] = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : null;
  }
  writeIngested("bfs-lse-2024-education", { source: "bfs-lse-2024-education", table: EDU_TABLE, year: Number(year), byEducation: out });
  return out;
}

if (require.main === module) Promise.all([ingestLse(), ingestLseEducation()]).catch((e) => {
  console.error(e);
  process.exit(1);
});
