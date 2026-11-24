import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { AdminGate } from "@/features/admin/session";
import { GatedRouteCheck } from "@/features/errors/gated-route-check";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The Linkyo team area: a signed-in account on the team; the gate checks it in the browser (demo).
 * As in /app, addresses that can never exist are answered next to the gate, with a real 404.
 */
export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <GatedRouteCheck area="admin" />
      <AdminGate>{children}</AdminGate>
    </>
  );
}
