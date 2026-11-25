import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";
import { ClientMessages } from "@/i18n/client-messages-provider";
import { NOINDEX } from "@/lib/seo";

/** The design system is a working page for the team, not for search. */
export const metadata: Metadata = { robots: NOINDEX };

/** The design system shows the dashboard's and the website's parts, with their tooltips and toasts. */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <ClientMessages group="design">
      <Providers>{children}</Providers>
    </ClientMessages>
  );
}
