import type { EduType, EntityKind, LanguageRegion, Route } from "./schema";

/**
 * Hard filters. They only HIDE entities from the visible list; they never change the
 * normalization pool, so scores stay comparable whatever filters are active.
 */
export interface Filters {
  kinds?: EntityKind[];
  routes?: Route[];
  eduTypes?: EduType[];
  /** Max years after compulsory school (time-to-qualify raw). Entities with unknown duration are hidden. */
  maxYears?: number;
  /** Language region in which the occupation/training must be available. */
  language?: LanguageRegion;
  /** Minimum median monthly gross wage (CHF, full-time). Entities without wage data are hidden. */
  minPay?: number;
  /** Case-insensitive name search. */
  query?: string;
}

export interface FilterableEntity {
  kind: EntityKind;
  route: Route;
  eduType?: EduType;
  languageRegions: LanguageRegion[];
  names: string[];
  yearsToQualify: number | null;
  medianPay: number | null;
}

export function passesFilters(e: FilterableEntity, f: Filters): boolean {
  if (f.kinds?.length && !f.kinds.includes(e.kind)) return false;
  if (f.routes?.length && !f.routes.includes(e.route)) return false;
  if (f.eduTypes?.length && (!e.eduType || !f.eduTypes.includes(e.eduType))) return false;
  if (f.maxYears !== undefined && (e.yearsToQualify === null || e.yearsToQualify > f.maxYears))
    return false;
  if (f.language && !e.languageRegions.includes(f.language)) return false;
  if (f.minPay !== undefined && (e.medianPay === null || e.medianPay < f.minPay)) return false;
  if (f.query) {
    const q = f.query.trim().toLowerCase();
    if (q && !e.names.some((n) => n.toLowerCase().includes(q))) return false;
  }
  return true;
}
