"use client";

import { Skeleton } from "@linkyo/ui";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Tile } from "../list";
import { ProgressBar } from "../progress-bar";

/** The inset hairline of the dashboard's rows (as `ListRow` draws it): from the text to the end. */
const rowSeparator =
  "relative not-first:before:absolute not-first:before:start-16 not-first:before:end-0 not-first:before:top-0 not-first:before:border-t not-first:before:border-line";

export interface MilestoneProgress {
  value: number;
  max: number;
  /** "1 of 3", read out for the bar. */
  valueText: string;
  /** What is still missing ("2 more friends"), shown at the end of the bar. */
  remaining?: string | undefined;
}

/**
 * One reward of the invite program in the Rewards group: its tile (green once it is yours), its
 * name, where it stands, and how far there is still to go, or the one thing to do now.
 */
export function MilestoneRow({
  icon,
  title,
  titleId,
  status,
  done = false,
  progress,
  action,
}: {
  icon: LucideIcon;
  title: string;
  /** Lets the screen bring focus back here once the row's action has gone (a request was sent). */
  titleId?: string;
  status: ReactNode;
  done?: boolean;
  progress?: MilestoneProgress | undefined;
  action?: ReactNode;
}) {
  return (
    <li className={rowSeparator}>
      <div className="flex items-start gap-4 px-4 py-3">
        <Tile icon={icon} done={done} />
        <div className="grid min-w-0 flex-1 gap-1">
          <h3 id={titleId} tabIndex={titleId ? -1 : undefined} className="text-body font-semibold leading-snug outline-none">
            {title}
          </h3>
          <p className="text-small font-regular text-pretty text-fg-secondary">{status}</p>
          {progress ? (
            <div className="flex items-center gap-3 pt-1">
              <ProgressBar value={progress.value} max={progress.max} label={title} valueText={progress.valueText} className="min-w-0 flex-1" />
              {progress.remaining ? <span className="shrink-0 text-caption font-semibold tabular-nums text-fg-secondary">{progress.remaining}</span> : null}
            </div>
          ) : null}
          {action ? <div className="pt-2">{action}</div> : null}
        </div>
      </div>
    </li>
  );
}

/** A milestone row's shape while the program loads. */
export function MilestoneRowSkeleton() {
  return (
    <li className={rowSeparator}>
      <div className="flex items-start gap-4 px-4 py-3">
        <Skeleton className="size-control-sm shrink-0" />
        <div className="grid min-w-0 flex-1 gap-2 pt-1">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-1 w-full" />
        </div>
      </div>
    </li>
  );
}
