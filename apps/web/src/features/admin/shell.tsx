"use client";

import { tokens } from "@linkyo/tokens";
import { Avatar, Badge, cn, Icon, icons, Logo } from "@linkyo/ui";
import { ArrowLeftRight, Check, Eye, LayoutDashboard, LayoutList, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { DropdownMenu } from "radix-ui";
import { useId, type ReactNode } from "react";

import { accountStore } from "@/features/account/store";
import { Link, usePathname } from "@/i18n/navigation";
import { paymentsEnabled } from "@/lib/flags";

import { countOf, QueuesProvider, useQueues, waitingContract } from "./queues";
import { useAdmin } from "./session";
import { ROLES, type Permission, type Role } from "./types";

interface NavItem {
  key: "overview" | "customers" | "orders" | "subscriptions" | "security" | "analytics" | "creators" | "templates" | "referrals" | "team" | "activity";
  href: string;
  icon: LucideIcon;
  /** Shown only to roles with this permission. */
  permission?: Permission;
}

/**
 * Two groups: the business (customers and money) and the team's own work (prepared pages). Every
 * glyph is the registry's meaning (A-20): customers a contact card, creators a person in a square, the
 * team a group of people, referrals the invite program's gift, as in the dashboard.
 */
const GROUPS: { key: "business" | "teamWork"; items: NavItem[] }[] = [
  {
    key: "business",
    items: [
      { key: "overview", href: "/admin", icon: LayoutDashboard },
      { key: "customers", href: "/admin/customers", icon: icons.customers, permission: "customers.view" },
      // Page-service orders exist only where contracts can be made (NEXT_PUBLIC_PAYMENTS).
      ...(paymentsEnabled ? [{ key: "orders" as const, href: "/admin/orders", icon: icons.orders, permission: "orders.view" as const }] : []),
      { key: "subscriptions", href: "/admin/subscriptions", icon: icons.billing, permission: "billing.view" },
      { key: "security", href: "/admin/security", icon: icons.security, permission: "security.view" },
      { key: "analytics", href: "/admin/analytics", icon: icons.analytics, permission: "analytics.view" },
    ],
  },
  {
    key: "teamWork",
    items: [
      { key: "creators", href: "/admin/creators", icon: icons.creators },
      { key: "templates", href: "/admin/templates", icon: icons.templates },
      // The invite program: verification requests and held invites (ADR 0064).
      { key: "referrals", href: "/admin/referrals", icon: icons.invite, permission: "orders.view" },
      { key: "team", href: "/admin/team", icon: icons.team },
      { key: "activity", href: "/admin/activity", icon: icons.activity },
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

/** How many things wait behind a navigation item: open orders, decisions on withdrawals, requests to check. */
interface Waiting {
  /** The number on the badge. */
  count: number;
  /** A withdrawal or cancellation waits (a statutory deadline): the badge is set apart, and says so in words. */
  urgent: boolean;
  /** The words for the number ("3 offene Aufträge"), read as the item's description. */
  label: string;
}

/** The count badges of the navigation (A-17), from the queues the shell reads once. */
function useWaiting(): Partial<Record<NavItem["key"], Waiting>> {
  const t = useTranslations("admin.nav.waiting");
  const queues = useQueues();
  const orders = countOf(queues.orders, (list) => list.length) ?? 0;
  const contracts = countOf(queues.contracts, (list) => list.filter(waitingContract).length) ?? 0;
  const referrals = countOf(queues.referrals, (data) => data.verifications + data.held) ?? 0;
  const waiting: Partial<Record<NavItem["key"], Waiting>> = {};
  if (orders + contracts > 0) {
    waiting.orders = {
      count: orders + contracts,
      urgent: contracts > 0,
      label: contracts > 0 ? t("ordersAndContracts", { orders, contracts }) : t("orders", { count: orders }),
    };
  }
  if (referrals > 0) waiting.referrals = { count: referrals, urgent: false, label: t("referrals", { count: referrals }) };
  return waiting;
}

/**
 * The count after a navigation item. The number is for the eye; its words are the link's description
 * (`aria-describedby`), so the item's name stays its visible label (WCAG 2.5.3).
 */
function WaitingBadge({ waiting, id, className }: { waiting: Waiting | undefined; id: string; className?: string }) {
  if (!waiting) return null;
  return (
    <>
      <span
        aria-hidden
        data-waiting={waiting.count}
        className={cn(
          "grid h-5 min-w-5 place-items-center rounded-full px-1 text-caption font-semibold tabular-nums",
          waiting.urgent ? "bg-danger-subtle text-danger-strong" : "bg-selected text-selected-fg",
          className,
        )}
      >
        {waiting.count}
      </span>
      <span id={id} hidden>
        {waiting.label}
      </span>
    </>
  );
}

/**
 * "View as" for owners, inside the account menu (A-11: not on top of the overview): every screen with
 * another role's permissions, to check what a teammate sees. The chosen role carries a check and a
 * semibold label, never colour alone.
 */
function ViewAsItems() {
  const t = useTranslations("admin.shell");
  const tRoles = useTranslations("admin.roles");
  const { me, viewAs, setViewAs } = useAdmin();
  if (me.role !== "owner") return null;
  return (
    <>
      <DropdownMenu.Separator className="my-1 border-t border-line" />
      <DropdownMenu.Label className="flex items-center gap-2 px-3 py-1 text-caption font-semibold text-fg-secondary">
        <Icon icon={Eye} size="sm" />
        {t("viewAs")}
      </DropdownMenu.Label>
      <DropdownMenu.RadioGroup value={viewAs ?? "owner"} onValueChange={(value) => setViewAs(value === "owner" ? null : (value as Role))}>
        {ROLES.map((role) => (
          <DropdownMenu.RadioItem
            key={role}
            value={role}
            className="flex h-control-md cursor-default items-center gap-3 rounded-sm px-3 text-small outline-none data-highlighted:bg-hover data-[state=checked]:font-semibold"
          >
            <span className="grid size-icon-sm shrink-0 place-items-center">
              <DropdownMenu.ItemIndicator>
                <Icon icon={Check} size="sm" strong />
              </DropdownMenu.ItemIndicator>
            </span>
            {tRoles(`${role}.name`)}
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
    </>
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
          className="layer-popover grid min-w-menu gap-0.5 rounded-md border border-line bg-surface-elevated p-1 text-fg motion-safe:animate-pop-in"
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
          <ViewAsItems />
          <DropdownMenu.Separator className="my-1 border-t border-line" />
          <DropdownMenu.Item className={item} onSelect={() => accountStore.logOut()}>
            <Icon icon={icons.signOut} size="sm" />
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
      <button type="button" onClick={() => setViewAs(null)} className="min-h-touch-target rounded-xs font-semibold transition-opacity duration-micro hover:opacity-secondary focus-visible:focus-ring">
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
  return (
    <QueuesProvider>
      <Frame>{children}</Frame>
    </QueuesProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const t = useTranslations("admin.shell");
  const tNav = useTranslations("admin.nav");
  const pathname = usePathname();
  const { me, role, can } = useAdmin();
  const waiting = useWaiting();
  const ids = useId();
  const groups = GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => !item.permission || can(item.permission)) })).filter((group) => group.items.length > 0);
  const all = groups.flatMap((group) => group.items);
  const tabs = all.filter((item) => PHONE_TABS.includes(item.key));
  const more = all.filter((item) => !PHONE_TABS.includes(item.key));
  const moreActive = more.some((item) => isActive(pathname, item.href));
  const moreWaiting = more.reduce((sum, item) => sum + (waiting[item.key]?.count ?? 0), 0);
  const moreUrgent = more.some((item) => waiting[item.key]?.urgent);
  const describe = (key: NavItem["key"], place: string) => (waiting[key] ? `${ids}-${place}-${key}` : undefined);

  return (
    <div className="flex min-h-dvh bg-canvas text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:layer-toast focus:rounded-sm focus:bg-surface-elevated focus:px-3 focus:py-2 focus:focus-ring"
      >
        {t("skip")}
      </a>

      <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col gap-6 overflow-y-auto border-e border-line bg-canvas-muted p-4 lg:flex">
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
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-describedby={describe(item.key, "side")}
                    // Chosen: the fill, a strong stroke and a semibold label (S-05), as in the dashboard.
                    className="flex h-control-md items-center gap-3 rounded-sm px-3 text-small font-medium text-fg-secondary transition-colors duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring aria-[current=page]:bg-selected aria-[current=page]:font-semibold aria-[current=page]:text-fg"
                  >
                    <Icon icon={item.icon} size="sm" strong={active} />
                    <span className="min-w-0 flex-1 truncate">{tNav(item.key)}</span>
                    <WaitingBadge waiting={waiting[item.key]} id={`${ids}-side-${item.key}`} />
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto grid gap-4">
          <Link href="/app" className="inline-flex h-control-md items-center gap-2 rounded-sm px-3 text-small font-semibold text-link transition-colors duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring">
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
              // The name comes from hidden text, not aria-label: the avatar's initials are visible
              // content an aria-label would not contain (WCAG 2.5.3).
              <button type="button" className="grid size-touch-target place-items-center rounded-md hover:bg-hover focus-visible:focus-ring">
                <Avatar name={me.name} size="sm" />
                <span className="sr-only">{t("accountMenu")}</span>
              </button>
            }
          />
        </header>
        <ViewAsBanner />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-20 outline-none lg:pb-0">
          {children}
        </main>
      </div>

      <nav aria-label={tNav("label")} className="layer-sticky fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="mx-auto grid h-16 max-w-prose grid-cols-4">
          {tabs.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.key} className="grid">
                {/* As in the dashboard's tab bar (S-05): no pill; the chosen tab is tinted, its icon strong and its label semibold. */}
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="grid content-center justify-items-center gap-1 text-caption font-medium text-fg-secondary transition-colors duration-micro focus-visible:focus-ring aria-[current=page]:font-semibold aria-[current=page]:text-link"
                >
                  <span className="grid h-control-sm w-12 place-items-center">
                    <Icon icon={item.icon} size="lg" strong={active} />
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
                  aria-describedby={moreWaiting > 0 ? `${ids}-more` : undefined}
                  className="grid content-center justify-items-center gap-1 text-caption font-medium text-fg-secondary transition-colors duration-micro focus-visible:focus-ring aria-[current=page]:font-semibold aria-[current=page]:text-link"
                >
                  <span className="relative grid h-control-sm w-12 place-items-center">
                    <Icon icon={icons.more} size="lg" strong={moreActive} />
                    {moreWaiting > 0 ? (
                      <WaitingBadge
                        waiting={{ count: moreWaiting, urgent: moreUrgent, label: tNav("waiting.more", { count: moreWaiting }) }}
                        id={`${ids}-more`}
                        className="absolute -top-1 end-0"
                      />
                    ) : null}
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
                  className="layer-popover grid min-w-menu gap-0.5 rounded-md border border-line bg-surface-elevated p-1 text-fg motion-safe:animate-pop-in"
                >
                  {more.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <DropdownMenu.Item
                        key={item.key}
                        asChild
                        className="flex h-control-lg cursor-default items-center gap-3 rounded-sm px-3 text-body outline-none data-highlighted:bg-hover aria-[current=page]:bg-selected aria-[current=page]:font-semibold"
                      >
                        <Link href={item.href} aria-current={active ? "page" : undefined} aria-describedby={describe(item.key, "more")}>
                          <Icon icon={item.icon} size="md" strong={active} />
                          <span className="min-w-0 flex-1">{tNav(item.key)}</span>
                          <WaitingBadge waiting={waiting[item.key]} id={`${ids}-more-${item.key}`} />
                        </Link>
                      </DropdownMenu.Item>
                    );
                  })}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </li>
        </ul>
      </nav>
    </div>
  );
}
