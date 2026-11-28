import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { ClientMessages } from "@/i18n/client-messages-provider";

/** The report form reads the `report` words in the browser (`CLIENT_NAMESPACES.report`). */
export default async function ReportLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ClientMessages group="report">{children}</ClientMessages>;
}
