import { cn } from "./lib/cn";

const sizes = {
  sm: "size-avatar-sm text-caption",
  md: "size-avatar-md text-small",
  lg: "size-avatar-lg text-h3",
  xl: "size-avatar-xl text-h2",
} as const;

export interface AvatarProps {
  name: string;
  src?: string | undefined;
  size?: keyof typeof sizes;
  className?: string | undefined;
}

/** Image avatar with initials fallback. Decorative when next to the visible name. */
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-selected font-semibold text-selected-fg",
        sizes[size],
        className,
      )}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : <span aria-hidden>{initials}</span>}
    </span>
  );
}
