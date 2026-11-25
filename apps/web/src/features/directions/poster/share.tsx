import { cn, Icon } from "@linkyo/ui";
import { Check, Share } from "lucide-react";
import type { ReactNode } from "react";

import { ShareActionIsland, ShareButtonIsland } from "./share-island";

/**
 * Sharing a creator page: the native share sheet where there is one, else the address is copied
 * (`./share-island.tsx`). Icons and classes are drawn here, on the server for a public page, so the
 * visitor's browser loads no icon kit and no class merging for them (ADR 0008).
 */

/** Native share sheet where available (phones), otherwise copies the link. */
export function ShareButton({ title, className }: { title: string; className?: string }) {
  return (
    <ShareButtonIsland
      title={title}
      className={cn(
        "grid size-touch-target shrink-0 place-items-center rounded-full text-creator-fg transition-colors duration-micro hover:bg-creator-surface-2 focus-visible:focus-ring",
        className,
      )}
      icons={{ share: <Icon icon={Share} size="md" />, copied: <Icon icon={Check} size="md" /> }}
    />
  );
}

/**
 * A labelled share button (Laufbahn's hero): icon and "Share". Its label never changes (WCAG 2.5.3);
 * where the address is copied, only the icon turns into a check for a moment.
 */
export function ShareAction({ title, label, className }: { title: string; label: string; className?: string }): ReactNode {
  return (
    <ShareActionIsland
      title={title}
      label={label}
      className={className}
      icons={{
        share: <Icon icon={Share} size="md" className="shrink-0" />,
        copied: <Icon icon={Check} size="md" className={cn("shrink-0", "motion-safe:animate-pop-in")} />,
      }}
    />
  );
}
