import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SignupForm } from "@/features/account/auth/signup-form";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  // A public page with a description of its own (lib/seo.ts PAGE_DESCRIPTIONS), not the site's default.
  const seo = await getTranslations({ locale, namespace: "sitePages.signup" });
  return { title: t("meta.signup"), description: seo("description"), alternates: localeAlternates("/signup", locale) };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SignupForm />;
}
