"use client";

import "./globals.css";

import { usePathname } from "next/navigation";
import { lazy, Suspense } from "react";

import { useAppMode, useKeepAppSignal } from "@/features/app-mode/use-app-mode";
import { fontVariables } from "@/fonts";
import { GLOBAL_COPY, localeOfPath, wayOut } from "@/features/errors/global-copy";
import { isRtl, type Locale } from "@/i18n/routing";

type Copy = (typeof GLOBAL_COPY)[keyof typeof GLOBAL_COPY];

/**
 * The same words and ways out without the UI kit: what shows while the full screen loads, and for
 * good when it cannot load (offline, or the failure was a missing file).
 */
function PlainScreen({ copy, locale, retry, app }: { copy: Copy; locale: Locale; retry: () => void; app: boolean }) {
  const out = wayOut(locale, app);
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4 pt-16 pb-16">
      <div className="grid w-full max-w-prose justify-items-center gap-8 text-center">
        <div className="grid gap-3">
          <h1 className="text-h2 font-semibold text-balance rtl:tracking-normal">{copy.title}</h1>
          <p className="text-body text-pretty text-fg-secondary">{copy.body}</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
          <button type="button" onClick={retry} className="min-h-touch-target rounded-full px-4 font-semibold text-link hover:text-fg focus-visible:focus-ring">
            {copy.retry}
          </button>
          <a
            href={out.href}
            {...(out.appHide ? { "data-app-hide": "" } : {})}
            className="inline-flex min-h-touch-target items-center justify-center rounded-full px-4 font-semibold text-link hover:text-fg focus-visible:focus-ring"
          >
            {out.label}
          </a>
        </div>
      </div>
    </main>
  );
}

// Linkyo's screen (logo and buttons) loads only once the root layout has failed: the UI kit it draws
// with is not sent with every page (ADR 0008). If it cannot load, the plain screen stays.
const Screen = lazy(() =>
  import("@/features/errors/global-error-screen").then(
    (module) => ({ default: module.GlobalErrorScreen }),
    () => ({ default: PlainScreen }),
  ),
);

/**
 * The root layout itself failed: this replaces the whole document, so it brings its own <html> in
 * the address's language, the styles and the fonts. Linkyo's logo, one sentence, "try again" and the
 * way home (a plain link: the router may be what failed). Inside Linkyo's iPhone app (ADR 0087) the
 * new <html> has lost the app's `data-app`: it is put back before the browser paints, and the only
 * way out is back to the dashboard (or "try again"), never the website.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  const locale = localeOfPath(usePathname());
  const copy = GLOBAL_COPY[locale];
  useKeepAppSignal();
  const app = useAppMode();
  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"} className={fontVariables}>
      <body className="min-h-dvh bg-canvas text-fg">
        <title>{copy.title}</title>
        <Suspense fallback={<PlainScreen copy={copy} locale={locale} retry={retry} app={app} />}>
          <Screen copy={copy} locale={locale} retry={retry} app={app} />
        </Suspense>
      </body>
    </html>
  );
}
