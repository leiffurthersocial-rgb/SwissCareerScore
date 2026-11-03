import { defineRouting } from "next-intl/routing";

/** EN + DE ship first; FR/IT are scaffolded (message files fall back to EN for missing keys). */
export const routing = defineRouting({
  locales: ["en", "de", "fr", "it"],
  defaultLocale: "en",
});

export type AppLocale = (typeof routing.locales)[number];
