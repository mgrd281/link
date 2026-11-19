"use client";

import { LogoSymbol, Spinner } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";

import { useAccount } from "@/features/account/store";
import { usePathname, useRouter } from "@/i18n/navigation";

import { SiteProvider } from "./site-context";

/** Shown while the session is read (server render, hydration) or while redirecting. */
export function AppSplash() {
  const t = useTranslations("app");
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas">
      <div className="grid justify-items-center gap-4" role="status">
        <LogoSymbol className="size-control-xl" />
        <Spinner className="size-icon-md text-fg-tertiary" />
        <span className="sr-only">{t("loading")}</span>
      </div>
    </div>
  );
}

/**
 * Guards /app: signed-out visitors go to log-in (and come back afterwards), new accounts go through
 * the welcome flow first. Everything below gets one shared editor for the creator's page.
 */
export function AppGate({ children }: { children: ReactNode }) {
  const snapshot = useAccount();
  const router = useRouter();
  const pathname = usePathname();
  const needsWelcome = snapshot.status === "signedIn" && !snapshot.site.onboarded && pathname !== "/app/welcome";

  useEffect(() => {
    if (snapshot.status === "signedOut") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (needsWelcome) router.replace("/app/welcome");
  }, [snapshot.status, needsWelcome, pathname, router]);

  if (snapshot.status !== "signedIn" || needsWelcome) return <AppSplash />;
  // Keyed by account: a different login starts from that account's page, never from stale state.
  return <SiteProvider key={snapshot.account.id}>{children}</SiteProvider>;
}
