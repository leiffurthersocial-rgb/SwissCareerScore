import { DIMENSIONS, DIMENSION_BY_KEY, DIMENSION_IDS, type DimensionId } from "./dimensions";
import type { Filters } from "./filters";
import { PRESETS, PRESET_IDS, type PresetId } from "./presets";
import { EDU_TYPES, ENTITY_KINDS, LANGUAGE_REGIONS, type EduType, type EntityKind, type LanguageRegion, type Route } from "./schema";
import { toPercentages } from "./scoring/weights";

/**
 * Shareable app state ↔ URL search params. No accounts: the URL *is* the saved setting.
 *
 *   p=money                     preset (weights omitted when unchanged from preset)
 *   w=pay.40_stb.10_ai.5        custom weights in percent, by dimension key
 *   l=pay.stb                   locked weights
 *   k=occupation  r=vocational  e=EFZ.HF   y=4   lang=fr   min=6000   q=pflege
 *   c=occ-a.occ-b               compare selection (≤ 4)
 */
export interface AppState {
  preset: PresetId | "custom";
  weights: Record<DimensionId, number>;
  locked: Set<DimensionId>;
  filters: Filters;
  compare: string[];
}

export const MAX_COMPARE = 4;

export function defaultState(): AppState {
  return {
    preset: "balanced",
    weights: toPercentages(PRESETS.balanced),
    locked: new Set(),
    filters: {},
    compare: [],
  };
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

export function weightsEqual(a: Record<DimensionId, number>, b: Record<DimensionId, number>): boolean {
  return DIMENSION_IDS.every((id) => Math.abs((a[id] ?? 0) - (b[id] ?? 0)) < 0.05);
}

export function encodeState(s: AppState): URLSearchParams {
  const p = new URLSearchParams();
  const presetWeights = s.preset !== "custom" ? toPercentages(PRESETS[s.preset]) : null;
  if (s.preset !== "custom" && s.preset !== "balanced") p.set("p", s.preset);
  if (!presetWeights || !weightsEqual(presetWeights, s.weights)) {
    if (s.preset !== "custom") p.set("p", s.preset);
    const parts = DIMENSION_IDS.filter((id) => s.weights[id] > 0).map(
      (id) => `${DIMENSIONS[id].key}.${round1(s.weights[id])}`,
    );
    p.set("w", parts.join("_") || "none");
  }
  if (s.locked.size) p.set("l", [...s.locked].map((id) => DIMENSIONS[id].key).join("."));
  const f = s.filters;
  if (f.kinds?.length) p.set("k", f.kinds.join("."));
  if (f.routes?.length) p.set("r", f.routes.join("."));
  if (f.eduTypes?.length) p.set("e", f.eduTypes.join("."));
  if (f.maxYears !== undefined) p.set("y", String(f.maxYears));
  if (f.language) p.set("lang", f.language);
  if (f.minPay !== undefined) p.set("min", String(f.minPay));
  if (f.query) p.set("q", f.query);
  if (s.compare.length) p.set("c", s.compare.slice(0, MAX_COMPARE).join("~"));
  return p;
}

function num(v: string | null): number | undefined {
  if (v === null || v.trim() === "") return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
}

/** Tolerant decoder: unknown keys/values are ignored, never thrown. */
export function decodeState(params: URLSearchParams | Record<string, string | string[] | undefined>): AppState {
  const get = (k: string): string | null => {
    if (params instanceof URLSearchParams) return params.get(k);
    const v = params[k];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };
  const s = defaultState();
  const preset = get("p");
  if (preset && (PRESET_IDS as readonly string[]).includes(preset)) {
    s.preset = preset as PresetId;
    s.weights = toPercentages(PRESETS[s.preset]);
  }
  const w = get("w");
  if (w) {
    const raw: Partial<Record<DimensionId, number>> = {};
    if (w !== "none") {
      for (const part of w.split("_")) {
        const dot = part.indexOf(".");
        if (dot < 1) continue;
        const id = DIMENSION_BY_KEY[part.slice(0, dot)];
        const x = Number(part.slice(dot + 1));
        if (id && Number.isFinite(x) && x >= 0) raw[id] = x;
      }
    }
    s.weights = toPercentages(raw);
    const presetW = s.preset !== "custom" ? toPercentages(PRESETS[s.preset]) : null;
    if (!presetW || !weightsEqual(presetW, s.weights)) s.preset = "custom";
  }
  const l = get("l");
  if (l) for (const key of l.split(".")) if (DIMENSION_BY_KEY[key]) s.locked.add(DIMENSION_BY_KEY[key]);
  const list = <T extends string>(v: string | null, allowed: readonly T[]): T[] | undefined => {
    if (!v) return undefined;
    const out = v.split(".").filter((x): x is T => (allowed as readonly string[]).includes(x));
    return out.length ? out : undefined;
  };
  s.filters = {
    kinds: list<EntityKind>(get("k"), ENTITY_KINDS),
    routes: list<Route>(get("r"), ["vocational", "academic", "mixed"]),
    eduTypes: list<EduType>(get("e"), EDU_TYPES),
    maxYears: num(get("y")),
    language: (LANGUAGE_REGIONS as readonly string[]).includes(get("lang") ?? "")
      ? (get("lang") as LanguageRegion)
      : undefined,
    minPay: num(get("min")),
    query: get("q") ?? undefined,
  };
  for (const k of Object.keys(s.filters) as (keyof Filters)[]) if (s.filters[k] === undefined) delete s.filters[k];
  const c = get("c");
  if (c) s.compare = [...new Set(c.split("~").filter((x) => /^(occ|edu)-[a-z0-9-]+$/.test(x)))].slice(0, MAX_COMPARE);
  return s;
}
