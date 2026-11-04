"use client";
import { SlidersHorizontal, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppState, useScores } from "@/hooks/use-app-state";
import { Link } from "@/i18n/navigation";
import { entities, filterable } from "@/lib/dataset";
import { passesFilters } from "@/lib/filters";
import { ShareButton } from "@/components/share-button";
import { FilterBar } from "./filter-bar";
import { RankedList, type Row } from "./ranked-list";
import { WeightPanel } from "./weight-panel";

const PAGE = 40;

export function Explorer() {
  const t = useTranslations("list");
  const tk = useTranslations("kind");
  const tw = useTranslations("weights");
  const locale = useLocale();
  const app = useAppState();
  const { state } = app;
  const results = useScores(state);
  const [panelOpen, setPanelOpen] = useState(false);
  const [limit, setLimit] = useState<Record<string, number>>({ occupation: PAGE, education: PAGE });

  const groups = useMemo(() => {
    const rows: Row[] = entities
      .filter((e) => passesFilters(filterable(e), state.filters))
      .map((e) => ({ entity: e, result: results.get(e.id)! }))
      .sort((a, b) => {
        const ra = a.result.rank ?? Infinity;
        const rb = b.result.rank ?? Infinity;
        return ra - rb || (b.result.composite ?? 0) - (a.result.composite ?? 0);
      });
    return {
      occupation: rows.filter((r) => r.entity.kind === "occupation"),
      education: rows.filter((r) => r.entity.kind === "education"),
    };
  }, [results, state.filters]);
  const total = groups.occupation.length + groups.education.length;
  void locale;

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-2">
        <div className="lg:hidden">
          <Button variant="outline" className="w-full" onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen} aria-controls="weight-panel">
            {panelOpen ? <X aria-hidden /> : <SlidersHorizontal aria-hidden />} {tw("title")}
          </Button>
        </div>
        <div id="weight-panel" className={panelOpen ? "mt-4 block" : "hidden lg:block"}>
          <WeightPanel state={state} applyPreset={app.applyPreset} setWeight={app.setWeight} setWeights={app.setWeights} toggleLock={app.toggleLock} setScoring={app.setScoring} />
        </div>
      </aside>

      <div className="min-w-0 space-y-4">
        <FilterBar filters={state.filters} onChange={app.setFilters} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t("results", { count: total })}
          </p>
          <ShareButton />
        </div>
        <p className="text-xs text-muted-foreground">{t("pool")}</p>
        {(["occupation", "education"] as const).map((k) =>
          groups[k].length ? (
            <section key={k} aria-labelledby={`h-${k}`} className="space-y-2">
              <h2 id={`h-${k}`} className="text-lg font-semibold">
                {k === "occupation" ? tk("occupations") : tk("educations")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("results", { count: groups[k].length })}</p>
              <RankedList
                rows={groups[k].slice(0, limit[k])}
                compare={state.compare}
                onToggleCompare={app.toggleCompare}
                queryString={app.queryString}
              />
              {groups[k].length > limit[k] ? (
                <Button variant="outline" className="w-full" onClick={() => setLimit((l) => ({ ...l, [k]: l[k] + PAGE * 2 }))}>
                  {t("showMore", { shown: limit[k], total: groups[k].length })}
                </Button>
              ) : null}
            </section>
          ) : null,
        )}
        {total === 0 ? <RankedList rows={[]} compare={[]} onToggleCompare={() => {}} queryString="" /> : null}
      </div>

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
