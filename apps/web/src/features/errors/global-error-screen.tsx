import { Button, Logo } from "@linkyo/ui";

import type { Locale } from "@/i18n/routing";

import { wayOut, type GLOBAL_COPY } from "./global-copy";

type Copy = (typeof GLOBAL_COPY)[keyof typeof GLOBAL_COPY];

/**
 * The page `app/global-error.tsx` shows when the root layout itself failed: Linkyo's logo, one
 * sentence, "try again" and the way home (a plain link: the router may be what failed); inside the
 * iPhone app the way back to the dashboard instead (`wayOut`). Loaded only then, so the UI kit it
 * draws with is not sent with every page (ADR 0008).
 */
export function GlobalErrorScreen({ copy, locale, retry, app }: { copy: Copy; locale: Locale; retry: () => void; app: boolean }) {
  const out = wayOut(locale, app);
  return (
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
            <a href={out.href} {...(out.appHide ? { "data-app-hide": "" } : {})}>
              {out.label}
            </a>
          </Button>
        </div>
      </div>
    </main>
  );
}
