import { routing, type Locale } from "@/i18n/routing";

/**
 * The words of `app/global-error.tsx`, which replaces the root layout when that layout itself fails:
 * no message provider is left by then, and its code is sent with every page, so it carries these few
 * strings instead of the message files. They are the same strings as `errors.error.*` and
 * `errors.actions.*` in src/messages (errors.test.ts keeps the two identical).
 */
export const GLOBAL_COPY: Record<Locale, { title: string; body: string; retry: string; home: string; dashboard: string }> = {
  de: {
    title: "Da ist etwas schiefgelaufen",
    body: "Diese Seite ließ sich gerade nicht laden. Versuch es noch einmal.",
    retry: "Noch einmal versuchen",
    home: "Zur Startseite",
    dashboard: "Zum Dashboard",
  },
  en: {
    title: "Something went wrong",
    body: "This page couldn't load just now. Please try again.",
    retry: "Try again",
    home: "Go to the home page",
    dashboard: "Go to the dashboard",
  },
  ar: {
    title: "حدث خطأ ما",
    body: "تعذّر تحميل هذه الصفحة الآن. حاول مرة أخرى.",
    retry: "حاول مرة أخرى",
    home: "إلى الصفحة الرئيسية",
    dashboard: "إلى لوحة التحكم",
  },
};

/**
 * The way out of a failed root layout: the home page in a browser; inside Linkyo's iPhone app (ADR 0087)
 * the dashboard, since the website shows the prices and the app's web view would follow the link there.
 * A plain link (the router may be what failed); the site link also carries `data-app-hide`, so the CSS
 * hides it in the app even before the page knows.
 */
export function wayOut(locale: Locale, app: boolean): { href: string; label: string; appHide: boolean } {
  const copy = GLOBAL_COPY[locale];
  return app ? { href: `/${locale}/app`, label: copy.dashboard, appHide: false } : { href: `/${locale}`, label: copy.home, appHide: true };
}

/** The language an address is in ("/ar/app" → "ar"); German for any other address. */
export function localeOfPath(pathname: string | null): Locale {
  const first = pathname?.split("/")[1] ?? "";
  return routing.locales.find((locale) => locale === first) ?? routing.defaultLocale;
}
