"use client";
import { AlertTriangle, GitCompare } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ScoreBar } from "@/components/score-bar";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { displayName } from "@/lib/dataset";
import type { DatasetEntity } from "@/lib/dataset-types";
import type { EntityResult } from "@/lib/scoring";
import { MAX_COMPARE } from "@/lib/url-state";
import { cn } from "@/lib/utils";

export interface Row {
  entity: DatasetEntity;
  result: EntityResult;
}

export function RankedList({
  rows,
  compare,
  onToggleCompare,
  queryString,
}: {
  rows: Row[];
  compare: string[];
  onToggleCompare: (id: string) => void;
  queryString: string;
}) {
  const t = useTranslations("list");
  const tk = useTranslations("kind");
  const locale = useLocale();
  const full = compare.length >= MAX_COMPARE;
  if (!rows.length) return <p className="py-10 text-center text-muted-foreground">{t("noResults")}</p>;
  return (
    <ol className="divide-y divide-border rounded-lg border border-border bg-card">
      {rows.map(({ entity: e, result: r }) => {
        const name = displayName(e, locale);
        const selected = compare.includes(e.id);
        const score = r.composite ?? 0;
        return (
          <li key={e.id} className="flex items-start gap-3 p-3 sm:items-center">
            <div className="w-10 shrink-0 text-center sm:w-12">
              {r.rank !== null ? (
                <span className="text-lg font-bold tabular-nums" aria-label={`${t("rank")} ${r.rank}`}>
                  {r.rank}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">–</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link href={`/entity/${e.id}${queryString ? `?${queryString}` : ""}`} className="font-medium hover:underline">
                  {name}
                </Link>
                <Badge variant="outline">{e.kind === "occupation" ? tk("occupation") : (e.eduType ?? tk("education"))}</Badge>
                {r.insufficientData ? (
                  <Badge variant="warning" title={t("insufficientTip")}>
                    {t("insufficient")}
                  </Badge>
                ) : null}
                {r.sensitivity?.fragile ? (
                  <Badge variant="warning" title={t("fragileTip", { shift: r.sensitivity.maxShift })}>
                    <AlertTriangle className="size-3" aria-hidden />
                    {t("fragile")}
                    <span className="sr-only">: {t("fragileTip", { shift: r.sensitivity.maxShift })}</span>
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {e.sector}
                {r.rankBand ? ` · ${t("rankBand", { best: r.rankBand.best, worst: r.rankBand.worst })}` : ""}
                {r.coverage < 0.999 ? ` · ${t("coverage", { pct: Math.round(r.coverage * 100) })}` : ""}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1">
                  <ScoreBar value={score} lo={r.band?.p10} hi={r.band?.p90} />
                </div>
                <span
                  className="w-10 text-right text-sm font-semibold tabular-nums"
                  aria-label={t("scoreOf", {
                    score: score.toFixed(0),
                    lo: (r.band?.p10 ?? score).toFixed(0),
                    hi: (r.band?.p90 ?? score).toFixed(0),
                  })}
                >
                  {score.toFixed(0)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onToggleCompare(e.id)}
              aria-pressed={selected}
              disabled={!selected && full}
              title={!selected && full ? t("compareFull") : undefined}
              aria-label={selected ? t("removeCompare", { name }) : t("addCompare", { name })}
              className={cn(
                "shrink-0 rounded-md border p-2 transition-colors disabled:opacity-40",
                selected ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
              )}
            >
              <GitCompare className="size-4" aria-hidden />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
