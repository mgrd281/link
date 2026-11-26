import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";
import { AppModeIsland } from "@/features/app-mode/app-mode-island";
import { AppGate } from "@/features/app/gate";
import { ServiceWorkerIsland } from "@/features/app/install/service-worker-island";
import { StoreBridge } from "@/features/app-mode/store-bridge";
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
        {/* The dashboard's offline page (features/pwa); nothing else on the site registers a worker. */}
        <ServiceWorkerIsland />
        {/* The iPhone app's flush, reload and signOut (app mode only, ADR 0088). */}
        <StoreBridge />
        <AppGate>{children}</AppGate>
        {/* Inside Linkyo's iPhone app: navigate/back and the ready and route messages (features/app-mode). */}
        <AppModeIsland />
      </Providers>
    </ClientMessages>
  );
}
