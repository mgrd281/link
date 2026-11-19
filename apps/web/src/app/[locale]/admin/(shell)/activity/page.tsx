import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ActivityScreen } from "@/features/admin/activity-screen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.meta" });
  return { title: t("activity") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ActivityScreen />;
}
