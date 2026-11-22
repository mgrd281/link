import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { MarketingFooter } from "@/features/marketing/footer";
import { MarketingHeader } from "@/features/marketing/header";

/** Linkyo's legal pages sit on the website: its header, their text, its footer (with the legal links). */
export default async function LegalLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </>
  );
}
