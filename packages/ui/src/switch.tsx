"use client";

import { Switch as S } from "radix-ui";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "./lib/cn";

export interface SwitchProps extends ComponentPropsWithoutRef<typeof S.Root> {
  /** Accessible name (required when there is no visible <label>). */
  label?: string | undefined;
}

export function Switch({ className, label, ...props }: SwitchProps) {
  return (
    <S.Root
      aria-label={label}
      className={cn(
        "group/switch relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-line-input bg-canvas-muted",
        "transition-colors duration-standard ease-standard",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        "focus-visible:focus-ring disabled:opacity-disabled",
        // 44 pt hit area on touch screens
        "before:absolute before:-inset-x-0.5 before:-inset-y-3 pointer-fine:before:hidden",
        className,
      )}
      {...props}
    >
      <S.Thumb
        className={cn(
          "pointer-events-none block size-5 translate-x-0.5 rounded-full bg-surface-elevated shadow-e1",
          "transition-transform duration-standard ease-standard",
          "data-[state=checked]:translate-x-4 rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-4",
        )}
      />
    </S.Root>
  );
}
