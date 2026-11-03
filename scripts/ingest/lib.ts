/**
 * Shared helpers for ingestion scripts. Every downloaded file is stored untouched under
 * data/raw/<source>/ with its sha256 + retrieval date in data/raw/manifest.json, so parsed
 * numbers can always be traced back (and re-parsed offline with --offline).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(__dirname, "..", "..");
export const RAW_DIR = path.join(ROOT, "data", "raw");
export const INGESTED_DIR = path.join(ROOT, "data", "ingested");
const MANIFEST = path.join(RAW_DIR, "manifest.json");

export const OFFLINE = process.argv.includes("--offline");

export interface ManifestEntry {
  url: string;
  file: string;
  sha256: string;
  retrieved: string;
  bytes: number;
}

function readManifest(): Record<string, ManifestEntry> {
  return existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
}

function writeManifest(m: Record<string, ManifestEntry>) {
  const sorted = Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + "\n");
}

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Download `url` to data/raw/<relFile> (or reuse it with --offline) and record it in the manifest.
 * `init` allows POST bodies (PXWeb queries).
 */
export async function fetchRaw(url: string, relFile: string, init?: RequestInit): Promise<Buffer> {
  const abs = path.join(RAW_DIR, relFile);
  if (OFFLINE) {
    if (!existsSync(abs)) throw new Error(`--offline but ${relFile} is missing`);
    return readFileSync(abs);
  }
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "user-agent": "SwissCareerScore-ingest/1.0 (+https://github.com)", ...(init?.headers ?? {}) },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, buf);
      const m = readManifest();
      m[relFile] = {
        url,
        file: relFile,
        sha256: sha256(buf),
        retrieved: new Date().toISOString().slice(0, 10),
        bytes: buf.length,
      };
      writeManifest(m);
      return buf;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
  throw lastErr;
}

export function manifestEntry(relFile: string): ManifestEntry | undefined {
  return readManifest()[relFile];
}

export function writeIngested(name: string, data: unknown) {
  mkdirSync(INGESTED_DIR, { recursive: true });
  writeFileSync(path.join(INGESTED_DIR, `${name}.json`), JSON.stringify(data, null, 2) + "\n");
  console.log(`  → data/ingested/${name}.json`);
}

/** Parse numbers like "3 642", "7,2 %", "(49.2)", "1’943" — returns null for "X", "*", "...", "**". */
export function parseNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[()%\s’'  ]/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

export function round(x: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}
