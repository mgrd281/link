import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminAnalyticsScreen } from "@/features/admin/analytics-screen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.meta" });
  return { title: t("analytics") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminAnalyticsScreen />;
}
