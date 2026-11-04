"use client";
import { useTranslations } from "next-intl";
import type { Filters } from "@/lib/filters";
import type { LanguageRegion, Route } from "@/lib/schema";
import { Button } from "@/components/ui/button";

const field = "w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm";

export function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const t = useTranslations("filters");
  const tr = useTranslations("route");
  const set = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    for (const k of Object.keys(next) as (keyof Filters)[]) {
      const v = next[k];
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) delete next[k];
    }
    onChange(next);
  };
  return (
    <section aria-labelledby="filters-title">
      <h2 id="filters-title" className="sr-only">
        {t("title")}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <label className="col-span-2 text-xs font-medium sm:col-span-3 lg:col-span-1">
          {t("search")}
          <input
            type="search"
            className={field}
            placeholder={t("searchPlaceholder")}
            value={filters.query ?? ""}
            onChange={(e) => set({ query: e.target.value || undefined })}
          />
        </label>
        <label className="text-xs font-medium">
          {t("route")}
          <select
            className={field}
            value={filters.routes?.[0] ?? ""}
            onChange={(e) => set({ routes: e.target.value ? [e.target.value as Route] : undefined })}
          >
            <option value="">{t("anyRoute")}</option>
            {(["vocational", "mixed", "academic"] as const).map((r) => (
              <option key={r} value={r}>
                {tr(r)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          {t("maxYears")}
          <select
            className={field}
            value={filters.maxYears ?? ""}
            onChange={(e) => set({ maxYears: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">{t("anyYears")}</option>
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((y) => (
              <option key={y} value={y}>
                ≤ {y}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          {t("language")}
          <select
            className={field}
            value={filters.language ?? ""}
            onChange={(e) => set({ language: (e.target.value || undefined) as LanguageRegion | undefined })}
          >
            <option value="">{t("anyLanguage")}</option>
            {(["de", "fr", "it"] as const).map((l) => (
              <option key={l} value={l}>
                {t(`lang.${l}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          {t("minPay")}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={500}
            className={field}
            value={filters.minPay ?? ""}
            onChange={(e) => set({ minPay: e.target.value ? Number(e.target.value) : undefined })}
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
        {Object.keys(filters).length ? (
          <Button variant="ghost" size="sm" onClick={() => onChange({})}>
            {t("clear")}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
