import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { AdminGate } from "@/features/admin/session";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** The Linkyo team area: a signed-in account on the team; the gate checks it in the browser (demo). */
export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminGate>{children}</AdminGate>;
}
