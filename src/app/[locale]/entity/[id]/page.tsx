import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EntityView } from "@/components/entity/entity-view";
import { routing } from "@/i18n/routing";
import { displayName, entities, getEntity } from "@/lib/dataset";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => entities.map((e) => ({ locale, id: e.id })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/entity/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  const e = getEntity(id);
  return { title: e ? displayName(e, locale) : id };
}

export default async function EntityPage({ params }: PageProps<"/[locale]/entity/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!getEntity(id)) notFound();
  return (
    <Suspense>
      <EntityView id={id} />
    </Suspense>
  );
}
