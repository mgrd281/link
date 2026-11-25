import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { ContactPage } from "@/features/marketing/pages/contact-page";
import { sitePageMetadata } from "@/features/marketing/pages/meta";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return sitePageMetadata(locale, "contact");
}

/** /kontakt: the existing contact (the e-mail address in COMPANY) and the way to the Impressum. No form. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ContactPage locale={locale} />;
}
