import { tokens } from "@linkyo/tokens";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const keys = (record: object): string[] => Object.keys(record).map((key) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));

/**
 * tailwind-merge that knows the Linkyo theme, so `text-h1` (size) and `text-fg` (color)
 * never cancel each other out.
 */
const twMerge = extendTailwindMerge({
  override: {
    theme: {
      text: keys(tokens.text),
      color: [
        ...keys(tokens.semantic),
        "ink",
        "paper",
        "white",
        "creator-bg",
        "creator-surface",
        "creator-surface-2",
        "creator-fg",
        "creator-fg-muted",
        "creator-accent",
        "creator-accent-fg",
        "creator-accent-text",
        "creator-line",
        "creator-line-strong",
        ...Object.entries(tokens.color).flatMap(([name, scale]) =>
          typeof scale === "object" ? Object.keys(scale).map((step) => `${name}-${step}`) : [],
        ),
      ],
      radius: [...keys(tokens.radius), "creator-button"],
      shadow: keys(tokens.shadow),
      tracking: keys(tokens.tracking),
      leading: keys(tokens.leading),
      font: ["sans", "mono", "display", "arabic", "creator-display", "creator-body"],
      "font-weight": keys(tokens.font.weight),
      spacing: [...Object.keys(tokens.spacing).map((key) => key.replace("_", ".")), ...keys(tokens.size), "creator-button", "creator-gutter"],
      container: keys(tokens.layout),
      blur: keys(tokens.blur),
      ease: keys(tokens.motion.easing),
      aspect: keys(tokens.aspect),
      breakpoint: keys(tokens.breakpoint),
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
