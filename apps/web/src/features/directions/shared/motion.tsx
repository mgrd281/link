import { cn, Icon } from "@linkyo/ui";
import { Pause, Play } from "lucide-react";

import { HeroMotionIsland } from "./motion-island";
import { resolveMotion } from "./motion-source";

export { resolveMotion };

/**
 * A moving picture over the hero photo: a short silent clip that loops, with a button that pauses and
 * plays it (`./motion-island.tsx`). Its icons and classes are drawn here, on the server for a public
 * page, so the visitor's browser loads no icon kit and no class merging for it (ADR 0008).
 */
export function HeroMotion({ src, className }: { src: string; className?: string | undefined }) {
  const url = resolveMotion(src);
  if (!url) return null;
  const base = "absolute inset-0 size-full object-cover transition-opacity duration-slow ease-standard";
  return (
    <HeroMotionIsland
      url={url}
      classes={{ playing: cn(base, "opacity-100", className), paused: cn(base, "opacity-0", className) }}
      icons={{ pause: <Icon icon={Pause} size="sm" solid />, play: <Icon icon={Play} size="sm" solid className="translate-x-px" /> }}
    />
  );
}
