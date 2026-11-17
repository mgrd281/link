import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { AppGate } from "@/features/app/gate";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Everything under /app needs a session; the gate checks it in the browser (demo accounts live there). */
export default async function AppLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AppGate>{children}</AppGate>;
}
