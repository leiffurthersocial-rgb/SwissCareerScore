/**
 * berufsberatung.ch (official Swiss career-guidance portal, SDBB) — every page cited by an
 * entity's pathway or rubric is fetched and the "Dauer" (duration) statements and the
 * apprentice-wage recommendations are extracted. The build step cross-checks each pathway
 * stage's `years` against these statements and fails on mismatch.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fetchRaw, parseNum, ROOT, writeIngested } from "./lib";

const ENTITY_DIR = path.join(ROOT, "data", "entities");

function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n\s*\n+/g, "\n");
}

/** All numbers of years stated in a duration snippet, including both ends of ranges. */
export function yearsMentioned(input: string): number[] {
  let snippet = input;
  const out = new Set<number>();
  const re = /(\d+(?:[.,]\d+)?)\s*(?:(?:–|-|bis|oder)\s*(\d+(?:[.,]\d+)?))?\s*(Jahre|Jahr|Vollzeit|Semester|Monate)/g;
  snippet = snippet.replace(/Mindestalter[^|]*/g, "");
  let m: RegExpExecArray | null;
  while ((m = re.exec(snippet))) {
    const div = m[3] === "Semester" ? 2 : m[3] === "Monate" ? 12 : 1;
    const q = (x: number | null) => (x === null ? null : Math.round((x / div) * 4) / 4);
    const a = q(parseNum(m[1]));
    const b = m[2] ? q(parseNum(m[2])) : null;
    if (a !== null) out.add(a);
    if (b !== null) out.add(b);
    if (a !== null && b !== null) for (let x = a; x <= b; x += 0.25) out.add(x);
  }
  return [...out].sort((x, y) => x - y);
}

export async function ingestBerufsberatung() {
  console.log("berufsberatung.ch");
  const urls = new Set<string>();
  for (const f of readdirSync(ENTITY_DIR).filter((x) => x.endsWith(".json"))) {
    const e = JSON.parse(readFileSync(path.join(ENTITY_DIR, f), "utf8"));
    for (const s of e.pathway ?? []) if (s.sourceUrl.includes("berufsberatung.ch")) urls.add(s.sourceUrl);
  }
  const pages: Record<string, { durationSnippets: string[]; yearsMentioned: number[]; apprenticeWages: { year: number; chf: string }[] }> = {};
  const sorted = [...urls].sort();
  const texts = new Map<string, string>();
  // polite concurrency: 8 parallel requests
  for (let i = 0; i < sorted.length; i += 8) {
    await Promise.all(
      sorted.slice(i, i + 8).map(async (url) => {
        const slug = url.replace(/^https:\/\/www\.berufsberatung\.ch\/de\//, "").replace(/\//g, "_");
        texts.set(url, pageText((await fetchRaw(url, `berufsberatung/${slug}.html`)).toString()));
      }),
    );
  }
  for (const url of sorted) {
    const text = texts.get(url)!;
    const snippets: string[] = [];
    const re = /Dauer:?\s*\n([^\n]+(?:\n[^\n]+){0,3})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const lines = m[1].split("\n").map((s) => s.trim()).filter(Boolean);
      const keep = lines.filter((l) => /\d/.test(l) && /Jahr|Vollzeit|Semester|Monat/.test(l));
      if (keep.length) snippets.push(keep.join(" | "));
    }
    const wages: { year: number; chf: string }[] = [];
    const wr = /(\d)\. Lehrjahr: CHF ([\d’'–\-. ]+)/g;
    while ((m = wr.exec(text))) wages.push({ year: Number(m[1]), chf: m[2].replace(/[.\s]+$/, "").trim() });
    pages[url] = { durationSnippets: snippets, yearsMentioned: yearsMentioned(snippets.join(" ")), apprenticeWages: wages };
    if (!snippets.length) console.warn(`  ! no duration statement found on ${url}`);
  }
  console.log(`  ${Object.keys(pages).length} pages`);
  writeIngested("berufsberatung", { source: "berufsberatung", retrieved: new Date().toISOString().slice(0, 10), pages });
}

if (require.main === module) ingestBerufsberatung().catch((e) => {
  console.error(e);
  process.exit(1);
});
