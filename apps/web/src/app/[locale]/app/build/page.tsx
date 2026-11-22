import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { BuildScreen } from "@/features/ai/build-screen";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app.meta" });
  return { title: t("build") };
}

/** Build with AI: a full-screen task of the dashboard (outside its rail, like the welcome flow). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The screen reads its link (?link=) from the address.
  return (
    <Suspense>
      <BuildScreen />
    </Suspense>
  );
}
