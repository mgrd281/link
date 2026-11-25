import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";
import { AppGate } from "@/features/app/gate";
import { GatedRouteCheck } from "@/features/errors/gated-route-check";
import { ClientMessages } from "@/i18n/client-messages-provider";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Everything under /app needs a session; the gate checks it in the browser (demo accounts live there).
 * The gate shows its splash while the server renders, so a page's own `notFound()` never reaches the
 * server; addresses that can never exist are answered next to the gate instead, with a real 404.
 */
export default async function AppLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The dashboard's own words, tooltips and toasts (the root layout carries the website's only).
  return (
    <ClientMessages group="app">
      <Providers>
        <GatedRouteCheck area="app" />
        <AppGate>{children}</AppGate>
      </Providers>
    </ClientMessages>
  );
}
