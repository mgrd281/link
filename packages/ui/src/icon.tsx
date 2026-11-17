import { tokens } from "@linkyo/tokens";
import type { LucideIcon } from "lucide-react";
import type { SimpleIcon } from "simple-icons";
import type { CSSProperties } from "react";

import { cn } from "./lib/cn";

export type IconSize = "sm" | "md" | "lg";

const sizeClass: Record<IconSize, string> = {
  sm: "size-icon-sm",
  md: "size-icon-md",
  lg: "size-icon-lg",
};

export interface IconProps {
  icon: LucideIcon;
  size?: IconSize | undefined;
  className?: string | undefined;
  /** Decorative by default. Pass a label only when the icon conveys meaning on its own. */
  label?: string | undefined;
}

/** Lucide icon at a token size with the brand stroke (1.75). */
export function Icon({ icon: Glyph, size = "md", className, label }: IconProps) {
  return (
    <Glyph
      className={cn("shrink-0", sizeClass[size], className)}
      strokeWidth={tokens.icon.stroke}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
    />
  );
}

export interface PlatformIconProps {
  icon: SimpleIcon;
  size?: IconSize | undefined;
  className?: string | undefined;
  /** Show the platform's brand color (hover/press or when the creator enables brand colors). */
  brandColor?: "never" | "hover" | "always" | undefined;
  label?: string | undefined;
}

/** Simple Icons platform logo: official shape, monochrome by default (brand §8). */
export function PlatformIcon({ icon, size = "md", className, brandColor = "never", label }: PlatformIconProps) {
  const style = { "--platform-color": `#${icon.hex}` } as CSSProperties;
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(
        "shrink-0 fill-current",
        sizeClass[size],
        brandColor === "always" && "fill-(--platform-color)",
        brandColor === "hover" && "transition-colors duration-micro group-hover:fill-(--platform-color) group-active:fill-(--platform-color)",
        className,
      )}
      style={style}
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      focusable="false"
    >
      <path d={icon.path} />
    </svg>
  );
}
