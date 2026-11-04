"use client";
import { useLocale, useTranslations } from "next-intl";
import { ScoreBadge } from "@/components/score-badge";
import { Link } from "@/i18n/navigation";
import { displayName, entities } from "@/lib/dataset";
import type { CoreEntity } from "@/lib/dataset-types";
import type { EntityResult } from "@/lib/scoring";

const GROUPS: { id: string; test: (e: CoreEntity) => boolean }[] = [
  { id: "occupations", test: (e) => e.kind === "occupation" },
  { id: "apprenticeships", test: (e) => e.eduType === "EFZ" || e.eduType === "EBA" },
  { id: "higherVet", test: (e) => e.eduType === "HF" || e.eduType === "BP" || e.eduType === "HFP" },
  { id: "degrees", test: (e) => !!e.eduType && /^(FH|UH|ETH|DR)/.test(e.eduType) },
];

/** Four columns with the current top 5 per group — the quickest answer to "what scores best for me?". */
export function TopPicks({ results, queryString }: { results: Map<string, EntityResult>; queryString: string }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const qs = queryString ? `?${queryString}` : "";
  return (
    <section aria-labelledby="top-h" className="space-y-3">
      <h2 id="top-h" className="text-xl font-semibold">
        {t("topTitle")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {GROUPS.map((g) => {
          const top = entities
            .filter(g.test)
            .map((e) => ({ e, r: results.get(e.id)! }))
            .filter((x) => x.r && x.r.composite !== null && !x.r.insufficientData)
            .sort((a, b) => (b.r.composite ?? 0) - (a.r.composite ?? 0))
            .slice(0, 5);
          return (
            <div key={g.id} className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t(`top.${g.id}`)}</h3>
              <ol className="space-y-2.5">
                {top.map(({ e, r }) => (
                  <li key={e.id}>
                    <Link href={`/entity/${e.id}${qs}`} className="group flex items-center gap-3">
                      <ScoreBadge score={r.composite} size="sm" />
                      <span className="line-clamp-2 text-sm leading-snug group-hover:underline">{displayName(e, locale)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}
