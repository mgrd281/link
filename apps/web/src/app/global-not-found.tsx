import "./globals.css";

import { Button, Logo } from "@linkyo/ui";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { fontVariables } from "@/fonts";
import { isRtl, routing } from "@/i18n/routing";
import { NOINDEX } from "@/lib/seo";
import { themeInitScript } from "@/lib/theme-script";

/** No language in the address: German, the default (no request is read, so the page stays static). */
const locale = routing.defaultLocale;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "errors.meta" });
  return { title: `${t("notFound")} · Linkyo`, robots: NOINDEX };
}

/**
 * An address no route matches at all (outside the languages): Linkyo's own page instead of Next's
 * bare one. It has no layout around it, so it brings its own <html>, styles, fonts and theme. German
 * by default, with the three languages to choose. Plain links: nothing here needs the router.
 */
export default async function GlobalNotFound() {
  const t = await getTranslations({ locale, namespace: "errors" });
  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"} className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Before paint: the stored theme (light, dark or the system's). */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh bg-canvas text-fg">
        <main id="main" className="grid min-h-dvh place-items-center px-4 pt-16 pb-16">
          <div className="grid w-full max-w-prose justify-items-center gap-8 text-center">
            <Logo className="h-8" />
            <div className="grid gap-3">
              <h1 className="text-h2 font-semibold text-balance rtl:tracking-normal">{t("notFound.title")}</h1>
              <p className="text-body text-pretty text-fg-secondary">{t("notFound.body")}</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
              <Button asChild variant="primary" size="cta" className="w-full sm:w-auto">
                <a href={`/${locale}`}>{t("actions.home")}</a>
              </Button>
              <Button asChild variant="tinted" size="cta" className="w-full sm:w-auto">
                <a href={`/${locale}/templates`}>{t("actions.templates")}</a>
              </Button>
            </div>
            <nav aria-label={t("languages.label")} className="flex flex-wrap justify-center gap-1">
              {routing.locales.map((other) => (
                <a
                  key={other}
                  href={`/${other}`}
                  lang={other}
                  hrefLang={other}
                  aria-current={other === locale ? "true" : undefined}
                  className="inline-flex min-h-touch-target items-center rounded-full px-3 text-small font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring aria-[current]:text-fg"
                >
                  {t(`languages.${other}`)}
                </a>
              ))}
            </nav>
          </div>
        </main>
      </body>
    </html>
  );
}
