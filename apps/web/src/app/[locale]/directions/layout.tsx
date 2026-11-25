import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";
import { ClientMessages } from "@/i18n/client-messages-provider";
import { NOINDEX } from "@/lib/seo";

/** Design directions are prototypes, not for search. */
export const metadata: Metadata = { robots: NOINDEX };

/** The prototypes show the dashboard's parts (toolbar, editor), with their tooltips and toasts. */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <ClientMessages group="directions">
      <Providers>{children}</Providers>
    </ClientMessages>
  );
}
