"use client";

import { AlertDialog } from "radix-ui";
import type { ReactNode } from "react";

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
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="layer-modal fixed inset-0 bg-scrim motion-safe:animate-fade-in" />
        <AlertDialog.Content className="layer-modal fixed inset-x-4 top-1/2 mx-auto w-auto max-w-prose -translate-y-1/2 rounded-xl border border-line bg-surface-elevated p-6 text-fg shadow-e3 motion-safe:animate-pop-in sm:inset-x-0 sm:w-full">
          <AlertDialog.Title className="text-h3">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-body text-fg-secondary">{description}</AlertDialog.Description>
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
