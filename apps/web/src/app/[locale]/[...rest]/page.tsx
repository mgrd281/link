import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { NotFoundScreen } from "@/features/errors/lazy-screens";
import { NOINDEX } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * No unknown address is known in advance: each one is rendered when it is first asked for and kept as a
 * static 404, so a repeated miss is not rendered again on every request.
 */
export function generateStaticParams(): { rest: string[] }[] {
  return [];
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

/** The miss itself, thrown inside the boundary below. */
function Missing(): never {
  notFound();
}

/**
 * Any address under a language that no route has (/de/nope, /ar/app/xyz, /en/admin/xyz): the site's
 * own not-found page, inside the language's layout (so `lang` and `dir` are right), with a real 404.
 * Without it such addresses fell through to Next's bare 404 without a language.
 *
 * Next renders a `notFound()` thrown outside any Suspense boundary through its bare error document
 * (`<html id="__next_error__">`: no `lang`, the text only once JavaScript runs). Thrown inside one, the
 * page renders: its server HTML carries `lang`, `dir` and the not-found page (the fallback, the same
 * screen as `../not-found.tsx`, which takes over in the browser), and the status stays 404 because
 * the page is rendered statically.
 */
export default function UnknownAddress() {
  return (
    <Suspense fallback={<NotFoundScreen />}>
      <Missing />
    </Suspense>
  );
}
