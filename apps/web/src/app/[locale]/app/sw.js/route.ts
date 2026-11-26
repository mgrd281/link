import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { offlinePage } from "@/features/pwa/offline-page";
import { serviceWorkerScope } from "@/features/pwa/paths";
import { serviceWorkerSource } from "@/features/pwa/service-worker";
import { routing } from "@/i18n/routing";

/**
 * The dashboard's service worker of one language (features/pwa/service-worker.ts), written when the
 * site is built: its version is the build's time, so every deploy installs a new worker. Its scope is
 * this language's dashboard, `/<locale>/app`, which lies one step above the script's own folder, so
 * the response says the worker may have it (`Service-Worker-Allowed`).
 */
export const dynamic = "force-static";

/** Read once, when the build writes the three workers. */
const VERSION = new Date().toISOString();
const FAVICON = readFile(join(process.cwd(), "public/favicon.svg"), "utf8");

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return new Response(null, { status: 404 });
  const t = await getTranslations({ locale, namespace: "pwa.offline" });
  const scope = serviceWorkerScope(locale);
  const source = serviceWorkerSource({ version: VERSION, scope, offlineHtml: offlinePage(locale, (key) => t(key), await FAVICON) });
  return new Response(source, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Service-Worker-Allowed": scope,
      // Always asked again: a new build must reach open dashboards (the dashboard also registers it
      // with updateViaCache "none").
      "Cache-Control": "no-cache",
    },
  });
}
