"use client";

import { cn, IconButton } from "@linkyo/ui";
import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";

/**
 * A sheet: slides up from the bottom on phones (thumb-reachable actions), docks to the side on wide
 * screens. With `besidePreview` it leaves the live phone preview visible on extra-wide screens, so
 * every change shows up on the page while you type.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  footer,
  besidePreview = false,
  headerAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string | undefined;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  besidePreview?: boolean;
  headerAction?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "layer-modal fixed inset-0 bg-scrim motion-safe:animate-fade-in",
            besidePreview && "xl:end-[calc(var(--container-preview)+var(--spacing-8))]",
          )}
        />
        <Dialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          onOpenAutoFocus={(event) => {
            // With a mouse, start in the first field. On touch screens, don't pop the keyboard up uninvited.
            const field = (event.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-sheet-body] :is(input:not([type=hidden]), textarea, select)");
            if (field && window.matchMedia("(pointer: fine)").matches) {
              event.preventDefault();
              field.focus();
            }
          }}
          className={cn(
            "layer-modal fixed inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-xl border border-line bg-surface-elevated text-fg shadow-e3 outline-none motion-safe:animate-rise-in",
            "lg:inset-y-0 lg:start-auto lg:end-0 lg:max-h-none lg:w-full lg:max-w-prose lg:rounded-none lg:rounded-s-xl",
            besidePreview && "xl:end-[calc(var(--container-preview)+var(--spacing-8))]",
          )}
        >
          <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong lg:hidden" />
          <header className="flex items-start gap-3 border-b border-line px-5 pt-3 pb-4 lg:pt-5">
            <div className="grid min-w-0 flex-1 gap-1">
              <Dialog.Title className="text-h3">{title}</Dialog.Title>
              {description ? <Dialog.Description className="text-small text-fg-secondary">{description}</Dialog.Description> : null}
            </div>
            {headerAction}
            <Dialog.Close asChild>
              <IconButton icon={X} label={closeLabel} />
            </Dialog.Close>
          </header>
          <div data-sheet-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
            {children}
          </div>
          {footer ? <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 pt-3 pb-[max(var(--spacing-3),env(safe-area-inset-bottom))]">{footer}</footer> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
