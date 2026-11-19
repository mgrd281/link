import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CreatorScreen } from "@/features/admin/creator-screen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.meta" });
  return { title: t("creator") };
}

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <CreatorScreen slug={slug} />;
}
