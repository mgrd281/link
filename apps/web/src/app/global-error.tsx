"use client";

import "./globals.css";

import { Button, Logo } from "@linkyo/ui";
import { usePathname } from "next/navigation";

import { fontVariables } from "@/fonts";
import { GLOBAL_COPY, localeOfPath } from "@/features/errors/global-copy";
import { isRtl } from "@/i18n/routing";

/**
 * The root layout itself failed: this replaces the whole document, so it brings its own <html> in
 * the address's language, the styles and the fonts. Linkyo's logo, one sentence, "try again" and the
 * way home (a plain link: the router may be what failed).
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  const locale = localeOfPath(usePathname());
  const copy = GLOBAL_COPY[locale];
  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"} className={fontVariables}>
      <body className="min-h-dvh bg-canvas text-fg">
        <title>{copy.title}</title>
        <main id="main" className="grid min-h-dvh place-items-center px-4 pt-16 pb-16">
          <div className="grid w-full max-w-prose justify-items-center gap-8 text-center">
            <Logo className="h-8" />
            <div className="grid gap-3">
              <h1 className="text-h2 font-semibold text-balance rtl:tracking-normal">{copy.title}</h1>
              <p className="text-body text-pretty text-fg-secondary">{copy.body}</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
              <Button variant="primary" size="cta" className="w-full sm:w-auto" onClick={retry}>
                {copy.retry}
              </Button>
              <Button asChild variant="tinted" size="cta" className="w-full sm:w-auto">
                <a href={`/${locale}`}>{copy.home}</a>
              </Button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
