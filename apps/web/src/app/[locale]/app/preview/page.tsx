import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { OwnPageScreen } from "@/features/app/own-page-screen";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app.meta" });
  return { title: t("preview") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OwnPageScreen />;
}
