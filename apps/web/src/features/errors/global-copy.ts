import { routing, type Locale } from "@/i18n/routing";

/**
 * The words of `app/global-error.tsx`, which replaces the root layout when that layout itself fails:
 * no message provider is left by then, and its code is sent with every page, so it carries these few
 * strings instead of the message files. They are the same strings as `errors.error.*` and
 * `errors.actions.*` in src/messages (errors.test.ts keeps the two identical).
 */
export const GLOBAL_COPY: Record<Locale, { title: string; body: string; retry: string; home: string }> = {
  de: {
    title: "Da ist etwas schiefgelaufen",
    body: "Diese Seite ließ sich gerade nicht laden. Versuch es noch einmal.",
    retry: "Noch einmal versuchen",
    home: "Zur Startseite",
  },
  en: {
    title: "Something went wrong",
    body: "This page couldn't load just now. Please try again.",
    retry: "Try again",
    home: "Go to the home page",
  },
  ar: {
    title: "حدث خطأ ما",
    body: "تعذّر تحميل هذه الصفحة الآن. حاول مرة أخرى.",
    retry: "حاول مرة أخرى",
    home: "إلى الصفحة الرئيسية",
  },
};

/** The language an address is in ("/ar/app" → "ar"); German for any other address. */
export function localeOfPath(pathname: string | null): Locale {
  const first = pathname?.split("/")[1] ?? "";
  return routing.locales.find((locale) => locale === first) ?? routing.defaultLocale;
}
