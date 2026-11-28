import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ReportsScreen } from "@/features/admin/reports-screen";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.meta" });
  return { title: t("reports") };
}

/** The team's queue of reports from the public form (DSA notice and action). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReportsScreen />;
}
