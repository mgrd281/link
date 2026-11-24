import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { AppGate } from "@/features/app/gate";
import { GatedRouteCheck } from "@/features/errors/gated-route-check";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Everything under /app needs a session; the gate checks it in the browser (demo accounts live there).
 * The gate shows its splash while the server renders, so a page's own `notFound()` never reaches the
 * server; addresses that can never exist are answered next to the gate instead, with a real 404.
 */
export default async function AppLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <GatedRouteCheck area="app" />
      <AppGate>{children}</AppGate>
    </>
  );
}
