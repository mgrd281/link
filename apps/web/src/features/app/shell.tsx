"use client";

import { hasImage } from "@linkyo/blocks";
import { tokens } from "@linkyo/tokens";
import { Avatar, Badge, Button, cn, Icon, Logo, Spinner } from "@linkyo/ui";
import { ChartNoAxesColumn, Check, CircleAlert, Eye, FlaskConical, House, LayoutList, LogOut, Palette, Plus, Settings, ShieldCheck, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { DropdownMenu } from "radix-ui";
import { useEffect, useState, type ReactNode } from "react";

import { haptic } from "@/lib/haptics";
import { accountStore } from "@/features/account/store";
import { useOnTeam } from "@/features/admin/live";
import { Link, usePathname } from "@/i18n/navigation";

import { AddSheet } from "./add-sheet";
import { EditSheet } from "./edit-sheet";
import { useSite } from "./site-context";

interface NavItem {
  key: "home" | "page" | "design" | "analytics" | "settings";
  href: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { key: "home", href: "/app", icon: House },
  { key: "page", href: "/app/editor", icon: LayoutList },
  { key: "design", href: "/app/design", icon: Palette },
  { key: "analytics", href: "/app/analytics", icon: ChartNoAxesColumn },
  { key: "settings", href: "/app/settings", icon: Settings },
];

const isActive = (pathname: string, href: string) => (href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`));

export function ProfileAvatar({ size = "md", className }: { size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const { doc } = useSite();
  const avatar = doc.profile.avatar;
  return <Avatar name={doc.profile.displayName} src={hasImage(avatar) ? avatar.src : undefined} size={size} className={className} />;
}

/**
 * "Saved" / "Saving…" / "Not saved", announced politely. The full form (sidebar) is always visible.
 * The compact form (phone top bar) shows only a spinner while saving and an alert icon on an error:
 * a lone green tick beside the avatar read as a "verified" badge, so "Saved" is for screen readers
 * only there. The status element stays mounted in every state, so each change is announced.
 */
export function SaveStatus({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("app.save");
  const { save } = useSite();
  const state = save === "saved" ? "saved" : save === "saving" ? "saving" : "error";
  const quiet = compact && state === "saved";
  return (
    <p
      role="status"
      className={cn(
        "text-small",
        state === "error" ? "text-danger-strong" : "text-fg-secondary",
        // In the top bar the icon sits in a 44 px slot, so it lines up with the buttons beside it.
        !compact ? "inline-flex items-center gap-2" : quiet ? "sr-only" : "grid size-touch-target place-items-center",
      )}
    >
      {quiet ? null : state === "saving" ? (
        <Spinner className="size-icon-sm" />
      ) : (
        <Icon icon={state === "saved" ? Check : CircleAlert} size={compact ? "md" : "sm"} className={state === "saved" ? "text-success-strong" : undefined} />
      )}
      <span className={cn(compact && "sr-only")}>{t(state)}</span>
    </p>
  );
}

function AccountMenu({ trigger, align = "end" }: { trigger: ReactNode; align?: "start" | "end" }) {
  const t = useTranslations("app");
  const { account } = useSite();
  // Linkyo team members also see the way into the team area.
  const onTeam = useOnTeam(account.email);
  // Rows grow to a 48 px touch target on touch screens, like the shared Menu: on a phone this menu now
  // opens from the avatar in the top bar.
  const item = "flex h-control-md pointer-coarse:h-control-lg cursor-default items-center gap-3 rounded-sm px-3 text-small pointer-coarse:text-body outline-none data-highlighted:bg-hover";
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={tokens.spacing["2"]}
          collisionPadding={tokens.spacing["2"]}
          className="layer-popover grid min-w-menu gap-0.5 rounded-md border border-line bg-surface-elevated p-1 text-fg motion-safe:animate-pop-in"
        >
          <DropdownMenu.Label className="grid grid-cols-1 gap-0.5 px-3 py-2">
            <span className="text-small font-semibold">@{account.username}</span>
            <span dir="ltr" className="truncate text-start text-caption text-fg-secondary">
              {account.email}
            </span>
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="my-1 border-t border-line" />
          <DropdownMenu.Item asChild className={item}>
            <Link href="/app/settings">
              <Icon icon={Settings} size="sm" />
              {t("nav.settings")}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={item}>
            <Link href="/app/preview">
              <Icon icon={Eye} size="sm" />
              {t("viewPage")}
            </Link>
          </DropdownMenu.Item>
          {onTeam ? (
            <DropdownMenu.Item asChild className={item}>
              <Link href="/admin">
                <Icon icon={ShieldCheck} size="sm" />
                {t("teamArea")}
              </Link>
            </DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Separator className="my-1 border-t border-line" />
          <DropdownMenu.Item className={item} onSelect={() => accountStore.logOut()}>
            <Icon icon={LogOut} size="sm" />
            {t("logout")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * Whether the screen's large title (the `h1` in `#main`) has scrolled up under the phone top bar.
 * The bar then shows the screen's name, as an iOS navigation bar does. A new observer is made for
 * each route, because each screen renders its own heading.
 */
function useTitleScrolledAway(pathname: string) {
  const [away, setAway] = useState(false);
  useEffect(() => {
    const heading = document.querySelector("#main h1");
    if (!heading) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Only "above the bar" counts: a heading below the fold is not intersecting either.
        if (entry) setAway(!entry.isIntersecting && entry.boundingClientRect.top < tokens.spacing["16"]);
      },
      // The top bar is h-16: the heading counts as gone once it is fully under the bar.
      { rootMargin: `-${tokens.spacing["16"]}px 0% 0% 0%` },
    );
    observer.observe(heading);
    return () => observer.disconnect();
  }, [pathname]);
  return away;
}

/**
 * The dashboard frame. Wide screens: a calm sidebar (profile, Add, five places, account). Phones:
 * an iOS-style top bar (account, the screen's name once its title scrolls away, save state, page,
 * Settings) and a bottom tab bar with a labelled Add in the middle, all within thumb reach.
 *
 * `data-grouped` and `group/app` mark the grouped look on phones: a tinted canvas with borderless
 * white groups, as in iOS Settings. Screens opt in with `max-lg:group-data-[grouped]/app:` classes;
 * the admin shell has no such marker, so the admin screens that share `Panel` keep their outlines.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("app");
  const pathname = usePathname();
  const { doc, account, setAddOpen } = useSite();
  const titleAway = useTitleScrolledAway(pathname);
  const activeKey = NAV.find((item) => isActive(pathname, item.href))?.key ?? "home";

  return (
    <div data-grouped className="group/app flex min-h-dvh bg-canvas text-fg max-lg:bg-canvas-muted">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:layer-toast focus:rounded-sm focus:bg-surface-elevated focus:px-3 focus:py-2 focus:focus-ring"
      >
        {t("skip")}
      </a>

      <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col gap-6 border-e border-line bg-canvas-muted p-4 lg:flex">
        <Link href="/app" className="justify-self-start rounded-xs px-1 pt-1 focus-visible:focus-ring" aria-label={t("nav.home")}>
          <Logo className="h-6" title="Linkyo" />
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <ProfileAvatar />
          <span className="grid min-w-0">
            <span className="truncate text-small font-semibold">{doc.profile.displayName}</span>
            <span dir="ltr" className="truncate text-start text-caption text-fg-tertiary">
              linkyo.app/{account.username}
            </span>
          </span>
        </div>
        <Button variant="primary" size="lg" block icon={Plus} onClick={() => setAddOpen(true)}>
          {t("nav.add")}
        </Button>
        <nav aria-label={t("nav.label")} className="grid grid-cols-1 gap-0.5">
          {NAV.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className="flex h-control-md items-center gap-3 rounded-sm px-3 text-small font-medium text-fg-secondary transition-colors duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring aria-[current=page]:bg-selected aria-[current=page]:text-fg"
            >
              <Icon icon={item.icon} size="sm" />
              {t(`nav.${item.key}`)}
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid gap-3">
          <Link
            href="/app/preview"
            className="inline-flex h-control-md items-center gap-2 rounded-sm px-3 text-small font-medium text-link hover:bg-hover focus-visible:focus-ring"
          >
            <Icon icon={Eye} size="sm" />
            {t("viewPage")}
          </Link>
          <div className="flex items-center justify-between gap-2 px-3">
            <SaveStatus />
            {accountStore.demo ? (
              <Badge size="sm" tone="primary">
                <Icon icon={FlaskConical} size="sm" />
                {t("demo")}
              </Badge>
            ) : null}
          </div>
          <AccountMenu
            trigger={
              <button
                type="button"
                className="flex min-w-0 items-center gap-3 rounded-md border border-line bg-surface p-2 text-start hover:bg-surface-elevated focus-visible:focus-ring"
              >
                <ProfileAvatar size="sm" />
                <span className="grid min-w-0 flex-1">
                  <span className="truncate text-small font-medium">{t("account")}</span>
                  <span dir="ltr" className="truncate text-start text-caption text-fg-tertiary">
                    {account.email}
                  </span>
                </span>
              </button>
            }
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phones: one row like an iOS navigation bar. The avatar opens the account menu (which keeps
            the team area and logout), the gear goes straight to Settings, and the eye opens the page
            inside the app. The side columns share the width equally, so the name stays centred. */}
        <header className="layer-sticky sticky top-0 grid h-16 grid-cols-[1fr_auto_1fr] items-center border-b border-line bg-canvas-muted px-2 lg:hidden">
          <AccountMenu
            align="start"
            trigger={
              <button
                type="button"
                aria-label={t("accountMenu")}
                className="relative grid size-touch-target place-items-center justify-self-start rounded-full transition-colors duration-micro hover:bg-hover active:bg-pressed focus-visible:focus-ring"
              >
                {/* The initials are a picture of the account, not its name (WCAG 2.5.3). */}
                <span aria-hidden className="contents">
                  <ProfileAvatar size="sm" />
                </span>
              </button>
            }
          />
          {/* The h1 already names the screen for screen readers; this copy is only for the eyes. */}
          <p aria-hidden className={cn("truncate text-body font-semibold transition-opacity duration-micro", titleAway ? "opacity-100" : "opacity-0")}>
            {t(`nav.${activeKey}`)}
          </p>
          <div className="flex items-center justify-self-end">
            <SaveStatus compact />
            <Link
              href="/app/preview"
              aria-label={t("viewPage")}
              className="grid size-touch-target place-items-center rounded-md transition-colors duration-micro hover:bg-hover active:bg-pressed focus-visible:focus-ring"
            >
              <Icon icon={Eye} size="md" />
            </Link>
            <Link
              href="/app/settings"
              aria-label={t("nav.settings")}
              aria-current={isActive(pathname, "/app/settings") ? "page" : undefined}
              className="grid size-touch-target place-items-center rounded-md transition-colors duration-micro hover:bg-hover active:bg-pressed focus-visible:focus-ring aria-[current=page]:text-link"
            >
              <Icon icon={Settings} size="md" />
            </Link>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-[calc(var(--spacing-24)+env(safe-area-inset-bottom))] outline-none lg:pb-0">
          {children}
        </main>
      </div>

      <nav
        data-tabbar
        aria-label={t("nav.label")}
        className="layer-sticky fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-prose grid-cols-5">
          {NAV.slice(0, 2).map((item) => (
            <TabLink key={item.key} item={item} active={isActive(pathname, item.href)} label={t(`nav.${item.key}`)} />
          ))}
          {/* Add is a tab like the others: flat in the bar and labelled, so its meaning is plain. The
              teal pill marks it as the main action without lifting it out of the bar. */}
          <li className="grid">
            <button
              type="button"
              onClick={() => {
                haptic();
                setAddOpen(true);
              }}
              className="group grid content-center justify-items-center gap-1 text-caption font-medium text-link focus-visible:focus-ring"
            >
              <span className="grid h-control-sm w-12 place-items-center rounded-full bg-primary text-primary-fg transition-[background-color,scale] duration-micro ease-spring group-hover:bg-primary-hover group-active:scale-pressed motion-reduce:group-active:scale-none">
                <Icon icon={Plus} size="md" />
              </span>
              {t("nav.add")}
            </button>
          </li>
          {NAV.slice(2, 4).map((item) => (
            <TabLink key={item.key} item={item} active={isActive(pathname, item.href)} label={t(`nav.${item.key}`)} />
          ))}
        </ul>
      </nav>

      <AddSheet />
      <EditSheet />
    </div>
  );
}

function TabLink({ item, active, label }: { item: NavItem; active: boolean; label: string }) {
  return (
    <li className="grid">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        onClick={() => {
          if (!active) haptic();
        }}
        className="group grid content-center justify-items-center gap-1 text-caption font-medium text-fg-secondary transition-colors duration-micro focus-visible:focus-ring aria-[current=page]:font-semibold aria-[current=page]:text-link"
      >
        {/* As on iOS, the active tab is marked by the tint alone (no pill behind it); a press dips the
            icon like a native tab. */}
        <span className="grid h-control-sm w-12 place-items-center transition-[scale] duration-spring ease-spring group-active:scale-pressed motion-reduce:group-active:scale-none">
          <Icon icon={item.icon} size="lg" />
        </span>
        {label}
      </Link>
    </li>
  );
}
