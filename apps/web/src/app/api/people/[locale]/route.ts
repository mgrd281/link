import { getTranslations } from "next-intl/server";

import { buildPeople } from "@/features/search/people-index";
import { routing, type Locale } from "@/i18n/routing";

/** One list per language, built once at build time and served as a plain file. */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const isLocale = (value: string): value is Locale => (routing.locales as readonly string[]).includes(value);

/**
 * The people search's index (people-index.ts): who can be found, in one language. The search itself
 * runs in the visitor's browser, so this route never learns what anyone typed.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return Response.json({ people: [] }, { status: 404 });
  // People type "music" on the German site too: labels in the visitor's language and in English.
  const spoken = [...new Set([locale, "en" as const])];
  const categories = await Promise.all(spoken.map((code) => getTranslations({ locale: code, namespace: "examples.categories" })));
  const kinds = await Promise.all(spoken.map((code) => getTranslations({ locale: code, namespace: "app.welcome.kinds" })));
  const people = buildPeople(locale, {
    category: (key) => categories.map((t) => t(key)),
    kind: (key) => kinds.map((t) => t(`${key}.label`)),
  });
  return Response.json({ people }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800" } });
}
