"use client";

import { AlertDialog } from "radix-ui";
import { useRef, type ReactNode } from "react";

import { Button } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
  loading?: boolean;
  /** Keeps the confirm button disabled, e.g. until a name is typed to confirm a deletion. */
  confirmDisabled?: boolean;
  /** Content after the description, e.g. a field to type a name into (not inside the description's text). */
  children?: ReactNode;
  /** Where focus goes when the dialog opens: Cancel (the safe choice), or the first field in `children`. */
  initialFocus?: "cancel" | "first-field";
}

/** Confirmation dialog. The only place where destructive buttons are filled (brand §7). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive = true,
  loading = false,
  confirmDisabled = false,
  children,
  initialFocus = "cancel",
}: ConfirmDialogProps) {
  const content = useRef<HTMLDivElement>(null);
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="layer-modal fixed inset-0 bg-scrim motion-safe:animate-fade-in" />
        <AlertDialog.Content
          ref={content}
          // Radix focuses Cancel unless this handler prevents it; a dialog that asks for typing starts in its field.
          onOpenAutoFocus={(event) => {
            if (initialFocus !== "first-field") return;
            const field = content.current?.querySelector<HTMLElement>("input:not([type=hidden]):not(:disabled), textarea:not(:disabled), select:not(:disabled)");
            if (!field) return;
            event.preventDefault();
            field.focus({ preventScroll: true });
          }}
          className="layer-modal fixed inset-x-4 top-1/2 mx-auto w-auto max-w-prose -translate-y-1/2 rounded-xl border border-line bg-surface-elevated p-6 text-fg motion-safe:animate-pop-in sm:inset-x-0 sm:w-full"
        >
          <AlertDialog.Title className="text-h3">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-body text-fg-secondary">{description}</AlertDialog.Description>
          {children ? <div className="mt-4 grid gap-4">{children}</div> : null}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">{cancelLabel}</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant={destructive ? "destructive-solid" : "primary"} loading={loading} disabled={confirmDisabled} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
