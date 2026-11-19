"use client";

import { tokens } from "@linkyo/tokens";
import { Avatar, Badge, cn, Icon, Logo } from "@linkyo/ui";
import {
  ArrowLeftRight,
  ChartColumn,
  CreditCard,
  Ellipsis,
  Eye,
  History,
  LayoutDashboard,
  LayoutList,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { DropdownMenu } from "radix-ui";
import { useId, type ReactNode } from "react";

import { accountStore } from "@/features/account/store";
import { Link, usePathname } from "@/i18n/navigation";

import { useAdmin } from "./session";
import { ROLES, type Permission, type Role } from "./types";

interface NavItem {
  key: "overview" | "customers" | "subscriptions" | "security" | "analytics" | "creators" | "team" | "activity";
  href: string;
  icon: LucideIcon;
  /** Shown only to roles with this permission. */
  permission?: Permission;
}

/** Two groups: the business (customers and money) and the team's own work (prepared pages). */
const GROUPS: { key: "business" | "teamWork"; items: NavItem[] }[] = [
  {
    key: "business",
    items: [
      { key: "overview", href: "/admin", icon: LayoutDashboard },
      { key: "customers", href: "/admin/customers", icon: UsersRound, permission: "customers.view" },
      { key: "subscriptions", href: "/admin/subscriptions", icon: CreditCard, permission: "billing.view" },
      { key: "security", href: "/admin/security", icon: ShieldAlert, permission: "security.view" },
      { key: "analytics", href: "/admin/analytics", icon: ChartColumn, permission: "analytics.view" },
    ],
  },
  {
    key: "teamWork",
    items: [
      { key: "creators", href: "/admin/creators", icon: Sparkles },
      { key: "team", href: "/admin/team", icon: ShieldCheck },
      { key: "activity", href: "/admin/activity", icon: History },
    ],
  },
];
/** The phone's tab bar keeps the three most used; the rest sit under "More". */
const PHONE_TABS: NavItem["key"][] = ["overview", "customers", "creators"];

const isActive = (pathname: string, href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));

export function RoleBadge({ role, size = "sm" }: { role: Role; size?: "sm" | "md" }) {
  const t = useTranslations("admin.roles");
  return (
    <Badge size={size} tone={role === "owner" ? "primary" : role === "admin" ? "success" : role === "editor" ? "warning" : "neutral"}>
      {t(`${role}.name`)}
    </Badge>
  );
}

/** Owners can look at every screen with another role's permissions (to check what a teammate sees). */
function ViewAs() {
  const t = useTranslations("admin.shell");
  const tRoles = useTranslations("admin.roles");
  const { me, viewAs, setViewAs } = useAdmin();
  const id = useId();
  if (me.role !== "owner") return null;
  return (
    <div className="grid grid-cols-1 gap-1">
      <label htmlFor={id} className="flex items-center gap-2 px-1 text-caption font-medium text-fg-secondary">
        <Icon icon={Eye} size="sm" />
        {t("viewAs")}
      </label>
      <select
        id={id}
        value={viewAs ?? "owner"}
        onChange={(event) => setViewAs(event.target.value === "owner" ? null : (event.target.value as Role))}
        className="h-control-sm rounded-sm border border-line-input bg-surface-elevated px-2 text-small text-fg outline-none hover:border-fg-tertiary focus-visible:border-focus focus-visible:focus-ring"
      >
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {tRoles(`${role}.name`)}
          </option>
        ))}
      </select>
    </div>
  );
}

function AccountMenu({ trigger }: { trigger: ReactNode }) {
  const t = useTranslations("admin.shell");
  const { me } = useAdmin();
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
            <span className="text-small font-semibold">{me.name}</span>
            <span dir="ltr" className="truncate text-start text-caption text-fg-secondary">
              {me.email}
            </span>
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="my-1 border-t border-line" />
          <DropdownMenu.Item asChild className={item}>
            <Link href="/app">
              <Icon icon={LayoutList} size="sm" />
              {t("toApp")}
            </Link>
          </DropdownMenu.Item>
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

/** While an owner previews another role, a calm strip says so and offers the way back. */
function ViewAsBanner() {
  const t = useTranslations("admin.shell");
  const tRoles = useTranslations("admin.roles");
  const { viewAs, setViewAs } = useAdmin();
  if (!viewAs) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-line bg-warning-subtle px-4 py-2 text-small text-warning-strong">
      <span className="inline-flex items-center gap-2">
        <Icon icon={Eye} size="sm" />
        {t("viewingAs", { role: tRoles(`${viewAs}.name`) })}
      </span>
      <button type="button" onClick={() => setViewAs(null)} className="rounded-xs font-semibold underline underline-offset-4 focus-visible:focus-ring">
        {t("viewAsEnd")}
      </button>
    </div>
  );
}

/**
 * The team area frame, deliberately close to the creator dashboard (same places, same gestures) but
 * marked "Team" so nobody confuses the two. Phones get the same bottom tab bar.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations("admin.shell");
  const tNav = useTranslations("admin.nav");
  const pathname = usePathname();
  const { me, role, can } = useAdmin();
  const groups = GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => !item.permission || can(item.permission)) })).filter((group) => group.items.length > 0);
  const all = groups.flatMap((group) => group.items);
  const tabs = all.filter((item) => PHONE_TABS.includes(item.key));
  const more = all.filter((item) => !PHONE_TABS.includes(item.key));
  const moreActive = more.some((item) => isActive(pathname, item.href));

  return (
    <div className="flex min-h-dvh bg-canvas text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:layer-toast focus:rounded-sm focus:bg-surface-elevated focus:px-3 focus:py-2 focus:focus-ring"
      >
        {t("skip")}
      </a>

      <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col gap-6 border-e border-line bg-canvas-muted p-4 lg:flex">
        <Link href="/admin" className="flex items-center gap-2 justify-self-start rounded-xs px-1 pt-1 focus-visible:focus-ring">
          <Logo className="h-6" title="Linkyo" />
          <Badge size="sm" tone="primary">
            {t("team")}
          </Badge>
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={me.name} />
          <span className="grid min-w-0 justify-items-start gap-1">
            <span className="max-w-full truncate text-small font-semibold">{me.name}</span>
            <RoleBadge role={role} />
          </span>
        </div>
        <nav aria-label={tNav("label")} className="grid grid-cols-1 gap-4">
          {groups.map((group) => (
            <div key={group.key} className="grid grid-cols-1 gap-0.5">
              <p className="px-3 pb-1 text-caption font-semibold tracking-wide text-fg-tertiary uppercase">{tNav(`groups.${group.key}`)}</p>
              {group.items.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className="flex h-control-md items-center gap-3 rounded-sm px-3 text-small font-medium text-fg-secondary transition-colors duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring aria-[current=page]:bg-selected aria-[current=page]:text-fg"
                >
                  <Icon icon={item.icon} size="sm" />
                  {tNav(item.key)}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="mt-auto grid gap-4">
          <ViewAs />
          <Link href="/app" className="inline-flex h-control-md items-center gap-2 rounded-sm px-3 text-small font-medium text-link hover:bg-hover focus-visible:focus-ring">
            <Icon icon={ArrowLeftRight} size="sm" />
            {t("toApp")}
          </Link>
          <AccountMenu
            trigger={
              <button type="button" className="flex min-w-0 items-center gap-3 rounded-md border border-line bg-surface p-2 text-start hover:bg-surface-elevated focus-visible:focus-ring">
                <Avatar name={me.name} size="sm" />
                <span className="grid min-w-0 flex-1">
                  <span className="truncate text-small font-medium">{t("account")}</span>
                  <span dir="ltr" className="truncate text-start text-caption text-fg-tertiary">
                    {me.email}
                  </span>
                </span>
              </button>
            }
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="layer-sticky sticky top-0 flex h-16 items-center gap-2 border-b border-line bg-canvas ps-4 pe-2 lg:hidden">
          <Link href="/admin" className="flex min-w-0 flex-1 items-center gap-2 rounded-sm focus-visible:focus-ring">
            <Logo className="h-6" title="Linkyo" />
            <Badge size="sm" tone="primary">
              {t("team")}
            </Badge>
          </Link>
          <RoleBadge role={role} />
          <AccountMenu
            trigger={
              <button type="button" aria-label={t("accountMenu")} className="grid size-touch-target place-items-center rounded-md hover:bg-hover focus-visible:focus-ring">
                <Avatar name={me.name} size="sm" />
              </button>
            }
          />
        </header>
        <ViewAsBanner />
        {me.role === "owner" && pathname === "/admin" ? (
          <div className="border-b border-line px-4 py-2 lg:hidden">
            <ViewAs />
          </div>
        ) : null}
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-24 outline-none lg:pb-0">
          {children}
        </main>
      </div>

      <nav aria-label={tNav("label")} className="layer-sticky fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="mx-auto grid h-16 max-w-prose grid-cols-4">
          {tabs.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.key} className="grid">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="grid content-center justify-items-center gap-1 text-caption font-medium text-fg-secondary transition-colors duration-micro focus-visible:focus-ring aria-[current=page]:text-link"
                >
                  <span className={cn("grid h-control-sm w-12 place-items-center rounded-full transition-colors duration-micro", active && "bg-selected")}>
                    <Icon icon={item.icon} size="md" />
                  </span>
                  {tNav(item.key)}
                </Link>
              </li>
            );
          })}
          <li className="grid">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-current={moreActive ? "page" : undefined}
                  className="grid content-center justify-items-center gap-1 text-caption font-medium text-fg-secondary transition-colors duration-micro focus-visible:focus-ring aria-[current=page]:text-link"
                >
                  <span className={cn("grid h-control-sm w-12 place-items-center rounded-full transition-colors duration-micro", moreActive && "bg-selected")}>
                    <Icon icon={Ellipsis} size="md" />
                  </span>
                  {tNav("more")}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  side="top"
                  align="end"
                  sideOffset={tokens.spacing["2"]}
                  collisionPadding={tokens.spacing["2"]}
                  className="layer-popover grid min-w-menu gap-0.5 rounded-md border border-line bg-surface-elevated p-1 text-fg shadow-e2 motion-safe:animate-pop-in"
                >
                  {more.map((item) => (
                    <DropdownMenu.Item key={item.key} asChild className="flex h-control-md cursor-default items-center gap-3 rounded-sm px-3 text-small outline-none data-highlighted:bg-hover aria-[current=page]:bg-selected">
                      <Link href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
                        <Icon icon={item.icon} size="sm" />
                        {tNav(item.key)}
                      </Link>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </li>
        </ul>
      </nav>
    </div>
  );
}
