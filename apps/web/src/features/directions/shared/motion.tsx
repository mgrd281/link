import { cn, Icon } from "@linkyo/ui";
import { Pause, Play } from "lucide-react";

import { HeroMotionIsland } from "./motion-island";
import { resolveMotion } from "./motion-source";

export { resolveMotion };

/** The play/pause button over the clip: glass, in the corner. */
const BUTTON = "absolute end-3 top-3 grid place-items-center rounded-full border border-creator-line bg-creator-glass text-creator-fg backdrop-blur-glass";

/**
 * A moving picture over the hero photo: a short silent clip that loops, with a button that pauses and
 * plays it (`./motion-island.tsx`). Its icons and classes are drawn here, on the server for a public
 * page, so the visitor's browser loads no icon kit and no class merging for it (ADR 0008).
 * `tone="ink"`: the clip stands in an ink band (Laufbahn's head), so its button takes the band's white
 * focus ring (the accent ring is under 3 : 1 on ink) and the hero's 48 px target.
 */
export function HeroMotion({ src, className, tone = "page" }: { src: string; className?: string | undefined; tone?: "page" | "ink" }) {
  const url = resolveMotion(src);
  if (!url) return null;
  const base = "absolute inset-0 size-full object-cover transition-opacity duration-slow ease-standard";
  const ink = tone === "ink";
  const size = ink ? "md" : "sm";
  return (
    <HeroMotionIsland
      url={url}
      classes={{
        playing: cn(base, "opacity-100", className),
        paused: cn(base, "opacity-0", className),
        button: cn(BUTTON, ink ? "size-control-lg focus-visible:focus-ring-inverse" : "size-control-sm focus-visible:focus-ring"),
      }}
      icons={{ pause: <Icon icon={Pause} size={size} solid />, play: <Icon icon={Play} size={size} solid className="translate-x-px" /> }}
    />
  );
}
