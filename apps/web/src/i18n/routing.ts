import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["de", "en", "ar"],
  defaultLocale: "de",
  localePrefix: "always",
  // No language cookie: every address carries its language, and no page of ours sets a cookie on
  // its own (the homepage promises it; creator pages must never). Without it, "/" follows the
  // browser's language on each visit.
  localeCookie: false,
});

export type Locale = (typeof routing.locales)[number];

export const isRtl = (locale: string): boolean => locale === "ar";
