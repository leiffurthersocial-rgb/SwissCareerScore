import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AfterMatura } from "@/components/matura/after-matura";

export async function generateMetadata({ params }: PageProps<"/[locale]/after-matura">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "matura" });
  return { title: t("title"), description: t("intro") };
}

export default async function AfterMaturaPage({ params }: PageProps<"/[locale]/after-matura">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <>
      <Suspense fallback={<p className="text-muted-foreground">{t("common.loading")}</p>}>
        <AfterMatura />
      </Suspense>
      <p className="mt-10 rounded-md bg-warning-bg px-3 py-2 text-sm text-warning">{t("disclaimer.short")}</p>
    </>
  );
}
