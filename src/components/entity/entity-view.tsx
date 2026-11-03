"use client";
import { AlertTriangle, ArrowLeft, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ScoreBar } from "@/components/score-bar";
import { SourceBadge } from "@/components/source-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useAppState, useScores } from "@/hooks/use-app-state";
import { Link } from "@/i18n/navigation";
import { displayName, entities, getEntity } from "@/lib/dataset";
import { INPUT_IDS, type DatasetEntity } from "@/lib/dataset-types";
import { DIMENSIONS, DIMENSION_IDS } from "@/lib/dimensions";
import { formatNumber } from "@/lib/format";
import { ScoreRadar } from "./radar";

export function EntityView({ detail }: { detail: DatasetEntity }) {
  const t = useTranslations("entity");
  const tl = useTranslations("list");
  const td = useTranslations("dims");
  const ti = useTranslations("inputs");
  const tk = useTranslations("kind");
  const tf = useTranslations("filters");
  const locale = useLocale();
  const { state, queryString, toggleCompare } = useAppState();
  const results = useScores(state.weights);
  const e = detail;
  const id = e.id;
  const r = results.get(id)!;
  const qs = queryString ? `?${queryString}` : "";
  const poolSize = entities.filter((x) => x.kind === e.kind && results.get(x.id)?.rank !== null).length;
  const dimsWithData = DIMENSION_IDS.filter((d) => e.metrics[d] && e.metrics[d]!.raw !== null);
  const weighted = r.contributions;
  const name = displayName(e, locale);
  const inCompare = state.compare.includes(e.id);

  return (
    <article className="space-y-6">
      <Link href={`/${qs}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> {t("back")}
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{e.kind === "occupation" ? tk("occupation") : (e.eduType ?? tk("education"))}</Badge>
          <span className="text-sm text-muted-foreground">{e.sector}</span>
          {e.codes.isco08 ? <span className="text-xs text-muted-foreground">ISCO-08 {e.codes.isco08}</span> : null}
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">{name}</h1>
        {locale !== "de" && e.name.de !== name ? <p className="text-sm text-muted-foreground">{e.name.de}</p> : null}
        <p className="text-sm text-muted-foreground">
          {t("regions")}: {e.languageRegions.map((l) => tf(`lang.${l}`)).join(", ")}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-medium text-muted-foreground">{t("composite")}</h2>
          <p className="text-5xl font-bold tabular-nums">{r.composite !== null ? r.composite.toFixed(0) : "—"}</p>
          {r.band ? (
            <>
              <ScoreBar value={r.composite ?? 0} lo={r.band.p10} hi={r.band.p90} />
              <p className="text-sm text-muted-foreground">{t("range", { lo: r.band.p10.toFixed(0), hi: r.band.p90.toFixed(0) })}</p>
            </>
          ) : null}
          {r.rank !== null ? (
            <p className="text-sm">
              {t("rank", { rank: r.rank, total: poolSize, group: e.kind === "occupation" ? tk("occupations") : tk("educations") })}
              {r.rankBand ? <span className="text-muted-foreground"> · {t("rankBand", { best: r.rankBand.best, worst: r.rankBand.worst })}</span> : null}
            </p>
          ) : (
            <p className="text-sm text-warning">{tl("insufficientTip")}</p>
          )}
          {r.coverage < 0.999 ? <p className="text-xs text-muted-foreground">{tl("coverage", { pct: Math.round(r.coverage * 100) })}</p> : null}
          {r.sensitivity?.fragile ? (
            <p className="flex gap-2 rounded-md bg-warning-bg p-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {tl("fragileTip", { shift: r.sensitivity.maxShift })}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => toggleCompare(e.id)}
            aria-pressed={inCompare}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            {inCompare ? tl("removeCompare", { name }) : tl("addCompare", { name })}
          </button>
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">{t("radar")}</h2>
          <ScoreRadar
            dims={dimsWithData}
            series={[{ name, scores: Object.fromEntries(dimsWithData.map((d) => [d, r.dimensionScores[d]?.score ?? null])) }]}
            caption={t("radarDesc")}
          />
        </Card>
      </div>

      <section aria-labelledby="breakdown" className="space-y-2">
        <h2 id="breakdown" className="text-lg font-semibold">
          {t("breakdown")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("breakdownHelp")}</p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="bg-muted text-left text-xs">
              <tr>
                <th scope="col" className="p-2">{t("dimension")}</th>
                <th scope="col" className="p-2 text-right">{t("weight")}</th>
                <th scope="col" className="p-2 text-right">{t("effWeight")}</th>
                <th scope="col" className="p-2">{t("raw")}</th>
                <th scope="col" className="p-2 text-right">{t("dimScore")}</th>
                <th scope="col" className="w-40 p-2">{t("points")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {weighted.map((c) => {
                const metric = e.metrics[c.dimension];
                const def = DIMENSIONS[c.dimension];
                return (
                  <tr key={c.dimension} className={c.score === null ? "text-muted-foreground" : ""}>
                    <th scope="row" className="p-2 text-left font-medium">
                      {td(`${c.dimension}.name`)}
                      {def.alwaysEstimate ? <Badge variant="outline" className="ml-1">{t("estimate")}</Badge> : null}
                    </th>
                    <td className="p-2 text-right tabular-nums">{(c.nominalWeight * 100).toFixed(0)} %</td>
                    <td className="p-2 text-right tabular-nums">{(c.effectiveWeight * 100).toFixed(0)} %</td>
                    <td className="p-2 text-xs">
                      <span className="block">{metric?.raw !== null && metric?.raw !== undefined ? metric.formula : t("missing")}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {(metric?.inputs ?? []).map((k) => (
                          <SourceBadge key={k} dp={e.inputs[k]} label={ti(k)} className="text-xs" />
                        ))}
                      </span>
                    </td>
                    <td className="p-2 text-right tabular-nums">{c.score !== null ? c.score.toFixed(0) : "—"}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded bg-muted" aria-hidden>
                          <div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, c.points)}%` }} />
                        </div>
                        <span className="w-8 text-right tabular-nums">{c.points.toFixed(1)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <th scope="row" className="p-2 text-left" colSpan={5}>
                  {t("composite")}
                </th>
                <td className="p-2 text-right tabular-nums">{r.composite?.toFixed(1) ?? "—"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {r.sensitivity ? (
        <section aria-labelledby="sens" className="space-y-2">
          <h2 id="sens" className="text-lg font-semibold">
            {t("sensitivity")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("sensitivityHelp")}</p>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {Object.entries(r.sensitivity.byDimension).map(([d, shift]) => (
              <li key={d} className="flex justify-between rounded border border-border px-2 py-1">
                <span>{td(`${d}.name`)}</span>
                <span className={shift ? "font-medium" : "text-muted-foreground"}>{shift ? `± ${t("places", { n: shift })}` : t("noShift")}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {e.pathway.length || e.trainedVia.length || e.leadsTo.length ? (
        <section aria-labelledby="path" className="space-y-2">
          <h2 id="path" className="text-lg font-semibold">
            {t("pathway")}
          </h2>
          {e.pathway.length ? (
            <ol className="space-y-1 text-sm">
              {e.pathway.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{i + 1}.</span> {s.label} —{" "}
                  <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
                    {t("years", { n: formatNumber(s.years, locale, 1) })} <ExternalLink className="size-3" aria-hidden />
                  </a>
                  {s.confidence !== "measured" ? <Badge variant="warning">{s.confidence}</Badge> : null}
                </li>
              ))}
            </ol>
          ) : null}
          {[
            { label: t("trainedVia"), ids: e.trainedVia },
            { label: t("leadsTo"), ids: e.leadsTo },
          ].map((g) =>
            g.ids.length ? (
              <p key={g.label} className="text-sm">
                <span className="text-muted-foreground">{g.label}: </span>
                {g.ids.map((x, i) => {
                  const o = getEntity(x);
                  return (
                    <span key={x}>
                      {i ? ", " : ""}
                      <Link className="text-primary underline" href={`/entity/${x}${qs}`}>
                        {o ? displayName(o, locale) : x}
                      </Link>
                    </span>
                  );
                })}
              </p>
            ) : null,
          )}
          {e.notes ? <p className="text-xs text-muted-foreground">{e.notes}</p> : null}
        </section>
      ) : null}

      <section aria-labelledby="data" className="space-y-2">
        <h2 id="data" className="text-lg font-semibold">
          {t("data")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("dataHelp")}</p>
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          {INPUT_IDS.filter((k) => e.inputs[k]).map((k) => (
            <div key={k} className="flex items-baseline justify-between gap-2 border-b border-border py-1">
              <dt className="text-muted-foreground">{ti(k)}</dt>
              <dd>
                <SourceBadge dp={e.inputs[k]} label={ti(k)} />
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}
