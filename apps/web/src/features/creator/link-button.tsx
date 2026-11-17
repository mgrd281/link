import type { CreatorButtonStyle } from "@linkyo/tokens";
import { cn, Icon } from "@linkyo/ui";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/** Six themeable link styles (brand §7). Shapes come from `--creator-radius-button`. */
export const linkStyleClasses: Record<CreatorButtonStyle, string> = {
  filled: "bg-creator-accent text-creator-accent-fg",
  outline: "border border-creator-line-strong text-creator-fg",
  soft: "bg-creator-surface-2 text-creator-fg",
  glass: "border border-creator-line bg-creator-glass text-creator-fg backdrop-blur-glass",
  shadow: "bg-creator-surface text-creator-fg shadow-e2 hover:shadow-e3",
  minimal: "rounded-none border-b border-creator-line px-1 text-creator-fg hover:text-creator-accent-text",
};

export interface CreatorLinkProps {
  label: string;
  href: string;
  variant: CreatorButtonStyle;
  /** Small square image or icon on the start side. */
  leading?: ReactNode;
  /** e.g. "New" badge. */
  badge?: string | undefined;
  className?: string;
  external?: boolean;
}

export function CreatorLink({ label, href, variant, leading, badge, className, external = true }: CreatorLinkProps) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        "group/link relative isolate flex min-h-creator-button w-full items-center gap-3 rounded-creator-button px-4 py-2",
        "font-creator-body text-body font-medium",
        "transition-[box-shadow,color,scale] duration-standard ease-standard active:scale-pressed motion-reduce:active:scale-none",
        "focus-visible:focus-ring",
        // Hover/press overlay in currentColor — works on every style and theme.
        "after:pointer-events-none after:absolute after:inset-0 after:-z-0 after:rounded-[inherit] after:bg-current after:opacity-0",
        "after:transition-opacity after:duration-micro hover:after:opacity-hover active:after:opacity-pressed",
        variant === "minimal" && "after:hidden",
        linkStyleClasses[variant],
        className,
      )}
    >
      {leading ? <span className="relative shrink-0">{leading}</span> : null}
      <span className={cn("relative min-w-0 flex-1 truncate", !leading && variant !== "minimal" && "text-center")}>{label}</span>
      {badge ? (
        <span className="relative shrink-0 rounded-full bg-creator-accent px-2 py-0.5 text-caption text-creator-accent-fg">{badge}</span>
      ) : null}
      {variant === "minimal" ? (
        <Icon icon={ArrowUpRight} size="sm" className="relative shrink-0 rtl:-scale-x-100" />
      ) : leading ? (
        <Icon icon={ChevronRight} size="sm" className="relative shrink-0 opacity-secondary rtl:-scale-x-100" />
      ) : null}
    </a>
  );
}
