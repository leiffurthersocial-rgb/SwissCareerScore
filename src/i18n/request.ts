import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import en from "../../messages/en.json";

type Messages = typeof en;

function deepMerge(base: Messages, override: Partial<Messages>): Messages {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const b = (base as Record<string, unknown>)[k];
    out[k] =
      v && typeof v === "object" && !Array.isArray(v) && b && typeof b === "object"
        ? deepMerge(b as Messages, v as Partial<Messages>)
        : v;
  }
  return out as Messages;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const localeMessages =
    locale === "en" ? en : ((await import(`../../messages/${locale}.json`)).default as Partial<Messages>);
  return { locale, messages: locale === "en" ? en : deepMerge(en, localeMessages) };
});
