"use client";
import { ExternalLink, Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getEntity, displayName, sourceById } from "@/lib/dataset";
import type { DatasetDatapoint } from "@/lib/dataset-types";
import { formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";

const CONF_STYLE: Record<string, string> = {
  measured: "border-success/40 text-success",
  estimated: "border-warning/40 text-warning",
  "expert-judgment": "border-danger/40 text-danger",
};

/** A clickable number: opens a popover with its source, year, confidence and match level. */
export function SourceBadge({ dp, label, className }: { dp: DatasetDatapoint | undefined; label: string; className?: string }) {
  const t = useTranslations("source");
  const locale = useLocale();
  const value = dp ? formatValue(dp.value, dp.unit, locale) : "—";
  const src = dp ? sourceById(dp.sourceId) : undefined;
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center gap-1 rounded px-1 font-medium tabular-nums underline decoration-dotted underline-offset-4 hover:bg-muted",
          !dp || dp.value === null ? "text-muted-foreground" : "",
          className,
        )}
        aria-label={`${label}: ${value}. ${t("title")}`}
      >
        {value}
        <Info className="size-3.5 opacity-60" aria-hidden />
      </PopoverTrigger>
      <PopoverContent>
        <p className="mb-2 font-semibold">{label}</p>
        {!dp || dp.value === null ? <p className="mb-2 text-muted-foreground">{t("missing")}</p> : null}
        {dp ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-muted-foreground">{t("value")}</dt>
            <dd className="font-medium">{value} <span className="text-muted-foreground">({dp.unit})</span></dd>
            {dp.statisticLabel ? (
              <>
                <dt className="text-muted-foreground">{t("statistic")}</dt>
                <dd>{dp.statisticLabel}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">{t("title")}</dt>
            <dd>{src ? `${src.publisher}: ${src.title}` : dp.sourceId}</dd>
            <dt className="text-muted-foreground">{t("year")}</dt>
            <dd>{dp.year}</dd>
            <dt className="text-muted-foreground">{t("confidence")}</dt>
            <dd>
              <span className={cn("rounded border px-1.5 py-0.5", CONF_STYLE[dp.confidence])}>{t(`conf.${dp.confidence}`)}</span>
            </dd>
            <dt className="text-muted-foreground">{t("match")}</dt>
            <dd>{t(`matchLevel.${dp.matchLevel}`)}</dd>
            {dp.inheritedFrom ? (
              <>
                <dt className="text-muted-foreground">{t("inherited")}</dt>
                <dd>{(() => { const e = getEntity(dp.inheritedFrom!); return e ? displayName(e, locale) : dp.inheritedFrom; })()}</dd>
              </>
            ) : null}
            {dp.note ? (
              <>
                <dt className="text-muted-foreground">{t("note")}</dt>
                <dd>{dp.note}</dd>
              </>
            ) : null}
          </dl>
        ) : null}
        {dp ? (
          <a href={dp.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary underline">
            {t("open")} <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
