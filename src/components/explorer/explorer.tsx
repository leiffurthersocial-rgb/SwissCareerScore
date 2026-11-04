"use client";
import { SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Hero } from "@/components/home/hero";
import { PresetCards } from "@/components/home/preset-cards";
import { TopPicks } from "@/components/home/top-picks";
import { ShareButton } from "@/components/share-button";
import { Button } from "@/components/ui/button";
import { useAppState, useScores } from "@/hooks/use-app-state";
import { Link } from "@/i18n/navigation";
import { entities, filterable } from "@/lib/dataset";
import type { Filters } from "@/lib/filters";
import { passesFilters } from "@/lib/filters";
import type { EduType, EntityKind } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { FilterBar } from "./filter-bar";
import { RankedList, type Row } from "./ranked-list";
import { WeightPanel } from "./weight-panel";

const PAGE = 30;

/** Starting points: which education paths are open to you right now. */
const START_POINTS: { id: string; filters: Filters }[] = [
  { id: "afterSchool", filters: { kinds: ["education"], eduTypes: ["EBA", "EFZ", "GYM", "FMS", "NONE"] } },
  { id: "afterApprenticeship", filters: { kinds: ["education"], eduTypes: ["BM", "HF", "BP", "HFP", "FH-BSc"] } },
  { id: "afterMatura", filters: { kinds: ["education"], eduTypes: ["UH-MSc", "ETH-MSc", "UH-MMed", "FH-BSc"] } },
  { id: "afterDegree", filters: { kinds: ["education"], eduTypes: ["FH-MSc", "DR"] } },
];
const TYPE_CHIPS: EduType[] = ["EBA", "EFZ", "BM", "HF", "BP", "HFP", "FH-BSc", "FH-MSc", "UH-MSc", "ETH-MSc", "UH-MMed", "DR"];

export function Explorer() {
  const t = useTranslations("list");
  const th = useTranslations("home");
  const tk = useTranslations("kind");
  const tw = useTranslations("weights");
  const app = useAppState();
  const { state } = app;
  const results = useScores(state);
  const [panelOpen, setPanelOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const tab: EntityKind = state.filters.kinds?.length === 1 ? state.filters.kinds[0] : "occupation";
  const setTab = (k: EntityKind) => {
    setLimit(PAGE);
    app.setFilters({ ...state.filters, kinds: [k], ...(k === "occupation" ? { eduTypes: undefined } : {}) });
  };

  const rows = useMemo(() => {
    const f = { ...state.filters, kinds: [tab] };
    return entities
      .filter((e) => passesFilters(filterable(e), f))
      .map((e) => ({ entity: e, result: results.get(e.id)! }) as Row)
      .sort((a, b) => {
        const ra = a.result.rank ?? Infinity;
        const rb = b.result.rank ?? Infinity;
        return ra - rb || (b.result.composite ?? 0) - (a.result.composite ?? 0);
      });
  }, [results, state.filters, tab]);

  const toggleType = (ty: EduType) => {
    const cur = new Set(state.filters.eduTypes ?? []);
    if (cur.has(ty)) cur.delete(ty);
    else cur.add(ty);
    app.setFilters({ ...state.filters, kinds: ["education"], eduTypes: cur.size ? [...cur] : undefined });
    setLimit(PAGE);
  };

  return (
    <div className="space-y-10">
      <Hero queryString={app.queryString} />
      <PresetCards active={state.preset} onPick={app.applyPreset} />
      <TopPicks results={results} queryString={app.queryString} />

      <section aria-labelledby="start-h" className="space-y-3">
        <h2 id="start-h" className="text-xl font-semibold">
          {th("startTitle")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {START_POINTS.map((sp) => (
            <button
              key={sp.id}
              type="button"
              onClick={() => {
                app.setFilters({ ...sp.filters });
                setLimit(PAGE);
                document.getElementById("explore")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="rounded-xl border border-border bg-card p-4 text-left hover:border-primary/50 hover:bg-muted"
            >
              <span className="block font-semibold">{th(`start.${sp.id}.title`)}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{th(`start.${sp.id}.desc`)}</span>
            </button>
          ))}
        </div>
      </section>

      <section id="explore" aria-labelledby="explore-h" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="explore-h" className="text-xl font-semibold">
              {th("exploreTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("pool")}</p>
          </div>
          <ShareButton />
        </div>

        <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
          <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-2">
            <div className="lg:hidden">
              <Button variant="outline" className="w-full" onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen} aria-controls="weight-panel">
                {panelOpen ? <X aria-hidden /> : <SlidersHorizontal aria-hidden />} {tw("title")}
              </Button>
            </div>
            <div id="weight-panel" className={panelOpen ? "mt-4 block" : "hidden lg:block"}>
              <WeightPanel
                state={state}
                applyPreset={app.applyPreset}
                setWeight={app.setWeight}
                setWeights={app.setWeights}
                toggleLock={app.toggleLock}
                setScoring={app.setScoring}
              />
            </div>
          </aside>

          <div className="min-w-0 space-y-4">
            <div role="tablist" aria-label={th("exploreTitle")} className="inline-flex rounded-xl border border-border bg-muted p-1">
              {(["occupation", "education"] as const).map((k) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  aria-controls="results"
                  onClick={() => setTab(k)}
                  className={cn("rounded-lg px-4 py-2 text-sm font-medium", tab === k ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {k === "occupation" ? tk("occupations") : tk("educations")}
                </button>
              ))}
            </div>
            {tab === "education" ? (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={th("typeFilter")}>
                {TYPE_CHIPS.map((ty) => {
                  const on = state.filters.eduTypes?.includes(ty) ?? false;
                  return (
                    <button
                      key={ty}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleType(ty)}
                      className={cn("rounded-full border px-3 py-1 text-xs font-medium", on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}
                      title={th(`types.${ty}`)}
                    >
                      {ty}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <FilterBar filters={state.filters} onChange={(f) => (setLimit(PAGE), app.setFilters({ ...f, kinds: [tab] }))} />
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {t("results", { count: rows.length })}
            </p>
            <div id="results" role="tabpanel">
              <RankedList rows={rows.slice(0, limit)} results={results} compare={state.compare} onToggleCompare={app.toggleCompare} queryString={app.queryString} />
            </div>
            {rows.length > limit ? (
              <Button variant="outline" className="w-full" onClick={() => setLimit((l) => l + PAGE * 2)}>
                {t("showMore", { shown: limit, total: rows.length })}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {state.compare.length ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 backdrop-blur" role="region" aria-label={t("compare")}>
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={app.clearCompare}>
              {t("clearCompare")}
            </Button>
            <Button asChild>
              <Link href={`/compare?${app.queryString}`}>{t("openCompare", { count: state.compare.length })}</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
