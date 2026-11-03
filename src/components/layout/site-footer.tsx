import { useTranslations } from "next-intl";
import { dataset } from "@/lib/dataset";

export function SiteFooter() {
  const t = useTranslations("disclaimer");
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 pb-24 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">{t("short")}</p>
        <p>{t("long")}</p>
        <p>
          Data: BFS/FSO, SECO, berufsberatung.ch (SDBB) and documented estimates · dataset v{dataset.version} ({dataset.generated}) ·{" "}
          <a className="underline" href="https://github.com/leiffurthersocial-rgb/SwissCareerScore">
            source code
          </a>
        </p>
      </div>
    </footer>
  );
}
