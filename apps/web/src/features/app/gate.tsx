"use client";

import { LogoSymbol, Skeleton, Spinner } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";

import { useAccount } from "@/features/account/store";
import { usePathname, useRouter } from "@/i18n/navigation";

import { SiteProvider } from "./site-context";

/** The admin console's loading screen: the Linkyo symbol and a spinner (its layout is not the dashboard's). */
export function BrandSplash() {
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
 * Shown while the session is read (server render, hydration) or while redirecting: the dashboard's
 * own outline in soft placeholders (header, title, profile, blocks, tab bar), as native apps load,
 * so the real screen fills in where the eye already is instead of after a spinner.
 */
export function AppSplash() {
  const t = useTranslations("app");
  return (
    <div className="min-h-dvh bg-canvas" role="status">
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden className="flex h-16 items-center gap-3 border-b border-line ps-4 pe-4">
        <Skeleton className="size-avatar-sm shrink-0 rounded-full" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-2 w-1/4" />
        </div>
        <Skeleton className="size-control-sm rounded-md" />
      </div>
      <div aria-hidden className="mx-auto grid max-w-prose gap-4 px-4 pt-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
      <div aria-hidden className="fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto grid h-16 max-w-prose grid-cols-5 place-items-center">
          {[0, 1, 2, 3, 4].map((slot) => (
            <Skeleton key={slot} className={slot === 2 ? "size-control-xl -translate-y-3 rounded-full" : "h-control-sm w-12 rounded-full"} />
          ))}
        </div>
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
