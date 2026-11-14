"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Offer, Programme } from "@/lib/dataset-types";
import { catalogue } from "@/lib/programmes";

export type Sort =
  "field" | "score" | "payMid" | "payEntry" | "unemployment" | "nonCompletion" | "years";
export const SORTS: Sort[] = [
  "field",
  "score",
  "payMid",
  "payEntry",
  "unemployment",
  "nonCompletion",
  "years",
];
export const ADMISSIONS = ["open", "ems", "selection", "work"] as const;
export const REGIONS = [
  "zurich",
  "lemanic",
  "mittelland",
  "northwest",
  "central",
  "east",
  "ticino",
  "online",
] as const;
export const LANGUAGES = ["de", "fr", "it", "en"] as const;
export const YEARS = [3, 4, 5, 6] as const;
export const MIN_PAY = [7000, 8000, 9000, 10000] as const;
export const MAX_UNEMP = [1, 2, 3, 5] as const;
export const MAX_DROP = [10, 15, 20, 25] as const;

export interface MaturaFilters {
  q: string;
  groups: string[];
  types: string[];
  admissions: string[];
  regions: string[];
  languages: string[];
  inst: string;
  strongOnly: boolean;
  hideMaster: boolean;
  maxYears?: number;
  minPay?: number;
  maxUnemp?: number;
  maxDrop?: number;
  sort: Sort;
}

export const EMPTY: MaturaFilters = {
  q: "",
  groups: [],
  types: [],
  admissions: [],
  regions: [],
  languages: [],
  inst: "",
  strongOnly: false,
  hideMaster: false,
  sort: "field",
};

/** Page-specific query keys (all start with "m" so they never clash with the app state). */
const KEYS = [
  "mq",
  "mg",
  "mt",
  "ma",
  "mr",
  "ml",
  "mi",
  "ms",
  "mh",
  "my",
  "mp",
  "mu",
  "md",
  "mo",
] as const;

const list = (v: string | null, allowed?: readonly string[]) =>
  (v ?? "")
    .split(".")
    .filter(Boolean)
    .filter((x) => !allowed || allowed.includes(x));
const num = (v: string | null) => {
  if (v === null || v === "") return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
};

export function decodeFilters(p: URLSearchParams): MaturaFilters {
  const sort = p.get("mo") as Sort | null;
  const inst = p.get("mi") ?? "";
  return {
    q: p.get("mq") ?? "",
    groups: list(p.get("mg"), Object.keys(catalogue.groups)),
    types: list(p.get("mt"), ["ETH", "UH", "FH", "PH"]),
    admissions: list(p.get("ma"), ADMISSIONS),
    regions: list(p.get("mr"), REGIONS),
    languages: list(p.get("ml"), LANGUAGES),
    inst: catalogue.institutions[inst] ? inst : "",
    strongOnly: p.get("ms") === "1",
    hideMaster: p.get("mh") === "1",
    maxYears: num(p.get("my")),
    minPay: num(p.get("mp")),
    maxUnemp: num(p.get("mu")),
    maxDrop: num(p.get("md")),
    sort: sort && SORTS.includes(sort) ? sort : "field",
  };
}

export function encodeFilters(f: MaturaFilters, into: URLSearchParams) {
  for (const k of KEYS) into.delete(k);
  const set = (k: string, v: string | undefined | false) => v && into.set(k, v);
  set("mq", f.q.trim() || undefined);
  set("mg", f.groups.join("."));
  set("mt", f.types.join("."));
  set("ma", f.admissions.join("."));
  set("mr", f.regions.join("."));
  set("ml", f.languages.join("."));
  set("mi", f.inst);
  set("ms", f.strongOnly && "1");
  set("mh", f.hideMaster && "1");
  set("my", f.maxYears?.toString());
  set("mp", f.minPay?.toString());
  set("mu", f.maxUnemp?.toString());
  set("md", f.maxDrop?.toString());
  set("mo", f.sort !== "field" && f.sort);
  return into;
}

/** Filter state synced to the URL with history.replaceState (shareable, survives reload). */
export function useMaturaFilters() {
  const [f, setF] = useState<MaturaFilters>(EMPTY);
  const ready = useRef(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the URL once after hydration
    setF(decodeFilters(new URLSearchParams(window.location.search)));
    ready.current = true;
  }, []);
  useEffect(() => {
    if (!ready.current) return;
    const p = encodeFilters(f, new URLSearchParams(window.location.search));
    const qs = p.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}`,
    );
  }, [f]);
  const update = (patch: Partial<MaturaFilters>) => setF((s) => ({ ...s, ...patch }));
  const toggle = (key: "groups" | "types" | "admissions" | "regions" | "languages", v: string) =>
    setF((s) => ({
      ...s,
      [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v],
    }));
  const reset = () => setF((s) => ({ ...EMPTY, sort: s.sort }));
  return { f, update, toggle, reset };
}

/** Does any institution-level filter apply (institution, region, language, strong only)? */
export const institutionFilterActive = (f: MaturaFilters) =>
  !!f.inst || f.regions.length > 0 || f.languages.length > 0 || f.strongOnly;

export function activeCount(f: MaturaFilters): number {
  return (
    (f.q.trim() ? 1 : 0) +
    f.groups.length +
    f.types.length +
    f.admissions.length +
    f.regions.length +
    f.languages.length +
    (f.inst ? 1 : 0) +
    (f.strongOnly ? 1 : 0) +
    (f.hideMaster ? 1 : 0) +
    [f.maxYears, f.minPay, f.maxUnemp, f.maxDrop].filter((x) => x !== undefined).length
  );
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export interface Row {
  p: Programme;
  /** Offers that pass the institution-level filters (all offers if none is active). */
  match: Offer[];
  payEntry: number | null;
  payMid: number | null;
}

/** Apply all filters and the sort. Pay filters/sorts use the matching institutions when an institution-level filter is active. */
export function useFilteredProgrammes(
  f: MaturaFilters,
  score: (p: Programme) => number | null,
  deps: unknown,
) {
  return useMemo(() => {
    const { programmes, institutions, groups } = catalogue;
    const groupIds = Object.keys(groups);
    const n = normalize(f.q.trim());
    const instActive = institutionFilterActive(f);
    const rows: Row[] = [];
    for (const p of programmes) {
      if (f.groups.length && !f.groups.includes(p.group)) continue;
      if (f.types.length && !f.types.includes(p.type)) continue;
      if (f.admissions.length && !f.admissions.includes(p.admission)) continue;
      if (f.hideMaster && p.masterOnly) continue;
      if (f.maxYears !== undefined && p.years > f.maxYears) continue;
      if (f.maxUnemp !== undefined && (p.unemployment.value ?? Infinity) > f.maxUnemp) continue;
      if (f.maxDrop !== undefined && (p.nonCompletion.value ?? Infinity) > f.maxDrop) continue;
      if (n) {
        const hay = normalize(
          `${p.name.en} ${p.name.de} ${p.institutions.map((i) => `${institutions[i].name} ${institutions[i].short} ${institutions[i].city}`).join(" ")}`,
        );
        if (!n.split(/\s+/).every((w) => hay.includes(w))) continue;
      }
      const match = p.offers.filter((o) => {
        const i = institutions[o.institution];
        return (
          (!f.inst || o.institution === f.inst) &&
          (!f.regions.length || i.regions.some((r) => f.regions.includes(r))) &&
          (!f.languages.length || i.languages.some((l) => f.languages.includes(l))) &&
          (!f.strongOnly || o.strong)
        );
      });
      if (instActive && !match.length) continue;
      const best = (k: "payEntry" | "payMid") =>
        instActive ? Math.max(...match.map((o) => o[k] ?? 0)) || null : p[k].value;
      const row: Row = {
        p,
        match: instActive ? match : p.offers,
        payEntry: best("payEntry"),
        payMid: best("payMid"),
      };
      if (f.minPay !== undefined && (row.payMid ?? 0) < f.minPay) continue;
      rows.push(row);
    }
    const key: Record<Sort, (r: Row) => number> = {
      field: (r) =>
        groupIds.indexOf(r.p.group) * 1000 + (r.p.masterOnly ? 500 : 0) - (score(r.p) ?? 0),
      score: (r) => -(score(r.p) ?? -1),
      payMid: (r) => -(r.payMid ?? 0),
      payEntry: (r) => -(r.payEntry ?? 0),
      unemployment: (r) => r.p.unemployment.value ?? 99,
      nonCompletion: (r) => r.p.nonCompletion.value ?? 99,
      years: (r) => r.p.years,
    };
    return rows.sort((a, b) => key[f.sort](a) - key[f.sort](b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, deps]);
}
