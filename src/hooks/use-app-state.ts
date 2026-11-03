"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scorable } from "@/lib/dataset";
import { DIMENSION_IDS, type DimensionId } from "@/lib/dimensions";
import { PRESETS, type PresetId } from "@/lib/presets";
import { scoreEntities, setWeight as setWeightLocked, toPercentages, type EntityResult } from "@/lib/scoring";
import { decodeState, encodeState, MAX_COMPARE, type AppState } from "@/lib/url-state";
import type { Filters } from "@/lib/filters";

/**
 * Single source of truth for weights/filters/compare. Initialised from the URL; every change is
 * written back with history.replaceState (no navigation), so the URL is always shareable.
 */
export function useAppState() {
  const params = useSearchParams();
  const [state, setState] = useState<AppState>(() => decodeState(new URLSearchParams(params.toString())));
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const qs = encodeState(state).toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    window.history.replaceState(window.history.state, "", url);
  }, [state]);

  const activeDims = useMemo(() => DIMENSION_IDS.filter((d) => state.weights[d] > 0), [state.weights]);

  const applyPreset = useCallback((p: PresetId) => {
    setState((s) => ({ ...s, preset: p, weights: toPercentages(PRESETS[p]), locked: new Set() }));
  }, []);

  const setWeight = useCallback((id: DimensionId, pct: number, visible: readonly DimensionId[]) => {
    setState((s) => ({ ...s, preset: "custom", weights: setWeightLocked(s.weights, s.locked, id, pct, visible) }));
  }, []);

  const setWeights = useCallback((w: Partial<Record<DimensionId, number>>) => {
    setState((s) => ({ ...s, preset: "custom", weights: toPercentages(w), locked: new Set() }));
  }, []);

  const toggleLock = useCallback((id: DimensionId) => {
    setState((s) => {
      const locked = new Set(s.locked);
      if (locked.has(id)) locked.delete(id);
      else locked.add(id);
      return { ...s, locked };
    });
  }, []);

  const setFilters = useCallback((f: Filters) => setState((s) => ({ ...s, filters: f })), []);

  const toggleCompare = useCallback((id: string) => {
    setState((s) => {
      if (s.compare.includes(id)) return { ...s, compare: s.compare.filter((x) => x !== id) };
      if (s.compare.length >= MAX_COMPARE) return s;
      return { ...s, compare: [...s.compare, id] };
    });
  }, []);
  const clearCompare = useCallback(() => setState((s) => ({ ...s, compare: [] })), []);

  const queryString = useMemo(() => encodeState(state).toString(), [state]);

  return { state, activeDims, applyPreset, setWeight, setWeights, toggleLock, setFilters, toggleCompare, clearCompare, queryString };
}

/** Score all entities for the current weights. Memoised; full pipeline incl. MC + sensitivity. */
export function useScores(weights: Record<DimensionId, number>): Map<string, EntityResult> {
  return useMemo(() => {
    const res = scoreEntities(scorable, weights, { draws: 300 });
    return new Map(res.map((r) => [r.id, r]));
  }, [weights]);
}
