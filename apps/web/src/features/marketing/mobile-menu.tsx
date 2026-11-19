"use client";

import { Button, Icon } from "@linkyo/ui";
import { Menu, X } from "lucide-react";
import type { MouseEvent } from "react";

export interface NavItem {
  href: string;
  label: string;
}

/** Phone navigation on the native Popover API: light-dismiss, Esc and focus return come for free. */
export function MobileMenu({ items, labels, cta, secondary }: { items: NavItem[]; labels: { menu: string; close: string }; cta: NavItem; secondary?: NavItem }) {
  const close = (event: MouseEvent<HTMLElement>) => {
    event.currentTarget.closest<HTMLElement>("[popover]")?.hidePopover();
  };
  return (
    <>
      <button
        type="button"
        popoverTarget="mk-menu"
        aria-label={labels.menu}
        className="grid size-control-md place-items-center rounded-full text-fg hover:bg-hover focus-visible:focus-ring lg:hidden"
      >
        <Icon icon={Menu} size="md" />
      </button>
      <div
        id="mk-menu"
        popover="auto"
        className="inset-x-3 top-3 bottom-auto m-0 w-auto rounded-xl border border-line bg-surface-elevated p-3 text-fg backdrop:bg-scrim motion-safe:open:animate-pop-in"
      >
        <div className="flex justify-end">
          <button
            type="button"
            popoverTarget="mk-menu"
            popoverTargetAction="hide"
            aria-label={labels.close}
            className="grid size-control-md place-items-center rounded-full hover:bg-hover focus-visible:focus-ring"
          >
            <Icon icon={X} size="md" />
          </button>
        </div>
        <nav aria-label={labels.menu} className="grid gap-1 pb-2">
          {items.map((item) => (
            <a key={item.href} href={item.href} onClick={close} className="flex h-control-xl items-center rounded-lg px-4 text-h3 hover:bg-hover focus-visible:focus-ring">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="grid gap-2">
          {secondary ? (
            <Button asChild size="xl" block className="border-link text-link hover:border-primary hover:bg-primary hover:text-primary-fg">
              <a href={secondary.href} onClick={close}>
                {secondary.label}
              </a>
            </Button>
          ) : null}
          <Button asChild variant="primary" size="xl" block>
            <a href={cta.href} onClick={close}>
              {cta.label}
            </a>
          </Button>
        </div>
      </div>
    </>
  );
}
