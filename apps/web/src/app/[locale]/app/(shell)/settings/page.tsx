import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SettingsScreen } from "@/features/app/settings-screen";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app.meta" });
  return { title: t("settings") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SettingsScreen />;
}
