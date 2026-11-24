import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { NOINDEX } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * The title of the 404 ("Seite nicht gefunden · Linkyo"): with a global not-found page Next takes the
 * failed page's metadata, so it lives here, in the language of the address (named explicitly, so no
 * request header is read).
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "errors.meta" });
  return { title: t("notFound"), robots: NOINDEX };
}

/**
 * Any address under a language that no route has (/de/nope, /ar/app/xyz, /en/admin/xyz): the site's
 * own not-found page, inside the language's layout (so `lang` and `dir` are right), with a real 404.
 * Without it such addresses fell through to Next's bare 404 without a language.
 */
export default function UnknownAddress(): never {
  notFound();
}
