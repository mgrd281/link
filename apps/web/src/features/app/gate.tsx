"use client";

import { cn, Icon, icons, LogoSymbol, Skeleton, Spinner } from "@linkyo/ui";
import { ChartNoAxesColumn, Eye, Gift, House, Palette, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";

import { useAccount } from "@/features/account/store";
import { usePathname, useRouter } from "@/i18n/navigation";

import { sectionPanelShown } from "./nav";
import { isGrownPath, routeInfo } from "./routes";
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

/** The rail's places, as in the shell (nav.tsx). */
const SPLASH_NAV = [
  { key: "home", icon: House },
  { key: "page", icon: icons.page },
  { key: "design", icon: Palette },
  { key: "analytics", icon: ChartNoAxesColumn },
  { key: "invite", icon: Gift },
] as const;

/** A 44 px slot of the rail with its icon, where the shell's control will be. */
const railSlot = "grid size-touch-target place-items-center text-fg-secondary";

/** The content column's start edge, as in `Screen`: the title and the groups appear right here. */
const gutters =
  "pl-[max(var(--spacing-4),env(safe-area-inset-left))] pr-[max(var(--spacing-4),env(safe-area-inset-right))] md:pl-[max(var(--spacing-8),env(safe-area-inset-left))] md:pr-[max(var(--spacing-8),env(safe-area-inset-right))] lg:ps-10 lg:pe-8";

/**
 * Shown while the session is read (server render, hydration) or while redirecting: the dashboard's
 * own frame at every width (phone bars; or the rail, the section panel, the toolbar and the live
 * preview column) with soft placeholders where the content goes, as native apps load. The real screen
 * then fills in where the eye already is, and the frame does not jump. The panel folds by CSS alone
 * (`nav-folded:`, from the pre-paint script), so a stored "folded" is right in the server HTML too.
 */
export function AppSplash() {
  const t = useTranslations("app");
  // The place being opened decides the frame, as in the shell and Screen: the section panel only
  // where it has one (and the fold toggle with it), the wide column from lg, centred without a panel.
  // Otherwise Home, Page and Design would jump once the shell mounts.
  const pathname = usePathname();
  const section = routeInfo(pathname).section;
  const panel = sectionPanelShown(section);
  const wide = section === "home" || section === "invite" || (section === "analytics" && !panel);
  // The screens that `grow` take the content width from laptops on (Screen), the forms stop at column-wide.
  const column = cn("mx-auto", wide ? "max-w-content" : cn("max-w-prose", isGrownPath(pathname) ? "lg:max-w-content" : "lg:max-w-column-wide"), panel && "lg:mx-0");
  return (
    // data-grouped: the same ground and scrollbar gutter as the shell, so nothing shifts when it appears.
    // data-console="frame": black and grey from the first paint, as the shell (ADR 0062).
    <div data-grouped data-console="frame" className="flex min-h-dvh bg-canvas-muted" role="status">
      <span className="sr-only">{t("loading")}</span>

      <div aria-hidden className="sticky top-0 hidden h-dvh shrink-0 lg:flex">
        {/* The rail: the symbol, Add, the places, Settings at the bottom, then the eye and the toggle. */}
        <div className="flex w-nav-rail shrink-0 flex-col items-center border-e border-line bg-surface pb-3">
          <div className="grid h-16 shrink-0 place-items-center text-fg">
            <LogoSymbol className="size-8" tone="mono" />
          </div>
          <Skeleton className="size-touch-target shrink-0 rounded-full" />
          <div className="mt-3 flex min-h-0 w-full flex-1 flex-col items-center overflow-hidden py-1">
            <div className="grid gap-1">
              {SPLASH_NAV.map((item) => (
                <span key={item.key} className={railSlot}>
                  <Icon icon={item.icon} size="md" />
                </span>
              ))}
            </div>
            <div className="mt-auto grid gap-1 pt-3">
              <span className={railSlot}>
                <Icon icon={Settings} size="md" />
              </span>
            </div>
          </div>
          <div className="grid gap-1 pt-1">
            <span className={railSlot}>
              <Icon icon={Eye} size="md" />
            </span>
            {panel ? (
              <span className={railSlot}>
                <Icon icon={PanelLeftClose} size="md" className="nav-folded:hidden" />
                <Icon icon={PanelLeftOpen} size="md" className="hidden nav-folded:block" />
              </span>
            ) : null}
          </div>
        </div>
        {/* The section panel, where the place has one: its title and three rows. */}
        {panel ? (
          <div data-splash-panel className="flex w-nav-panel shrink-0 flex-col border-e border-line bg-surface nav-folded:hidden">
            <div className="flex h-16 shrink-0 items-center px-5">
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="grid gap-0.5 px-2 py-1">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex h-control-md items-center px-3">
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>
        ) : null}
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
          <div className={cn(column, "flex lg:h-full lg:items-center")}>
            <Skeleton data-splash-title className="h-8 w-1/2 lg:h-6 lg:w-32" />
          </div>
        </div>
        <div className={cn(gutters, "pt-4 lg:pt-2")}>
          <div className={cn(column, "grid grid-cols-1 gap-6")}>
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
  // Building with AI is part of the welcome (its draft comes back to the welcome's "you" step).
  const needsWelcome = snapshot.status === "signedIn" && !snapshot.site.onboarded && pathname !== "/app/welcome" && pathname !== "/app/build";

  useEffect(() => {
    if (snapshot.status === "signedOut") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (needsWelcome) router.replace("/app/welcome");
  }, [snapshot.status, needsWelcome, pathname, router]);

  if (snapshot.status !== "signedIn" || needsWelcome) return <AppSplash />;
  // Keyed by account: a different login starts from that account's page, never from stale state.
  return <SiteProvider key={snapshot.account.id}>{children}</SiteProvider>;
}
