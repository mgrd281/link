import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { CreatorNotFoundScreen } from "@/features/creator/not-found-lazy";
import { NOINDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Linkyo", robots: NOINDEX };

/**
 * An address nobody has (yet): Linkyo's own calm page, in the language of the layout around it, with
 * the way to make one. Answered with status 404. Its code loads with this page only (ADR 0008).
 */
export default async function CreatorNotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "creator.notFound" });
  return <CreatorNotFoundScreen title={t("title")} body={t("body")} cta={t("cta")} href={`/${locale}/signup`} />;
}
