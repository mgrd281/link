"use client";

import { hasImage } from "@linkyo/blocks";
import { tokens } from "@linkyo/tokens";
import { Avatar, Badge, cn, Icon, Logo, Spinner } from "@linkyo/ui";
import { ChartNoAxesColumn, Check, CircleAlert, ExternalLink, FlaskConical, House, LayoutList, LogOut, Palette, Plus, Settings, ShieldCheck, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { DropdownMenu } from "radix-ui";
import type { ReactNode } from "react";

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

/** "Saved" / "Saving…" / "Not saved" — always visible, announced politely. */
export function SaveStatus({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("app.save");
  const { save } = useSite();
  const state = save === "saved" ? "saved" : save === "saving" ? "saving" : "error";
  return (
    <p role="status" className={cn("inline-flex items-center gap-2 text-small", state === "error" ? "text-danger-strong" : "text-fg-secondary")}>
      {state === "saving" ? <Spinner className="size-icon-sm" /> : <Icon icon={state === "saved" ? Check : CircleAlert} size="sm" className={state === "saved" ? "text-success-strong" : undefined} />}
      <span className={cn(compact && "sr-only")}>{t(state)}</span>
    </p>
  );
}

function AccountMenu({ trigger }: { trigger: ReactNode }) {
  const t = useTranslations("app");
  const { account } = useSite();
  // Linkyo team members also see the way into the team area.
  const onTeam = useOnTeam(account.email);
  const item = "flex h-control-md cursor-default items-center gap-3 rounded-sm px-3 text-small outline-none data-highlighted:bg-hover";
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={tokens.spacing["2"]}
          collisionPadding={tokens.spacing["2"]}
          className="layer-popover grid min-w-menu gap-0.5 rounded-md border border-line bg-surface-elevated p-1 text-fg shadow-e2 motion-safe:animate-pop-in"
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
              <Icon icon={ExternalLink} size="sm" />
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
 * The dashboard frame. Wide screens: a calm sidebar (profile, Add, five places, account). Phones:
 * a top bar with the save state and a bottom tab bar with Add in the middle, all within thumb reach.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("app");
  const pathname = usePathname();
  const { doc, account, setAddOpen } = useSite();

  return (
    <div className="flex min-h-dvh bg-canvas text-fg">
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
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex h-control-lg items-center justify-center gap-2 rounded-md bg-primary px-4 text-body font-semibold text-primary-fg shadow-e1 transition-colors duration-micro hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed"
        >
          <Icon icon={Plus} size="md" />
          {t("nav.add")}
        </button>
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
            <Icon icon={ExternalLink} size="sm" />
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
        <header className="layer-sticky sticky top-0 flex h-16 items-center gap-2 border-b border-line bg-canvas ps-4 pe-2 lg:hidden">
          <Link href="/app" className="flex min-w-0 flex-1 items-center gap-3 rounded-sm focus-visible:focus-ring">
            <ProfileAvatar size="sm" />
            <span className="grid min-w-0">
              <span className="truncate text-small font-semibold">{doc.profile.displayName}</span>
              <span dir="ltr" className="truncate text-start text-caption text-fg-tertiary">
                linkyo.app/{account.username}
              </span>
            </span>
          </Link>
          <SaveStatus compact />
          <Link
            href="/app/preview"
            aria-label={t("viewPage")}
            className="grid size-touch-target place-items-center rounded-md text-fg hover:bg-hover focus-visible:focus-ring"
          >
            <Icon icon={ExternalLink} size="md" />
          </Link>
          <AccountMenu
            trigger={
              <button type="button" aria-label={t("accountMenu")} className="grid size-touch-target place-items-center rounded-md hover:bg-hover focus-visible:focus-ring">
                <Icon icon={Settings} size="md" />
              </button>
            }
          />
        </header>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-24 outline-none lg:pb-0">
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
          <li className="grid place-items-center">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              aria-label={t("nav.add")}
              className="grid size-control-xl -translate-y-3 place-items-center rounded-full bg-primary text-primary-fg shadow-e3 transition-colors duration-micro hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed"
            >
              <Icon icon={Plus} size="lg" />
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
        className="grid content-center justify-items-center gap-1 text-caption font-medium text-fg-secondary transition-colors duration-micro focus-visible:focus-ring aria-[current=page]:text-link"
      >
        <span className={cn("grid h-control-sm w-12 place-items-center rounded-full transition-colors duration-micro", active && "bg-selected")}>
          <Icon icon={item.icon} size="md" />
        </span>
        {label}
      </Link>
    </li>
  );
}
