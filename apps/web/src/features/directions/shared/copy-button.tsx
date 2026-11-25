import { cn, Icon } from "@linkyo/ui";
import { Check, Copy } from "lucide-react";
import type { ReactNode } from "react";

import { CopyButtonIsland } from "./copy-button-island";

export { CONFIRM_MS } from "./copy-confirm";

/**
 * Copies a short text in one tap (an install command, a promo code): the island
 * (`./copy-button-island.tsx`) with its class and icons drawn here, on the server for a public page,
 * so the visitor's browser loads no icon kit and no class merging for it (ADR 0008).
 */
export function CopyButton({ value, label, className, children }: { value: string; label: string; className?: string; children?: ReactNode }) {
  return (
    <CopyButtonIsland
      value={value}
      label={label}
      className={cn("transition-[background-color,scale] duration-micro active:scale-pressed focus-visible:focus-ring motion-reduce:active:scale-none", className)}
      icons={{
        copy: <Icon icon={Copy} size="sm" className="shrink-0" />,
        copied: <Icon icon={Check} size="sm" className={cn("shrink-0", "motion-safe:animate-pop-in")} />,
      }}
    >
      {children}
    </CopyButtonIsland>
  );
}
