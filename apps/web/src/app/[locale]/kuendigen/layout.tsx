import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { ClientMessages } from "@/i18n/client-messages-provider";

/** The cancellation page: its form reads the `legal` words in the browser (`CLIENT_NAMESPACES.legal`). */
export default async function CancelLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ClientMessages group="legal">{children}</ClientMessages>;
}
