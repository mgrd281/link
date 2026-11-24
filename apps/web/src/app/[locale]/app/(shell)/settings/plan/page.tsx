import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PlanScreen } from "@/features/app/settings/plan-screen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, tMeta] = await Promise.all([
    getTranslations({ locale, namespace: "app.settings.panes" }),
    getTranslations({ locale, namespace: "app.meta" }),
  ]);
  return { title: `${t("plan")} · ${tMeta("settings")}` };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PlanScreen />;
}
