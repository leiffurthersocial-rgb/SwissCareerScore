"use client";
import { AlertTriangle, ArrowRight, GitCompare } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ScoreBadge } from "@/components/score-badge";
import { ScoreBar } from "@/components/score-bar";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { displayName, getEntity } from "@/lib/dataset";
import type { CoreEntity } from "@/lib/dataset-types";
import { formatNumber } from "@/lib/format";
import type { EntityResult } from "@/lib/scoring";
import { MAX_COMPARE } from "@/lib/url-state";
import { cn } from "@/lib/utils";

export interface Row {
  entity: CoreEntity;
  result: EntityResult;
}

/** Up to three career destinations, best-scoring first. */
function leadsTo(e: CoreEntity, results?: Map<string, EntityResult>): CoreEntity[] {
  const ids = e.careers?.length ? e.careers : e.leadsTo;
  return ids
    .map((id) => getEntity(id))
    .filter((x): x is CoreEntity => !!x)
    .sort((a, b) => (results?.get(b.id)?.composite ?? 0) - (results?.get(a.id)?.composite ?? 0))
    .slice(0, 3);
}

export function RankedList({
  rows,
  compare,
  onToggleCompare,
  queryString,
  results,
}: {
  rows: Row[];
  compare: string[];
  onToggleCompare: (id: string) => void;
  queryString: string;
  results?: Map<string, EntityResult>;
}) {
  const t = useTranslations("list");
  const th = useTranslations("home");
  const tk = useTranslations("kind");
  const locale = useLocale();
  const full = compare.length >= MAX_COMPARE;
  const qs = queryString ? `?${queryString}` : "";
  if (!rows.length) return <p className="py-10 text-center text-muted-foreground">{t("noResults")}</p>;
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {rows.map(({ entity: e, result: r }) => {
        const name = displayName(e, locale);
        const selected = compare.includes(e.id);
        const score = r.composite;
        const unemp = e.m.stability?.[0];
        const dest = e.kind === "education" ? leadsTo(e, results) : [];
        return (
          <li key={e.id} className="flex items-start gap-3 p-3 sm:gap-4 sm:p-4">
            <div className="flex w-12 shrink-0 flex-col items-center gap-1">
              <ScoreBadge
                score={score}
                label={
                  score !== null
                    ? t("scoreOf", { score: score.toFixed(0), lo: (r.band?.p10 ?? score).toFixed(0), hi: (r.band?.p90 ?? score).toFixed(0) })
                    : undefined
                }
              />
              {r.rank !== null ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  <span className="sr-only">{t("rank")} </span>#{r.rank}
                </span>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link href={`/entity/${e.id}${qs}`} className="font-semibold hover:underline">
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
              <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                {e.p !== null ? (
                  <div className="flex gap-1">
                    <dt>{th("facts.pay")}:</dt>
                    <dd className="font-medium text-foreground tabular-nums">CHF {formatNumber(Math.round(e.p / 100) * 100, locale)}</dd>
                  </div>
                ) : null}
                {e.y !== null ? (
                  <div className="flex gap-1">
                    <dt>{th("facts.years")}:</dt>
                    <dd className="font-medium text-foreground tabular-nums">{formatNumber(e.y, locale, 1)}</dd>
                  </div>
                ) : null}
                {unemp !== null && unemp !== undefined ? (
                  <div className="flex gap-1">
                    <dt>{th("facts.unemp")}:</dt>
                    <dd className="font-medium text-foreground tabular-nums">{formatNumber(unemp, locale, 1)} %</dd>
                  </div>
                ) : null}
              </dl>
              {r.rankBand || r.coverage < 0.999 ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.rankBand ? t("rankBand", { best: r.rankBand.best, worst: r.rankBand.worst }) : null}
                  {r.rankBand && r.coverage < 0.999 ? " · " : null}
                  {r.coverage < 0.999 ? t("coverage", { pct: Math.round(r.coverage * 100) }) : null}
                </p>
              ) : null}
              {dest.length ? (
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <ArrowRight className="size-3" aria-hidden />
                    {th("leadsTo")}:
                  </span>
                  {dest.map((d) => (
                    <Link key={d.id} href={`/entity/${d.id}${qs}`} className="rounded-full bg-muted px-2 py-0.5 hover:underline">
                      {displayName(d, locale)}
                    </Link>
                  ))}
                </p>
              ) : null}
              {r.band && score !== null ? (
                <div className="mt-2 max-w-md">
                  <ScoreBar value={score} lo={r.band.p10} hi={r.band.p90} />
                </div>
              ) : null}
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
