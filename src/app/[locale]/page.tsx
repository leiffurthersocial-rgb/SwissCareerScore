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
      <Suspense fallback={<p className="text-muted-foreground">{t("common.loading")}</p>}>
        <Explorer />
      </Suspense>
      <p className="mt-10 rounded-md bg-warning-bg px-3 py-2 text-sm text-warning">{t("disclaimer.short")}</p>
    </>
  );
}
