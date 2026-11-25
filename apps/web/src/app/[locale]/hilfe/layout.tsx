import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { ClientMessages } from "@/i18n/client-messages-provider";

/** The help page: its search island reads the `help.search` words in the browser (`CLIENT_NAMESPACES.help`). */
export default async function HelpLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ClientMessages group="help">{children}</ClientMessages>;
}
