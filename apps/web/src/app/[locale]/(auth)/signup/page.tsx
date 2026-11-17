import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SignupForm } from "@/features/account/auth/signup-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("meta.signup") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SignupForm />;
}
