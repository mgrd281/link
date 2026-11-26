import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { appManifest } from "@/features/pwa/manifest";
import { routing } from "@/i18n/routing";

/** One manifest per language, written at build time (the language's root layout links it). */
export const dynamic = "force-static";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return new Response(null, { status: 404 });
  const t = await getTranslations({ locale, namespace: "pwa" });
  return new Response(JSON.stringify(appManifest(locale, (key) => t(key))), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
}
