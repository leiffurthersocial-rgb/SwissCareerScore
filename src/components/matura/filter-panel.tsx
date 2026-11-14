"use client";
import { RotateCcw, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { catalogue, INSTITUTION_TYPES } from "@/lib/programmes";
import { cn } from "@/lib/utils";
import {
  activeCount,
  ADMISSIONS,
  LANGUAGES,
  MAX_DROP,
  MAX_UNEMP,
  MIN_PAY,
  REGIONS,
  SORTS,
  YEARS,
  type MaturaFilters,
  type Sort,
} from "./use-matura-filters";

const field = "mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm font-normal";

function Chips({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function NumSelect({
  label,
  value,
  options,
  format,
  onChange,
}: {
  label: string;
  value: number | undefined;
  options: readonly number[];
  format: (n: number) => string;
  onChange: (v: number | undefined) => void;
}) {
  const t = useTranslations("matura");
  return (
    <label className="block text-xs font-semibold">
      {label}
      <select
        className={field}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      >
        <option value="">{t("any")}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {format(o)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MaturaFilterPanel({
  f,
  update,
  toggle,
  reset,
}: {
  f: MaturaFilters;
  update: (patch: Partial<MaturaFilters>) => void;
  toggle: (key: "groups" | "types" | "admissions" | "regions" | "languages", v: string) => void;
  reset: () => void;
}) {
  const t = useTranslations("matura");
  const locale = useLocale();
  const lang = locale === "de" ? "de" : "en";
  const { groups, institutions } = catalogue;
  const chf = (n: number) => `≥ CHF ${n.toLocaleString(locale === "de" ? "de-CH" : "en-CH")}`;
  const n = activeCount(f);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">
          {t("filtersTitle")}{" "}
          {n ? <span className="text-muted-foreground text-sm font-normal">({n})</span> : null}
        </h2>
        <Button variant="ghost" size="sm" onClick={reset} disabled={!n}>
          <RotateCcw aria-hidden /> {t("reset")}
        </Button>
      </div>

      <label className="block text-xs font-semibold">
        {t("search")}
        <input
          type="search"
          className={field}
          value={f.q}
          onChange={(e) => update({ q: e.target.value })}
          placeholder={t("searchPlaceholder")}
        />
      </label>

      <label className="block text-xs font-semibold">
        {t("sort")}
        <select
          className={field}
          value={f.sort}
          onChange={(e) => update({ sort: e.target.value as Sort })}
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`sorts.${s}`)}
            </option>
          ))}
        </select>
      </label>

      <Chips
        label={t("field")}
        options={Object.keys(groups).map((g) => ({ id: g, label: groups[g][lang] }))}
        selected={f.groups}
        onToggle={(v) => toggle("groups", v)}
      />
      <Chips
        label={t("typeFilter")}
        options={INSTITUTION_TYPES.map((ty) => ({ id: ty, label: t(`types.${ty}`) }))}
        selected={f.types}
        onToggle={(v) => toggle("types", v)}
      />
      <Chips
        label={t("admission")}
        options={ADMISSIONS.map((a) => ({ id: a, label: t(`adm.${a}`) }))}
        selected={f.admissions}
        onToggle={(v) => toggle("admissions", v)}
      />

      <div className="border-border space-y-4 border-t pt-4">
        <p className="text-muted-foreground text-xs">{t("whereHelp")}</p>
        <Chips
          label={t("region")}
          options={REGIONS.map((r) => ({ id: r, label: t(`regions.${r}`) }))}
          selected={f.regions}
          onToggle={(v) => toggle("regions", v)}
        />
        <Chips
          label={t("teachingLanguage")}
          options={LANGUAGES.map((l) => ({ id: l, label: t(`langs.${l}`) }))}
          selected={f.languages}
          onToggle={(v) => toggle("languages", v)}
        />
        <label className="block text-xs font-semibold">
          {t("institution")}
          <select
            className={field}
            value={f.inst}
            onChange={(e) => update({ inst: e.target.value })}
          >
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
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={f.strongOnly}
            onChange={(e) => update({ strongOnly: e.target.checked })}
          />
          <Star className="text-primary size-3 fill-current" aria-hidden />
          {t("strongOnly")}
        </label>
      </div>

      <div className="border-border grid grid-cols-2 gap-3 border-t pt-4">
        <NumSelect
          label={t("maxYears")}
          value={f.maxYears}
          options={YEARS}
          format={(y) => t("upToYears", { n: y })}
          onChange={(v) => update({ maxYears: v })}
        />
        <NumSelect
          label={t("minPay")}
          value={f.minPay}
          options={MIN_PAY}
          format={chf}
          onChange={(v) => update({ minPay: v })}
        />
        <NumSelect
          label={t("maxUnemp")}
          value={f.maxUnemp}
          options={MAX_UNEMP}
          format={(v) => `≤ ${v} %`}
          onChange={(v) => update({ maxUnemp: v })}
        />
        <NumSelect
          label={t("maxDrop")}
          value={f.maxDrop}
          options={MAX_DROP}
          format={(v) => `≤ ${v} %`}
          onChange={(v) => update({ maxDrop: v })}
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={f.hideMaster}
          onChange={(e) => update({ hideMaster: e.target.checked })}
        />
        {t("hideMaster")}
      </label>
    </div>
  );
}

/** Removable chips for every active filter, shown above the results. */
export function ActiveFilters({
  f,
  update,
  toggle,
  reset,
}: {
  f: MaturaFilters;
  update: (patch: Partial<MaturaFilters>) => void;
  toggle: (key: "groups" | "types" | "admissions" | "regions" | "languages", v: string) => void;
  reset: () => void;
}) {
  const t = useTranslations("matura");
  const locale = useLocale();
  const lang = locale === "de" ? "de" : "en";
  const { groups, institutions } = catalogue;
  const items: { key: string; label: string; clear: () => void }[] = [
    ...(f.q.trim() ? [{ key: "q", label: `“${f.q.trim()}”`, clear: () => update({ q: "" }) }] : []),
    ...f.groups.map((g) => ({
      key: `g${g}`,
      label: groups[g][lang],
      clear: () => toggle("groups", g),
    })),
    ...f.types.map((x) => ({
      key: `t${x}`,
      label: t(`types.${x}`),
      clear: () => toggle("types", x),
    })),
    ...f.admissions.map((x) => ({
      key: `a${x}`,
      label: t(`adm.${x}`),
      clear: () => toggle("admissions", x),
    })),
    ...f.regions.map((x) => ({
      key: `r${x}`,
      label: t(`regions.${x}`),
      clear: () => toggle("regions", x),
    })),
    ...f.languages.map((x) => ({
      key: `l${x}`,
      label: t(`langs.${x}`),
      clear: () => toggle("languages", x),
    })),
    ...(f.inst
      ? [{ key: "i", label: institutions[f.inst].short, clear: () => update({ inst: "" }) }]
      : []),
    ...(f.strongOnly
      ? [{ key: "s", label: t("strongOnly"), clear: () => update({ strongOnly: false }) }]
      : []),
    ...(f.maxYears !== undefined
      ? [
          {
            key: "y",
            label: t("upToYears", { n: f.maxYears }),
            clear: () => update({ maxYears: undefined }),
          },
        ]
      : []),
    ...(f.minPay !== undefined
      ? [
          {
            key: "p",
            label: `${t("payMid")} ≥ CHF ${f.minPay}`,
            clear: () => update({ minPay: undefined }),
          },
        ]
      : []),
    ...(f.maxUnemp !== undefined
      ? [
          {
            key: "u",
            label: `${t("unemployment")} ≤ ${f.maxUnemp} %`,
            clear: () => update({ maxUnemp: undefined }),
          },
        ]
      : []),
    ...(f.maxDrop !== undefined
      ? [
          {
            key: "d",
            label: `${t("dropout")} ≤ ${f.maxDrop} %`,
            clear: () => update({ maxDrop: undefined }),
          },
        ]
      : []),
    ...(f.hideMaster
      ? [{ key: "h", label: t("hideMaster"), clear: () => update({ hideMaster: false }) }]
      : []),
  ];
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label={t("activeFilters")}>
      {items.map((it) => (
        <li key={it.key}>
          <button
            type="button"
            onClick={it.clear}
            className="bg-accent text-accent-foreground hover:border-primary inline-flex items-center gap-1 rounded-full border border-transparent px-2.5 py-1 text-xs"
          >
            {it.label} <span aria-hidden>×</span>
            <span className="sr-only">{t("removeFilter")}</span>
          </button>
        </li>
      ))}
      <li>
        <button type="button" onClick={reset} className="text-primary px-1 text-xs underline">
          {t("resetAll")}
        </button>
      </li>
    </ul>
  );
}
