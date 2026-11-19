"use client";

import { Button, Icon, Logo } from "@linkyo/ui";
import { ArrowRight, ChevronRight, CircleHelp, LayoutTemplate, Menu, Sparkles, Tag, X, type LucideIcon } from "lucide-react";
import type { CSSProperties, MouseEvent } from "react";

import { LocaleSwitch } from "@/components/locale-switch";

export interface NavItem {
  href: string;
  label: string;
}

/** A place on the site, with the line under it that says what is there. */
export interface MenuItem extends NavItem {
  key: "features" | "templates" | "pricing" | "faq";
  hint: string;
}

const ICONS: Record<MenuItem["key"], LucideIcon> = { features: Sparkles, templates: LayoutTemplate, pricing: Tag, faq: CircleHelp };

/**
 * The menu on phones and tablets, a full screen like an app's (native Popover API: light dismiss,
 * Escape and focus return come for free).
 *
 * - On top, where the header is: the logo and the close button, in the menu button's place.
 * - The places on the site, each with its icon and one line that says what is there.
 * - The language, written out.
 * - At the bottom, in reach of the thumb: the one action, sign-up. Logging in is the quiet line
 *   under it, for people who already have an account.
 */
export function MobileMenu({
  items,
  home,
  cta,
  login,
  labels,
}: {
  items: MenuItem[];
  home: string;
  cta: NavItem;
  login: NavItem;
  labels: { menu: string; close: string; language: string; haveAccount: string };
}) {
  const close = (event: MouseEvent<HTMLElement>) => {
    event.currentTarget.closest<HTMLElement>("[popover]")?.hidePopover();
  };
  return (
    <>
      <button
        type="button"
        popoverTarget="mk-menu"
        aria-label={labels.menu}
        className="grid size-control-md place-items-center rounded-full text-fg transition-[background-color,scale] duration-micro hover:bg-hover focus-visible:focus-ring active:scale-pressed lg:hidden"
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
                style={{ "--i": index } as CSSProperties}
                className="mk-menu-row group -mx-3 flex min-h-16 items-center gap-4 rounded-lg px-3 py-2 transition-colors duration-micro hover:bg-hover focus-visible:focus-ring active:bg-pressed"
              >
                <span className="grid size-control-md shrink-0 place-items-center rounded-full bg-selected text-selected-fg">
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
            <Button asChild variant="primary" size="xl" block trailing={<Icon icon={ArrowRight} size="md" className="rtl:-scale-x-100" />}>
              <a href={cta.href} onClick={close}>
                {cta.label}
              </a>
            </Button>
            <p className="pb-6 text-center text-small text-fg-secondary">
              {labels.haveAccount}{" "}
              <a href={login.href} onClick={close} className="rounded-xs font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring">
                {login.label}
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
