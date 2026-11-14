"use client";
import {
  ArrowRight,
  ExternalLink,
  GraduationCap,
  Landmark,
  School,
  SlidersHorizontal,
  Star,
  Stethoscope,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ScoreBadge } from "@/components/score-badge";
import { WeightPanel } from "@/components/explorer/weight-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppState, useScores } from "@/hooks/use-app-state";
import { Link } from "@/i18n/navigation";
import { displayName, getEntity } from "@/lib/dataset";
import type { Blended, CoreEntity, Programme } from "@/lib/dataset-types";
import { formatNumber } from "@/lib/format";
import { catalogue, INSTITUTION_TYPES } from "@/lib/programmes";
import { cn } from "@/lib/utils";
import { ActiveFilters, MaturaFilterPanel } from "./filter-panel";
import {
  activeCount,
  institutionFilterActive,
  useFilteredProgrammes,
  useMaturaFilters,
} from "./use-matura-filters";

const { programmes, institutions, groups } = catalogue;

export function AfterMatura() {
  const app = useAppState();
  const t = useTranslations("matura");
  const locale = useLocale();
  const results = useScores(app.state);
  const qs = app.queryString ? `?${app.queryString}` : "";
  const lang = locale === "de" ? "de" : "en";

  const { f, update, toggle, reset } = useMaturaFilters();
  const [panelOpen, setPanelOpen] = useState(false);
  const score = (p: Programme) => results.get(p.entity)?.composite ?? null;
  const rows = useFilteredProgrammes(f, score, results);
  const instActive = institutionFilterActive(f);
  const sections =
    f.sort === "field"
      ? Object.keys(groups)
          .map((g) => ({ g, items: rows.filter((r) => r.p.group === g) }))
          .filter((x) => x.items.length)
      : [{ g: "", items: rows }];
  const n = activeCount(f);
  const progCount = (code: string) =>
    programmes.filter((p) => p.institutions.includes(code)).length;

  const routes = [
    { id: "uh", icon: Landmark },
    { id: "fh", icon: School },
    { id: "ph", icon: GraduationCap },
    { id: "med", icon: Stethoscope },
  ];

  return (
    <div className="space-y-10">
      <header className="border-border rounded-2xl border bg-gradient-to-br from-[var(--hero-from)] to-[var(--hero-to)] px-5 py-8 sm:px-10">
        <p className="text-primary mb-2 text-sm font-medium">{t("eyebrow")}</p>
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl">{t("intro")}</p>
        <p className="mt-4 text-sm">
          <span className="text-xl font-bold">{programmes.length}</span>{" "}
          <span className="text-muted-foreground">{t("countProgrammes")}</span>
          <span className="text-muted-foreground mx-3">·</span>
          <span className="text-xl font-bold">{Object.keys(institutions).length}</span>{" "}
          <span className="text-muted-foreground">{t("countInstitutions")}</span>
        </p>
      </header>

      <section aria-labelledby="routes-h" className="space-y-3">
        <h2 id="routes-h" className="text-xl font-semibold">
          {t("routesTitle")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {routes.map((r) => (
            <div key={r.id} className="border-border bg-card rounded-xl border p-4">
              <r.icon className="text-primary mb-2 size-6" aria-hidden />
              <h3 className="font-semibold">{t(`routes.${r.id}.title`)}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{t(`routes.${r.id}.desc`)}</p>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-sm">
          {t("gapYear")}{" "}
          <Link href={`/entity/edu-gym-matura${qs}`} className="text-primary underline">
            {t("gapYearLink")}
          </Link>
        </p>
      </section>

      <section aria-labelledby="list-h" className="scroll-mt-24 space-y-4">
        <div>
          <h2 id="list-h" className="text-xl font-semibold">
            {t("listTitle")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("listHelp")}</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[19rem_1fr]">
          <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-2">
            <div className="lg:hidden">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setPanelOpen((o) => !o)}
                aria-expanded={panelOpen}
                aria-controls="matura-filters"
              >
                {panelOpen ? <X aria-hidden /> : <SlidersHorizontal aria-hidden />}{" "}
                {t("filtersTitle")}
                {n ? ` (${n})` : ""}
              </Button>
            </div>
            <div
              id="matura-filters"
              className={panelOpen ? "mt-4 block space-y-6" : "hidden space-y-6 lg:block"}
            >
              <MaturaFilterPanel f={f} update={update} toggle={toggle} reset={reset} />
              <details className="border-border border-t pt-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  {t("weightsTitle")}
                </summary>
                <p className="text-muted-foreground mt-1 text-xs">{t("weightsHelp")}</p>
                <div className="mt-3">
                  <WeightPanel
                    state={app.state}
                    applyPreset={app.applyPreset}
                    setWeight={app.setWeight}
                    setWeights={app.setWeights}
                    toggleLock={app.toggleLock}
                    setScoring={app.setScoring}
                  />
                </div>
              </details>
            </div>
          </aside>

          <div className="min-w-0 space-y-4">
            <ActiveFilters f={f} update={update} toggle={toggle} reset={reset} />
            <p className="text-sm font-medium" aria-live="polite">
              {t("results", { count: rows.length })}
              {instActive ? (
                <span className="text-muted-foreground font-normal"> · {t("payAtMatching")}</span>
              ) : null}
            </p>
            <p className="text-muted-foreground text-xs">{t("legend")}</p>
            {rows.length ? (
              sections.map((sec) => (
                <div key={sec.g || "all"} className="space-y-3">
                  {sec.g ? (
                    <h3 className="pt-2 text-lg font-semibold">
                      {groups[sec.g][lang]}{" "}
                      <span className="text-muted-foreground text-sm font-normal">
                        ({sec.items.length})
                      </span>
                    </h3>
                  ) : null}
                  <ol className="space-y-3">
                    {sec.items.map((r) => (
                      <ProgrammeCard
                        key={r.p.id}
                        p={r.p}
                        score={score(r.p)}
                        qs={qs}
                        lang={lang}
                        results={results}
                        match={instActive ? r.match.map((o) => o.institution) : null}
                      />
                    ))}
                  </ol>
                </div>
              ))
            ) : (
              <div className="border-border rounded-xl border border-dashed py-10 text-center">
                <p className="text-muted-foreground">{t("noResults")}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
                  {t("resetAll")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="inst-h" className="space-y-3">
        <h2 id="inst-h" className="text-xl font-semibold">
          {t("institutionsTitle")}
        </h2>
        <p className="text-muted-foreground text-sm">{t("institutionsHelp")}</p>
        <div tabIndex={0} className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-muted text-left text-xs">
              <tr>
                <th scope="col" className="p-2">
                  {t("institution")}
                </th>
                <th scope="col" className="p-2">
                  {t("type")}
                </th>
                <th scope="col" className="p-2">
                  {t("location")}
                </th>
                <th scope="col" className="p-2">
                  {t("languages")}
                </th>
                <th scope="col" className="p-2 text-right">
                  {t("programmesCol")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {INSTITUTION_TYPES.flatMap((ty) =>
                Object.entries(institutions)
                  .filter(([, i]) => i.type === ty)
                  .map(([code, i]) => (
                    <tr key={code}>
                      <th scope="row" className="p-2 text-left font-medium">
                        <a
                          href={i.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary inline-flex items-center gap-1 hover:underline"
                        >
                          {i.name} <ExternalLink className="size-3" aria-hidden />
                        </a>
                      </th>
                      <td className="p-2">{t(`types.${ty}`)}</td>
                      <td className="p-2">{i.city}</td>
                      <td className="p-2 uppercase">{i.languages.join(", ")}</td>
                      <td className="p-2 text-right">
                        <button
                          type="button"
                          className="text-primary tabular-nums underline"

                          onClick={() => {
                            update({ inst: code });
                            document
                              .getElementById("list-h")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          {progCount(code)}
                          <span className="sr-only">
                            {" "}
                            {t("showProgrammesOf", { name: i.short })}
                          </span>
                        </button>
                      </td>
                    </tr>
                  )),
              )}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground text-xs">
          {t("catalogueSource")}{" "}
          <a
            href={catalogue.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            studyprogrammes.ch
          </a>
          .{" "}
          <Link
            href="/methodology#15-after-the-matura-higher-education-catalogue"
            className="text-primary underline"
          >
            {t("methodLink")}
          </Link>
        </p>
      </section>
    </div>
  );
}

function Fact({
  label,
  b,
  unit,
  digits = 0,
}: {
  label: string;
  b: Blended;
  unit: "chf" | "pct";
  digits?: number;
}) {
  const t = useTranslations("matura");
  const locale = useLocale();
  const f = (v: number | null) =>
    v === null
      ? "—"
      : unit === "chf"
        ? `CHF ${formatNumber(Math.round(v / 100) * 100, locale)}`
        : `${formatNumber(v, locale, digits)} %`;
  return (
    <div className="bg-muted/60 rounded-lg px-2.5 py-1.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-semibold tabular-nums">{f(b.value)}</dd>
      <dd className="text-muted-foreground text-[11px] leading-tight">
        {b.stat !== null ? `${t("stat")} ${f(b.stat)}` : t("noStat")}
        {b.est !== null ? ` · ${t("est")} ${f(b.est)}` : ""}
      </dd>
    </div>
  );
}

function ProgrammeCard({
  p,
  score,
  qs,
  lang,
  results,
  match,
}: {
  p: Programme;
  score: number | null;
  qs: string;
  lang: "en" | "de";
  results: ReturnType<typeof useScores>;
  /** Institutions passing the institution-level filters, or null when none is active. */
  match: string[] | null;
}) {
  const t = useTranslations("matura");
  const locale = useLocale();
  const e = getEntity(p.entity);
  const careers = (e?.careers?.length ? e.careers : (e?.leadsTo ?? []))
    .map((id) => getEntity(id))
    .filter((x): x is CoreEntity => !!x)
    .sort((a, b) => (results.get(b.id)?.composite ?? 0) - (results.get(a.id)?.composite ?? 0))
    .slice(0, 4);
  const name = p.name[lang];
  const offers = [...p.offers].sort((a, b) => Number(b.strong) - Number(a.strong));
  const chf = (v: number | null) =>
    v === null ? "—" : `CHF ${formatNumber(Math.round(v / 100) * 100, locale)}`;
  const hits = match ? p.offers.filter((o) => match.includes(o.institution)) : [];
  const isHit = (code: string) => !!match && match.includes(code);
  const payRange = (k: "payEntry" | "payMid") => {
    const v = hits.map((o) => o[k] ?? 0);
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    return lo === hi ? chf(hi) : `${chf(lo)}–${chf(hi)}`;
  };
  const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  return (
    <li className="border-border bg-card rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <ScoreBadge
          score={score}
          label={score !== null ? t("scoreLabel", { score: Math.round(score) }) : undefined}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h4 className="font-semibold">
              <Link href={`/entity/${p.entity}${qs}`} className="hover:underline">
                {name}
              </Link>
            </h4>
            <Badge variant="outline">{t(`types.${p.type}`)}</Badge>
            <Badge variant={p.admission === "open" ? "default" : "warning"}>
              {t(`adm.${p.admission}`)}
            </Badge>
            {p.masterOnly ? <Badge variant="outline">{t("masterOnly")}</Badge> : null}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {t("yearsTo", { years: formatNumber(p.years, locale, 1) })}
          </p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label={t("payEntry")} b={p.payEntry} unit="chf" />
        <Fact label={t("payMid")} b={p.payMid} unit="chf" />
        <Fact label={t("unemployment")} b={p.unemployment} unit="pct" digits={1} />
        <Fact label={t("dropout")} b={p.nonCompletion} unit="pct" />
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">{t("offeredAt")}:</span>
        {offers.map((o) => {
          const i = institutions[o.institution];
          return (
            <a
              key={o.institution}
              href={i.url}
              target="_blank"
              rel="noopener noreferrer"
              title={o.note ? `${i.name} — ${o.note}` : i.name}
              className={cn(
                "hover:bg-muted inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
                o.strong
                  ? "border-primary/60 bg-accent text-accent-foreground font-medium"
                  : "border-border",
                isHit(o.institution) && "ring-primary ring-2",
                match && !isHit(o.institution) && "opacity-50",
              )}
            >
              {o.strong ? <Star className="size-3 fill-current" aria-hidden /> : null}
              {i.short}
              {o.strong ? <span className="sr-only"> ({t("strong")})</span> : null}
            </a>
          );
        })}
      </div>
      {hits.length ? (
        <p className="mt-2 text-xs">
          {hits.length === 1
            ? t("atInstitution", { name: institutions[hits[0].institution].short })
            : t("atMatching", { count: hits.length })}
          : <span className="font-semibold tabular-nums">{payRange("payEntry")}</span> →{" "}
          <span className="font-semibold tabular-nums">{payRange("payMid")}</span>
          {hits.length === 1 && hits[0].note ? (
            <span className="text-muted-foreground"> · {hits[0].note}</span>
          ) : null}
        </p>
      ) : null}
      {offers.length > 1 ? (
        <details className="mt-2 text-xs">
          <summary className="text-primary cursor-pointer">
            {t("compareInstitutions", { count: offers.length })}
          </summary>
          <div tabIndex={0} className="border-border mt-2 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[34rem]">
              <caption className="sr-only">
                {t("compareInstitutions", { count: offers.length })}
              </caption>
              <thead className="bg-muted text-left">
                <tr>
                  <th scope="col" className="p-1.5">
                    {t("institution")}
                  </th>
                  <th scope="col" className="p-1.5 text-right">
                    {t("payEntry")}
                  </th>
                  <th scope="col" className="p-1.5 text-right">
                    {t("payMid")}
                  </th>
                  <th scope="col" className="p-1.5">
                    {t("why")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {[...offers]
                  .sort((a, b) => (b.payMid ?? 0) - (a.payMid ?? 0))
                  .map((o) => {
                    const i = institutions[o.institution];
                    return (
                      <tr
                        key={o.institution}
                        className={isHit(o.institution) ? "bg-accent" : undefined}
                      >
                        <th scope="row" className="p-1.5 text-left font-medium">
                          {o.strong ? (
                            <Star
                              className="text-primary mr-1 inline size-3 fill-current"
                              aria-label={t("strong")}
                            />
                          ) : null}
                          {i.short}{" "}
                          <span className="text-muted-foreground font-normal">· {i.city}</span>
                        </th>
                        <td className="p-1.5 text-right tabular-nums">{chf(o.payEntry)}</td>
                        <td className="p-1.5 text-right tabular-nums">{chf(o.payMid)}</td>
                        <td className="text-muted-foreground p-1.5">
                          {[
                            o.note,
                            o.premium > 0
                              ? t("premium", { pct: Math.round(o.premium * 100) })
                              : null,
                            t("region", { pct: signed(Math.round((i.regionPay - 1) * 100)) }),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground mt-1">{t("institutionNote")}</p>
        </details>
      ) : null}
      {careers.length ? (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <ArrowRight className="size-3" aria-hidden />
            {t("leadsTo")}:
          </span>
          {careers.map((c) => (
            <Link
              key={c.id}
              href={`/entity/${c.id}${qs}`}
              className="bg-muted rounded-full px-2 py-0.5 hover:underline"
            >
              {displayName(c, locale)}
            </Link>
          ))}
        </p>
      ) : null}
      {p.note ? <p className="text-muted-foreground mt-2 text-xs">{p.note}</p> : null}
    </li>
  );
}
