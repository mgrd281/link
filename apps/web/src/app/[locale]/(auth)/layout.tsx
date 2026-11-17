import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { AuthShell } from "@/features/account/auth/auth-shell";

export default async function AuthLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AuthShell locale={locale}>{children}</AuthShell>;
}
