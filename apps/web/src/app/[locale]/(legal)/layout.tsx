import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { MarketingFooter } from "@/features/marketing/footer";
import { MarketingHeader } from "@/features/marketing/header";
import { ClientMessages } from "@/i18n/client-messages-provider";

/**
 * Linkyo's legal pages sit on the website: its header, their text, its footer (with the legal links).
 * The withdrawal form reads the `legal` words in the browser (`CLIENT_NAMESPACES.legal`).
 */
export default async function LegalLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ClientMessages group="legal">
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </ClientMessages>
  );
}
