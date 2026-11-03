import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CompareView } from "@/components/compare-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/compare">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "compare" });
  return { title: t("title") };
}

export default async function ComparePage({ params }: PageProps<"/[locale]/compare">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "compare" });
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">{t("title")}</h1>
      <Suspense>
        <CompareView />
      </Suspense>
    </>
  );
}
