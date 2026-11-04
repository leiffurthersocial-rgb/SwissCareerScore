"use client";
import { AlertTriangle, Lock, LockOpen, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { dataset } from "@/lib/dataset";
import { DIMENSION_IDS, type DimensionId } from "@/lib/dimensions";
import { PRESET_IDS, type PresetId } from "@/lib/presets";
import { FLAW_PENALTIES, overlapWarnings } from "@/lib/scoring";
import type { AppState } from "@/lib/url-state";
import { cn } from "@/lib/utils";
import { AhpWizard } from "./ahp-wizard";

/** Dimensions with no data at all cannot be weighted meaningfully; hidden unless opted in. */
const EMPTY_DIMS = new Set<DimensionId>(
  DIMENSION_IDS.filter((d) => dataset.entities.every((e) => e.m[d]?.[0] === null || e.m[d] === undefined)),
);

export function WeightPanel({
  state,
  applyPreset,
  setWeight,
  setWeights,
  toggleLock,
  setScoring,
}: {
  state: AppState;
  applyPreset: (p: PresetId) => void;
  setWeight: (id: DimensionId, pct: number, visible: readonly DimensionId[]) => void;
  setWeights: (w: Partial<Record<DimensionId, number>>) => void;
  toggleLock: (id: DimensionId) => void;
  setScoring: (patch: Partial<Pick<AppState, "mode" | "flaw">>) => void;
}) {
  const t = useTranslations("weights");
  const td = useTranslations("dims");
  const [showEmpty, setShowEmpty] = useState(DIMENSION_IDS.some((d) => EMPTY_DIMS.has(d) && state.weights[d] > 0));
  const visible = useMemo(() => DIMENSION_IDS.filter((d) => showEmpty || !EMPTY_DIMS.has(d)), [showEmpty]);
  const active = visible.filter((d) => state.weights[d] > 0);
  const warnings = overlapWarnings(dataset.correlations, active, 0.6).slice(0, 3);

  return (
    <section aria-labelledby="weights-title" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="weights-title" className="text-base font-semibold">
          {t("title")}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => applyPreset("balanced")}>
          <RotateCcw aria-hidden /> {t("reset")}
        </Button>
      </div>

      <div>
        <p id="presets-label" className="mb-2 text-xs font-medium text-muted-foreground">
          {t("presets")}
        </p>
        <div role="group" aria-labelledby="presets-label" className="flex flex-wrap gap-1.5">
          {PRESET_IDS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={state.preset === p}
              onClick={() => applyPreset(p)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                state.preset === p ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
              )}
            >
              {t(`preset.${p}`)}
            </button>
          ))}
          {state.preset === "custom" ? (
            <span className="rounded-full border border-dashed border-primary px-3 py-1 text-xs font-medium text-primary">
              {t("preset.custom")}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("presetHelp")}</p>
      </div>

      <AhpWizard onApply={setWeights} />

      <fieldset className="space-y-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">{t("model")}</legend>
        <label className="block text-xs font-medium">
          {t("modeLabel")}
          <select
            className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm"
            value={state.mode}
            onChange={(e) => setScoring({ mode: e.target.value as AppState["mode"] })}
          >
            <option value="absolute">{t("mode.absolute")}</option>
            <option value="relative">{t("mode.relative")}</option>
          </select>
        </label>
        <p className="text-xs text-muted-foreground">{t(`modeHelp.${state.mode}`)}</p>
        <label className="block text-xs font-medium">
          {t("flawLabel")}
          <select
            className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm"
            value={state.flaw}
            onChange={(e) => setScoring({ flaw: e.target.value as AppState["flaw"] })}
          >
            {FLAW_PENALTIES.map((f) => (
              <option key={f.id} value={f.id}>
                {t(`flaw.${f.id}`)}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">{t("flawHelp")}</p>
      </fieldset>

      <ul className="space-y-3">
        {visible.map((d) => {
          const locked = state.locked.has(d);
          const pct = state.weights[d];
          const name = td(`${d}.name`);
          return (
            <li key={d}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium" id={`w-${d}`}>
                  {name}
                  {EMPTY_DIMS.has(d) ? <span className="ml-1 text-xs font-normal text-muted-foreground">({t("noData")})</span> : null}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-12 text-right text-sm tabular-nums" aria-hidden>
                    {Math.round(pct)} %
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleLock(d)}
                    aria-pressed={locked}
                    aria-label={locked ? t("unlock", { dim: name }) : t("lock", { dim: name })}
                    className={cn("rounded p-1.5 hover:bg-muted", locked ? "text-primary" : "text-muted-foreground")}
                  >
                    {locked ? <Lock className="size-4" aria-hidden /> : <LockOpen className="size-4" aria-hidden />}
                  </button>
                </span>
              </div>
              <Slider
                value={[pct]}
                min={0}
                max={100}
                step={1}
                disabled={locked}
                onValueChange={([v]) => setWeight(d, v, visible)}
                thumbLabel={t("weightOf", { dim: name })}
                valueText={t("percent", { value: Math.round(pct) })}
              />
              <p className="text-xs text-muted-foreground">{td(`${d}.desc`)}</p>
            </li>
          );
        })}
      </ul>

      {EMPTY_DIMS.size > 0 ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={showEmpty} onCheckedChange={setShowEmpty} />
          {t("showMeaning")}
        </label>
      ) : null}

      {warnings.length ? (
        <ul className="space-y-2" aria-live="polite">
          {warnings.map((w) => (
            <li key={`${w.a}-${w.b}`} className="flex gap-2 rounded-md bg-warning-bg p-2 text-xs text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{t("overlap", { a: td(`${w.a}.name`), b: td(`${w.b}.name`), rho: w.rho.toFixed(2) })}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
