import { cn } from "@linkyo/ui";
import type { CSSProperties } from "react";

/**
 * A thin progress bar, as on Home's next step: a tinted track and a fill in the link colour. The fill
 * is a block that starts at the inline start, so it grows from the right in Arabic by itself. Screen
 * readers hear `valueText` ("1 of 3"), so a visible count beside the bar can be `aria-hidden`.
 */
export function ProgressBar({
  value,
  max,
  label,
  valueText,
  className,
}: {
  value: number;
  max: number;
  /** What is measured, e.g. the milestone's name. */
  label: string;
  /** The value in words, e.g. "1 of 3". */
  valueText: string;
  className?: string;
}) {
  const now = Math.min(Math.max(value, 0), Math.max(max, 0));
  const share = max > 0 ? now / max : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={now}
      aria-valuetext={valueText}
      className={cn("h-1 overflow-hidden rounded-full bg-tinted", className)}
    >
      <div
        className="h-full w-(--w) rounded-full bg-link transition-[width] duration-standard ease-emphasized motion-reduce:transition-none"
        style={{ "--w": `${share * 100}%` } as CSSProperties}
      />
    </div>
  );
}
