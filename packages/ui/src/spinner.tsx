import { cn } from "./lib/cn";

/** Indeterminate spinner. Uses `currentColor`; size follows the surrounding icon slot. */
export function Spinner({ className, label }: { className?: string | undefined; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-icon-sm shrink-0 animate-spin motion-reduce:animate-pulse", className)}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
