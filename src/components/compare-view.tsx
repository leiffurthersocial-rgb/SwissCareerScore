"use client";
import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ScoreRadar, SERIES_COLORS } from "@/components/entity/radar";
import { SourceBadge } from "@/components/source-badge";
import { useAppState, useScores } from "@/hooks/use-app-state";
import { Link } from "@/i18n/navigation";
import { displayName, getEntity } from "@/lib/dataset";
import { DIMENSION_IDS } from "@/lib/dimensions";

export function CompareView() {
  const t = useTranslations("compare");
  const td = useTranslations("dims");
  const ti = useTranslations("inputs");
  const tk = useTranslations("kind");
  const locale = useLocale();
  const { state, toggleCompare, queryString } = useAppState();
  const results = useScores(state.weights);
  const items = state.compare.map((id) => getEntity(id)).filter((e): e is NonNullable<typeof e> => !!e);
  const qs = queryString ? `?${queryString}` : "";
  if (!items.length) return <p className="py-10 text-center text-muted-foreground">{t("empty")}</p>;
  const dims = DIMENSION_IDS.filter((d) => items.some((e) => e.metrics[d]?.raw !== null && e.metrics[d] !== undefined));

  return (
    <div className="space-y-6">
      <ScoreRadar
        dims={dims}
        series={items.map((e) => ({
          name: displayName(e, locale),
          scores: Object.fromEntries(dims.map((d) => [d, results.get(e.id)?.dimensionScores[d]?.score ?? null])),
        }))}
        caption={t("title")}
      />
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th scope="col" className="p-2">{t("dimension")}</th>
              {items.map((e, i) => (
                <th key={e.id} scope="col" className="p-2 align-top">
                  <div className="flex items-start justify-between gap-2">
                    <span>
                      <span className="mr-1 inline-block size-2.5 rounded-full" style={{ background: SERIES_COLORS[i] }} aria-hidden />
                      <Link href={`/entity/${e.id}${qs}`} className="hover:underline">
                        {displayName(e, locale)}
                      </Link>
                      <span className="block text-xs font-normal text-muted-foreground">{e.kind === "occupation" ? tk("occupation") : e.eduType}</span>
                    </span>
                    <button type="button" onClick={() => toggleCompare(e.id)} className="rounded p-1 hover:bg-card" aria-label={`${t("remove")} ${displayName(e, locale)}`}>
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr className="font-semibold">
              <th scope="row" className="p-2 text-left">{t("overall")}</th>
              {items.map((e) => {
                const r = results.get(e.id)!;
                return (
                  <td key={e.id} className="p-2 tabular-nums">
                    {r.composite?.toFixed(0) ?? "—"}
                    {r.band ? <span className="ml-1 text-xs font-normal text-muted-foreground">({r.band.p10.toFixed(0)}–{r.band.p90.toFixed(0)})</span> : null}
                  </td>
                );
              })}
            </tr>
            {dims.map((d) => (
              <tr key={d}>
                <th scope="row" className="p-2 text-left font-medium">
                  {td(`${d}.name`)}
                  <span className="block text-xs font-normal text-muted-foreground">{Math.round(state.weights[d])} %</span>
                </th>
                {items.map((e) => {
                  const s = results.get(e.id)?.dimensionScores[d]?.score;
                  const m = e.metrics[d];
                  return (
                    <td key={e.id} className="p-2 align-top">
                      <span className="font-semibold tabular-nums">{s !== null && s !== undefined ? s.toFixed(0) : "—"}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {(m?.inputs ?? []).map((k) => (
                          <SourceBadge key={k} dp={e.inputs[k]} label={ti(k)} className="text-xs" />
                        ))}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
