import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { AuthShell } from "@/features/account/auth/auth-shell";
import { ClientMessages } from "@/i18n/client-messages-provider";

/** Sign-up and sign-in; their forms read the `auth` words in the browser (`CLIENT_NAMESPACES.auth`). */
export default async function AuthLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ClientMessages group="auth">
      <AuthShell>{children}</AuthShell>
    </ClientMessages>
  );
}
