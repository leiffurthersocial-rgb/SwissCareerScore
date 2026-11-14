"use client";
import {
  ArrowRight,
  ExternalLink,
  GraduationCap,
  Landmark,
  School,
  Stethoscope,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { ScoreBadge } from "@/components/score-badge";
import { Badge } from "@/components/ui/badge";
import { useAppState, useScores } from "@/hooks/use-app-state";
import { Link } from "@/i18n/navigation";
import { displayName, getEntity } from "@/lib/dataset";
import type { Blended, CoreEntity, Programme } from "@/lib/dataset-types";
import { formatNumber } from "@/lib/format";
import { catalogue, INSTITUTION_TYPES } from "@/lib/programmes";
import { cn } from "@/lib/utils";

type Sort = "field" | "score" | "payMid" | "payEntry" | "unemployment" | "nonCompletion" | "years";
const SORTS: Sort[] = [
  "field",
  "score",
  "payMid",
  "payEntry",
  "unemployment",
  "nonCompletion",
  "years",
];
const field = "w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm";
const { programmes, institutions, groups } = catalogue;
const GROUP_IDS = Object.keys(groups);

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function AfterMatura() {
  const t = useTranslations("matura");
  const locale = useLocale();
  const { state, queryString } = useAppState();
  const results = useScores(state);
  const qs = queryString ? `?${queryString}` : "";
  const lang = locale === "de" ? "de" : "en";

  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [inst, setInst] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [admission, setAdmission] = useState("");
  const [sort, setSort] = useState<Sort>("field");
  const [hideMaster, setHideMaster] = useState(false);

  const score = (p: Programme) => results.get(p.entity)?.composite ?? null;
  const rows = useMemo(() => {
    const n = normalize(q.trim());
    const list = programmes.filter(
      (p) =>
        (!n ||
          normalize(
            `${p.name.en} ${p.name.de} ${p.institutions.map((i) => institutions[i].name).join(" ")}`,
          ).includes(n)) &&
        (!group || p.group === group) &&
        (!inst || p.institutions.includes(inst)) &&
        (!types.length || types.includes(p.type)) &&
        (!admission || p.admission === admission) &&
        (!hideMaster || !p.masterOnly),
    );
    const key: Record<Sort, (p: Programme) => number> = {
      field: (p) => GROUP_IDS.indexOf(p.group) * 1000 + (p.masterOnly ? 500 : 0) - (score(p) ?? 0),
      score: (p) => -(score(p) ?? -1),
      payMid: (p) => -(p.payMid.value ?? 0),
      payEntry: (p) => -(p.payEntry.value ?? 0),
      unemployment: (p) => p.unemployment.value ?? 99,
      nonCompletion: (p) => p.nonCompletion.value ?? 99,
      years: (p) => p.years,
    };
    return [...list].sort((a, b) => key[sort](a) - key[sort](b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, group, inst, types, admission, sort, hideMaster, results]);

  const sections =
    sort === "field"
      ? GROUP_IDS.map((g) => ({ g, items: rows.filter((p) => p.group === g) })).filter(
          (s) => s.items.length,
        )
      : [{ g: "", items: rows }];
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

      <section aria-labelledby="list-h" className="space-y-4">
        <div>
          <h2 id="list-h" className="text-xl font-semibold">
            {t("listTitle")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("listHelp")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <label className="col-span-2 text-xs font-medium sm:col-span-3 lg:col-span-2">
            {t("search")}
            <input
              type="search"
              className={field}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchPlaceholder")}
            />
          </label>
          <label className="text-xs font-medium">
            {t("field")}
            <select className={field} value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">{t("all")}</option>
              {GROUP_IDS.map((g) => (
                <option key={g} value={g}>
                  {groups[g][lang]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            {t("institution")}
            <select className={field} value={inst} onChange={(e) => setInst(e.target.value)}>
              <option value="">{t("all")}</option>
              {INSTITUTION_TYPES.map((ty) => (
                <optgroup key={ty} label={t(`types.${ty}`)}>
                  {Object.entries(institutions)
                    .filter(([, i]) => i.type === ty)
                    .map(([code, i]) => (
                      <option key={code} value={code}>
                        {i.short} — {i.city}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            {t("admission")}
            <select
              className={field}
              value={admission}
              onChange={(e) => setAdmission(e.target.value)}
            >
              <option value="">{t("all")}</option>
              {(["open", "ems", "selection", "work"] as const).map((a) => (
                <option key={a} value={a}>
                  {t(`adm.${a}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            {t("sort")}
            <select
              className={field}
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
            >
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t(`sorts.${s}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("typeFilter")}>
            {INSTITUTION_TYPES.map((ty) => {
              const on = types.includes(ty);
              return (
                <button
                  key={ty}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTypes(on ? types.filter((x) => x !== ty) : [...types, ty])}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {t(`types.${ty}`)}
                </button>
              );
            })}
          </div>
          <label className="ml-auto flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={hideMaster}
              onChange={(e) => setHideMaster(e.target.checked)}
            />
            {t("hideMaster")}
          </label>
        </div>
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {t("results", { count: rows.length })}
        </p>
        <p className="text-muted-foreground text-xs">{t("legend")}</p>

        {rows.length ? (
          sections.map((s) => (
            <div key={s.g || "all"} className="space-y-3">
              {s.g ? (
                <h3 className="pt-2 text-lg font-semibold">
                  {groups[s.g][lang]}{" "}
                  <span className="text-muted-foreground text-sm font-normal">
                    ({s.items.length})
                  </span>
                </h3>
              ) : null}
              <ol className="space-y-3">
                {s.items.map((p) => (
                  <ProgrammeCard
                    key={p.id}
                    p={p}
                    score={score(p)}
                    qs={qs}
                    lang={lang}
                    results={results}
                  />
                ))}
              </ol>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground py-10 text-center">{t("noResults")}</p>
        )}
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
                            setInst(code);
                            document
                              .getElementById("list-h")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          {progCount(code)}
                          <span className="sr-only"> {t("showProgrammesOf", { name: i.short })}</span>
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
}: {
  p: Programme;
  score: number | null;
  qs: string;
  lang: "en" | "de";
  results: ReturnType<typeof useScores>;
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
        {p.institutions.map((code) => {
          const i = institutions[code];
          return (
            <a
              key={code}
              href={i.url}
              target="_blank"
              rel="noopener noreferrer"
              title={i.name}
              className="border-border hover:bg-muted rounded-full border px-2 py-0.5"
            >
              {i.short}
            </a>
          );
        })}
      </div>
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
