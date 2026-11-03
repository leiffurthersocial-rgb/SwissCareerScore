export function formatNumber(v: number, locale: string, digits = 0): string {
  const loc = locale === "de" ? "de-CH" : locale === "fr" ? "fr-CH" : locale === "it" ? "it-CH" : "en-CH";
  return new Intl.NumberFormat(loc, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(v);
}

/** Format a datapoint value with its unit, choosing sensible precision per unit. */
export function formatValue(value: number | null, unit: string, locale: string): string {
  if (value === null || value === undefined) return "—";
  if (unit.startsWith("CHF")) return `CHF ${formatNumber(value, locale, 0)}`;
  if (unit === "%" || unit === "% firms") return `${formatNumber(value, locale, 1)} %`;
  if (unit === "years") return formatNumber(value, locale, 1);
  if (unit === "h/week") return `${formatNumber(value, locale, 1)} h`;
  if (unit === "ratio") return `× ${formatNumber(value, locale, 2)}`;
  if (unit.startsWith("rubric")) return `${formatNumber(value, locale, 0)} / ${unit.split("–")[1] ?? ""}`.trim();
  if (unit.startsWith("index")) return formatNumber(value, locale, 0);
  return formatNumber(value, locale, 1);
}
