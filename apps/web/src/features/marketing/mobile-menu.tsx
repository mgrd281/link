"use client";

import { Avatar, Button, cn, Icon, Logo } from "@linkyo/ui";
import { ArrowRight, Blocks, ChevronRight, CircleHelp, FolderKanban, LayoutDashboard, LayoutTemplate, Menu, Tag, X, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSyncExternalStore, type CSSProperties, type MouseEvent } from "react";

import { LocaleSwitch } from "@/components/locale-switch";
import { Link } from "@/i18n/navigation";
import { supabaseEnabled } from "@/lib/supabase/config";

import { HeaderSignup } from "./header-signup";

export interface NavItem {
  href: string;
  label: string;
}

/** A place on the site, with the line under it that says what is there. */
export interface MenuItem extends NavItem {
  key: "features" | "templates" | "portfolio" | "pricing" | "faq";
  hint: string;
}

// Blocks, not a grid, for the features: the grid is the templates' glyph (two grids side by side
// read as one thing twice). Portfolio takes the project block's icon.
const ICONS: Record<MenuItem["key"], LucideIcon> = { features: Blocks, templates: LayoutTemplate, portfolio: FolderKanban, pricing: Tag, faq: CircleHelp };

// ─── Who is signed in ───────────────────────────────────────────────────────────────────────────

/** What the website's header shows of a signed-in visitor: a name for the avatar and its picture. */
export interface HeaderAccount {
  name: string;
  avatar: string | undefined;
}

/**
 * Real accounts keep their session in a first-party cookie (`sb-<project>-auth-token`, split into
 * `.0`, `.1` when long). Without it nobody is signed in, and the account code is not even loaded.
 */
const SESSION_COOKIE = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/;

/**
 * A picture the header may show as it is: one of Linkyo's own files or one made in this browser.
 * Anything on another server shows initials instead (the website loads nothing from third parties).
 */
const ownPicture = (src: string | undefined): string | undefined => (src && /^(?:\/(?!\/)|data:image\/|blob:)/.test(src) ? src : undefined);

/**
 * The visitor's session for the website's header, read after the first paint. `undefined` until it
 * is known (the server and the first paint show the signed-out header), then `null` or the account.
 * The account store loads on demand: in a demo build always (the session lives in this browser), with
 * real accounts only when the session cookie is there, so visitors without an account download none
 * of it.
 */
const session = {
  value: undefined as HeaderAccount | null | undefined,
  listeners: new Set<() => void>(),
  started: false,
  set(next: HeaderAccount | null) {
    const same = next === null ? this.value === null : this.value?.name === next.name && this.value.avatar === next.avatar;
    if (same) return;
    this.value = next;
    for (const listener of this.listeners) listener();
  },
  start() {
    if (this.started) return;
    this.started = true;
    if (supabaseEnabled && !SESSION_COOKIE.test(document.cookie)) {
      this.set(null);
      return;
    }
    import("@/features/account/store").then(
      ({ accountStore }) => {
        const read = () => {
          const snapshot = accountStore.getSnapshot();
          if (snapshot.status === "signedIn") {
            const profile = snapshot.site.page.profile;
            // A new account may have no name or address yet: then the first part of its e-mail.
            const name = profile.displayName.trim() || snapshot.account.username || (snapshot.account.email.split("@")[0] ?? "");
            this.set({ name, avatar: ownPicture(profile.avatar.src) });
          } else if (snapshot.status === "signedOut") this.set(null);
        };
        accountStore.subscribe(read);
        read();
      },
      () => {
        this.set(null);
      },
    );
  },
};

const subscribe = (listener: () => void) => {
  session.listeners.add(listener);
  session.start();
  return () => session.listeners.delete(listener);
};

export function useHeaderAccount(): HeaderAccount | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => session.value,
    () => undefined,
  );
}

/**
 * Phones: the one action beside the search. Signed out, sign-up (it waits for the hero's own on the
 * homepage, see HeaderSignup); signed in, the visitor's avatar, which leads to the dashboard.
 */
export function HeaderPhoneAction({ signupLabel, after }: { signupLabel: string; after?: string | undefined }) {
  const t = useTranslations("marketing.nav");
  const account = useHeaderAccount();
  if (!account) return <HeaderSignup label={signupLabel} after={after} />;
  return (
    <Link
      href="/app"
      aria-label={t("dashboard")}
      data-header-dashboard
      className="relative grid size-control-md place-items-center rounded-full transition-[scale] duration-micro before:absolute before:inset-0 focus-visible:focus-ring active:scale-pressed motion-reduce:transition-none pointer-coarse:before:-inset-0.5 md:hidden"
    >
      <Avatar name={account.name} src={account.avatar} size="sm" />
    </Link>
  );
}

/**
 * Wide screens: "log in" and "sign up" in one switch for visitors; for someone signed in, one way
 * back to their dashboard with their avatar.
 */
export function HeaderAuth({ login, signup }: { login: NavItem; signup: NavItem }) {
  const t = useTranslations("marketing.nav");
  const account = useHeaderAccount();
  if (account) {
    return (
      <Link
        href="/app"
        data-header-dashboard
        className="hidden h-control-md items-center gap-2 rounded-full bg-primary ps-1 pe-4 text-small font-semibold text-primary-fg transition-[background-color,scale] duration-micro hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed motion-reduce:transition-none md:inline-flex"
      >
        <Avatar name={account.name} src={account.avatar} size="sm" />
        {t("dashboard")}
      </Link>
    );
  }
  return (
    <div className="hidden md:block">
      {/* One switch for both: the teal highlight sits on "sign up" and slides to "log in" under the pointer. */}
      <div className="mk-auth-switch h-control-md text-small font-semibold">
        <Link href={login.href} data-login className="rounded-full px-4 focus-visible:focus-ring">
          {login.label}
        </Link>
        <Link href={signup.href} data-signup className="rounded-full px-4 focus-visible:focus-ring">
          {signup.label}
        </Link>
      </div>
    </div>
  );
}

// ─── The menu ───────────────────────────────────────────────────────────────────────────────────

/**
 * The menu on phones and tablets, a full screen like an app's (native Popover API: light dismiss,
 * Escape and focus return come for free).
 *
 * - On top, where the header is: the logo and the close button, in the menu button's place.
 * - The places on the site, each with its icon and one line that says what is there.
 * - The language, written out.
 * - At the bottom, in reach of the thumb: the one action, sign-up. Logging in is the quiet line
 *   under it, for people who already have an account. Someone signed in gets "edit my page" there
 *   instead, and the dashboard as the quiet line.
 */
export function MobileMenu({
  items,
  current,
  home,
  cta,
  login,
  labels,
}: {
  items: MenuItem[];
  /** The place this page is (marked for screen readers and by its tile). */
  current?: MenuItem["key"] | undefined;
  home: string;
  cta: NavItem;
  login: NavItem;
  labels: { menu: string; close: string; language: string; haveAccount: string };
}) {
  const t = useTranslations("marketing.nav");
  const locale = useLocale();
  const account = useHeaderAccount();
  const close = (event: MouseEvent<HTMLElement>) => {
    event.currentTarget.closest<HTMLElement>("[popover]")?.hidePopover();
  };
  return (
    <>
      <button
        type="button"
        popoverTarget="mk-menu"
        aria-label={labels.menu}
        className="relative grid size-control-md place-items-center rounded-full text-fg transition-[background-color,scale] duration-micro before:absolute before:inset-0 hover:bg-hover focus-visible:focus-ring active:scale-pressed active:bg-pressed pointer-coarse:before:-inset-0.5 lg:hidden"
      >
        <Icon icon={Menu} size="md" />
      </button>
      <div
        id="mk-menu"
        popover="auto"
        role="dialog"
        aria-label={labels.menu}
        className="mk-menu-sheet fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto overscroll-contain border-0 bg-canvas p-0 text-fg"
      >
        <div className="mx-auto flex min-h-full w-full max-w-prose flex-col px-5 md:px-10">
          <div className="flex h-16 shrink-0 items-center justify-between gap-2">
            <a href={home} onClick={close} aria-label="Linkyo" className="rounded-xs focus-visible:focus-ring">
              <Logo className="h-6" title="Linkyo" />
            </a>
            <button
              type="button"
              popoverTarget="mk-menu"
              popoverTargetAction="hide"
              aria-label={labels.close}
              className="grid size-control-md place-items-center rounded-full bg-canvas-muted text-fg transition-[background-color,scale] duration-micro hover:bg-hover focus-visible:focus-ring active:scale-pressed"
            >
              <Icon icon={X} size="md" />
            </button>
          </div>

          <nav aria-label={labels.menu} className="mt-4 grid gap-1">
            {items.map((item, index) => (
              <a
                key={item.href}
                href={item.href}
                onClick={close}
                aria-current={item.key === current ? "page" : undefined}
                style={{ "--i": index } as CSSProperties}
                className="mk-menu-row group -mx-3 flex min-h-16 items-center gap-4 rounded-lg px-3 py-2 transition-colors duration-micro hover:bg-hover focus-visible:focus-ring active:bg-pressed aria-[current=page]:bg-canvas-muted"
              >
                <span
                  className={cn(
                    "grid size-control-md shrink-0 place-items-center rounded-full",
                    item.key === current ? "bg-primary text-primary-fg" : "bg-selected text-selected-fg",
                  )}
                >
                  <Icon icon={ICONS[item.key]} size="md" />
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="text-body-lg font-semibold text-fg">{item.label}</span>
                  <span className="text-small text-fg-secondary">{item.hint}</span>
                </span>
                <Icon
                  icon={ChevronRight}
                  size="sm"
                  className="shrink-0 text-fg-tertiary transition-[color,translate] duration-micro group-hover:translate-x-0.5 group-hover:text-fg rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                />
              </a>
            ))}
          </nav>

          <div style={{ "--i": items.length } as CSSProperties} className="mk-menu-row mt-8 grid gap-3">
            <p className="text-caption font-semibold text-fg-secondary">{labels.language}</p>
            <LocaleSwitch variant="full" />
          </div>

          <div style={{ "--i": items.length + 1 } as CSSProperties} className="mk-menu-row mk-safe-bottom mt-auto grid gap-4 pt-10">
            {account ? (
              <>
                <p className="flex min-w-0 items-center gap-3 text-small text-fg-secondary">
                  <Avatar name={account.name} src={account.avatar} size="sm" />
                  <span className="min-w-0 truncate">{t.rich("signedIn", { name: account.name, bdi: (chunks) => <bdi>{chunks}</bdi> })}</span>
                </p>
                <Button asChild variant="primary" size="cta" block trailing={<Icon icon={ArrowRight} size="md" className="rtl:-scale-x-100" />}>
                  <a href={`/${locale}/app/editor`} onClick={close}>
                    {t("editPage")}
                  </a>
                </Button>
                <p className="pb-6 text-center text-small">
                  <a
                    href={`/${locale}/app`}
                    onClick={close}
                    className="-mx-2 inline-flex min-h-touch-target items-center gap-2 rounded-full px-2 font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring active:bg-pressed"
                  >
                    <Icon icon={LayoutDashboard} size="sm" />
                    {t("dashboard")}
                  </a>
                </p>
              </>
            ) : (
              <>
                <Button asChild variant="primary" size="cta" block trailing={<Icon icon={ArrowRight} size="md" className="rtl:-scale-x-100" />}>
                  <a href={cta.href} onClick={close}>
                    {cta.label}
                  </a>
                </Button>
                <p className="pb-6 text-center text-small text-fg-secondary">
                  {labels.haveAccount}{" "}
                  <a href={login.href} onClick={close} className="-mx-2 inline-flex min-h-touch-target items-center rounded-full px-2 font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring active:bg-pressed">
                    {login.label}
                  </a>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
