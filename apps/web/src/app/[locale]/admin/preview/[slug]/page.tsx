import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { TeamPreviewScreen } from "@/features/admin/preview-screen";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.meta" });
  return { title: t("preview") };
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ lang?: string | string[] }> }) {
  const { locale, slug } = await params;
  const { lang } = await searchParams;
  setRequestLocale(locale);
  return (
    <main id="main">
      <TeamPreviewScreen slug={slug} lang={typeof lang === "string" ? lang : undefined} />
    </main>
  );
}
