import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { Explorer } from "@/components/explorer/explorer";

export default function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations();
  return (
    <>
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("app.title")}</h1>
        <p className="text-muted-foreground">{t("app.tagline")}</p>
        <p className="rounded-md bg-warning-bg px-3 py-2 text-sm text-warning">{t("disclaimer.short")}</p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">{t("common.loading")}</p>}>
        <Explorer />
      </Suspense>
    </>
  );
}
