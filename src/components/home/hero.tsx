"use client";
import { ArrowRight, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { displayName, entities } from "@/lib/dataset";
import type { CoreEntity } from "@/lib/dataset-types";

const counts = {
  occ: entities.filter((e) => e.kind === "occupation").length,
  edu: entities.filter((e) => e.kind === "education").length,
};

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Hero with instant search: jump straight to any of ~1,300 occupations and education paths. */
export function Hero({ queryString }: { queryString: string }) {
  const t = useTranslations("home");
  const tk = useTranslations("kind");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const listId = useId();
  const index = useMemo(
    () => entities.map((e) => ({ e, hay: normalize([e.name.en, e.name.de, e.name.fr, e.name.it].filter(Boolean).join(" ")) })),
    [],
  );
  const hits: CoreEntity[] = useMemo(() => {
    const n = normalize(q.trim());
    if (n.length < 2) return [];
    const words = n.split(/\s+/);
    return index
      .filter((x) => words.every((w) => x.hay.includes(w)))
      .sort((a, b) => a.hay.indexOf(words[0]) - b.hay.indexOf(words[0]))
      .slice(0, 8)
      .map((x) => x.e);
  }, [q, index]);
  const qs = queryString ? `?${queryString}` : "";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[var(--hero-from)] to-[var(--hero-to)] px-5 py-8 sm:px-10 sm:py-12">
      <p className="mb-2 text-sm font-medium text-primary">{t("eyebrow")}</p>
      <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">{t("subtitle")}</p>

      <div className="relative mt-6 max-w-xl">
        <label htmlFor="hero-search" className="sr-only">
          {t("searchLabel")}
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          id="hero-search"
          type="search"
          aria-controls={hits.length ? listId : undefined}
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-xl border border-border bg-card py-3.5 pr-4 pl-12 text-base shadow-sm"
        />
        {hits.length ? (
          <ul id={listId} aria-label={t("searchLabel")} className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            {hits.map((e) => (
              <li key={e.id}>
                <Link href={`/entity/${e.id}${qs}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted focus-visible:bg-muted">
                  <span className="truncate">{displayName(e, locale)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{e.kind === "occupation" ? tk("occupation") : e.eduType}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="sr-only">{tk("occupations")}</dt>
          <dd>
            <span className="text-xl font-bold">{counts.occ}</span> <span className="text-muted-foreground">{tk("occupations")}</span>
          </dd>
        </div>
        <div>
          <dt className="sr-only">{tk("educations")}</dt>
          <dd>
            <span className="text-xl font-bold">{counts.edu}</span> <span className="text-muted-foreground">{tk("educations")}</span>
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-sm text-muted-foreground">{t("sources")}</p>
      <a href="#explore" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        {t("jump")} <ArrowRight className="size-4" aria-hidden />
      </a>
    </section>
  );
}
