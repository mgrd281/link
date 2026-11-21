"use client";

import { cn, Icon, Logo, LogoSymbol, Skeleton, Spinner } from "@linkyo/ui";
import { ChartNoAxesColumn, House, LayoutList, Palette } from "lucide-react";
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

const SPLASH_NAV = [
  { key: "home", icon: House },
  { key: "page", icon: LayoutList },
  { key: "design", icon: Palette },
  { key: "analytics", icon: ChartNoAxesColumn },
] as const;

/** The content column's start edge, as in `Screen`: the title and the groups appear right here. */
const gutters =
  "pl-[max(var(--spacing-4),env(safe-area-inset-left))] pr-[max(var(--spacing-4),env(safe-area-inset-right))] md:pl-[max(var(--spacing-8),env(safe-area-inset-left))] md:pr-[max(var(--spacing-8),env(safe-area-inset-right))] lg:ps-10 lg:pe-8";

/**
 * Shown while the session is read (server render, hydration) or while redirecting: the dashboard's
 * own frame at every width (phone bars; or the sidebar, the toolbar and the live preview column) with
 * soft placeholders where the content goes, as native apps load. The real screen then fills in
 * where the eye already is, and the frame does not jump.
 */
export function AppSplash() {
  const t = useTranslations("app");
  return (
    // data-grouped: the same ground and scrollbar gutter as the shell, so nothing shifts when it appears.
    // data-console="frame": black and grey from the first paint, as the shell (ADR 0062).
    <div data-grouped data-console="frame" className="flex min-h-dvh bg-canvas-muted" role="status">
      <span className="sr-only">{t("loading")}</span>

      <div aria-hidden className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col border-e border-line bg-surface px-3 pb-3 lg:flex">
        <div className="flex h-16 shrink-0 items-center ps-3">
          <Logo className="h-6" tone="mono" />
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-3 py-2">
          <Skeleton className="size-avatar-sm rounded-full" />
          {/* The two text lines of the real card (20 + 16 px), so the rows below sit where they will. */}
          <span className="grid">
            <span className="flex h-5 items-center">
              <Skeleton className="h-3 w-24" />
            </span>
            <span className="flex h-4 items-center">
              <Skeleton className="h-2 w-32" />
            </span>
          </span>
        </div>
        <Skeleton className="mt-2 h-control-md rounded-md" />
        <div className="mt-4 grid grid-cols-1 gap-0.5">
          {SPLASH_NAV.map((item) => (
            <div key={item.key} className="flex h-control-md items-center gap-3 px-3 text-small font-medium text-fg-secondary">
              <span className="grid size-8 shrink-0 place-items-center">
                <Icon icon={item.icon} size="sm" />
              </span>
              <span className="truncate">{t(`nav.${item.key}`)}</span>
            </div>
          ))}
        </div>
      </div>

      <div aria-hidden className="min-w-0 flex-1">
        {/* Phones: the shell's bar (avatar at the start, the page at the end). */}
        <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center pr-[max(var(--spacing-2),env(safe-area-inset-right))] pl-[max(var(--spacing-2),env(safe-area-inset-left))] lg:hidden">
          <span className="grid size-touch-target place-items-center">
            <Skeleton className="size-avatar-sm rounded-full" />
          </span>
          <span />
          <span className="grid size-touch-target place-items-center justify-self-end">
            <Skeleton className="size-icon-md rounded-md" />
          </span>
        </div>
        {/* The title: a large title on phones, the toolbar on wide screens. */}
        <div className={cn(gutters, "pt-6 lg:h-16 lg:pt-0")}>
          <div className="mx-auto flex max-w-prose lg:mx-0 lg:h-full lg:items-center">
            <Skeleton className="h-8 w-1/2 lg:h-6 lg:w-32" />
          </div>
        </div>
        <div className={cn(gutters, "pt-4 lg:pt-2")}>
          <div className="mx-auto grid max-w-prose grid-cols-1 gap-6 lg:mx-0">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="sticky top-0 hidden h-dvh shrink-0 flex-col gap-3 border-s border-line px-4 pb-4 desk:flex desk:w-[calc(var(--container-preview-compact)+var(--spacing-8))] xl:w-[calc(var(--container-preview)+var(--spacing-8))]"
      >
        <div className="flex h-16 shrink-0 items-center">
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="mx-auto min-h-0 w-full max-w-preview-compact flex-1 rounded-xl xl:max-w-preview" />
      </div>

      <div aria-hidden className="fixed inset-x-0 bottom-0 border-t border-line bg-surface pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] lg:hidden">
        <div className="mx-auto grid h-16 max-w-prose grid-cols-5 place-items-center">
          {[0, 1, 2, 3, 4].map((slot) => (
            <Skeleton key={slot} className={slot === 2 ? "h-control-sm w-12 rounded-full" : "size-icon-md rounded-md"} />
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
