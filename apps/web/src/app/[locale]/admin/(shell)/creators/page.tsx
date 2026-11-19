import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CreatorsScreen } from "@/features/admin/creators-screen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.meta" });
  return { title: t("creators") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CreatorsScreen />;
}
