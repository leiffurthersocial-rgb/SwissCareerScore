"use client";
import { ArrowRight, GraduationCap } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ScoreBadge } from "@/components/score-badge";
import { Link } from "@/i18n/navigation";
import { displayName, getEntity } from "@/lib/dataset";
import type { CoreEntity } from "@/lib/dataset-types";
import { formatNumber } from "@/lib/format";
import type { EntityResult } from "@/lib/scoring";

function resolve(ids: string[] | undefined, results: Map<string, EntityResult>, exclude = new Set<string>()): CoreEntity[] {
  const seen = new Set<string>();
  return (ids ?? [])
    .filter((id) => !exclude.has(id) && !seen.has(id) && (seen.add(id), true))
    .map((id) => getEntity(id))
    .filter((x): x is CoreEntity => !!x)
    .sort((a, b) => (results.get(b.id)?.composite ?? -1) - (results.get(a.id)?.composite ?? -1));
}

function LinkGrid({ items, results, qs, limit = 12 }: { items: CoreEntity[]; results: Map<string, EntityResult>; qs: string; limit?: number }) {
  const locale = useLocale();
  const th = useTranslations("home");
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.slice(0, limit).map((o) => (
        <li key={o.id}>
          <Link href={`/entity/${o.id}${qs}`} className="group flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 hover:border-primary/50 hover:bg-muted">
            <ScoreBadge score={results.get(o.id)?.composite} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm leading-snug font-medium group-hover:underline">{displayName(o, locale)}</span>
              <span className="block text-xs text-muted-foreground">
                {o.kind === "education" ? o.eduType : null}
                {o.kind === "occupation" && o.p !== null ? `CHF ${formatNumber(Math.round(o.p / 100) * 100, locale)} · ${th("facts.pay")}` : null}
                {o.kind === "education" && o.y !== null ? ` · ${formatNumber(o.y, locale, 1)} y` : null}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Career graph: education → occupations / next steps, occupation ← education paths. */
export function CareerLinks({ id, results, qs }: { id: string; results: Map<string, EntityResult>; qs: string }) {
  const t = useTranslations("entity");
  const e = getEntity(id);
  if (!e) return null;
  const blocks: { key: string; title: string; desc?: string; items: CoreEntity[]; icon: typeof ArrowRight }[] = [];
  if (e.kind === "education") {
    const careers = resolve(e.careers?.length ? e.careers : e.leadsTo, results);
    const next = resolve(e.nextSteps, results);
    const own = new Set(careers.map((c) => c.id));
    const further = resolve(
      next.flatMap((n) => n.careers ?? []),
      results,
      own,
    );
    blocks.push({ key: "leads", title: t("leadsTitle"), desc: t("leadsDesc"), items: careers, icon: ArrowRight });
    if (next.length) blocks.push({ key: "next", title: t("nextTitle"), desc: t("nextDesc"), items: next, icon: GraduationCap });
    if (further.length) blocks.push({ key: "further", title: t("furtherTitle"), items: further, icon: ArrowRight });
  } else {
    const paths = resolve(e.entryPaths?.length ? e.entryPaths : e.trainedVia, results);
    blocks.push({ key: "paths", title: t("pathsTitle"), desc: t("pathsDesc"), items: paths, icon: GraduationCap });
  }
  return (
    <section aria-labelledby={`career-${blocks[0].key}`} className="space-y-5 rounded-xl border border-border bg-muted/40 p-4 sm:p-5">
      {blocks.map((b) => (
        <div key={b.key} className="space-y-2">
          <h2 id={`career-${b.key}`} className="flex items-center gap-2 text-lg font-semibold">
            <b.icon className="size-5 text-primary" aria-hidden /> {b.title}
            <span className="text-sm font-normal text-muted-foreground">({b.items.length})</span>
          </h2>
          {b.desc ? <p className="text-sm text-muted-foreground">{b.desc}</p> : null}
          {b.items.length ? <LinkGrid items={b.items} results={results} qs={qs} /> : <p className="text-sm text-muted-foreground">{t("noLinks")}</p>}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">{t("careerSource")}</p>
    </section>
  );
}
