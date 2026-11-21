import { cn } from "./lib/cn";

const sizes = {
  sm: "size-avatar-sm text-caption",
  md: "size-avatar-md text-small",
  lg: "size-avatar-lg text-h3",
  xl: "size-avatar-xl text-h2",
} as const;

/** Arabic, Arabic Supplement and Arabic Extended-A. */
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿ]/;

/**
 * Up to two initials. An Arabic name gets one letter: Arabic letters join, so two initials side by
 * side read as a word ("سلمى رحّال" would show "سر", which means "secret").
 */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? "";
  if (ARABIC.test(first)) return first;
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export interface AvatarProps {
  name: string;
  src?: string | undefined;
  size?: keyof typeof sizes;
  className?: string | undefined;
}

/** Image avatar with initials fallback. Decorative when next to the visible name. */
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const initials = initialsOf(name);
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-selected font-semibold text-selected-fg",
        sizes[size],
        className,
      )}
    >
      {src ? <img src={src} alt="" referrerPolicy="no-referrer" className="size-full object-cover" /> : <span aria-hidden>{initials}</span>}
    </span>
  );
}
