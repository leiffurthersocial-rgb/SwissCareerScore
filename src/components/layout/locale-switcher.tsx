"use client";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";

/** EN and DE ship first; FR/IT routes exist but fall back to English strings until translated. */
const SHIPPED = [
  { code: "en", label: "EN" },
  { code: "de", label: "DE" },
] as const;

export function LocaleSwitcher() {
  const t = useTranslations("locale");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="sr-only">{t("label")}</span>
      <select
        className="rounded-md border border-border bg-card px-1.5 py-1 text-sm"
        value={locale}
        onChange={(e) => {
          const qs = params.toString();
          router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { locale: e.target.value });
        }}
      >
        {SHIPPED.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
