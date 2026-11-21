import { UserRound } from "lucide-react";

import { Icon, type IconSize } from "./icon";
import { cn } from "./lib/cn";

const sizes = {
  sm: "size-avatar-sm text-caption",
  md: "size-avatar-md text-small",
  lg: "size-avatar-lg text-h3",
  xl: "size-avatar-xl text-h2",
} as const;

/** The person glyph shown when a name has no letter to take initials from ("1", "🎧"). */
const glyphSizes: Record<keyof typeof sizes, IconSize> = { sm: "sm", md: "md", lg: "lg", xl: "lg" };

/** Arabic, Arabic Supplement and Arabic Extended-A. */
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿ]/;
const LETTER = /^\p{L}/u;

let segmenter: Intl.Segmenter | null | undefined;

/** The first user-perceived character of a word: "É" even when written as E + a combining accent. */
function firstGrapheme(word: string): string {
  segmenter ??= typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
  if (!segmenter) return Array.from(word)[0] ?? "";
  for (const { segment } of segmenter.segment(word)) return segment;
  return "";
}

/**
 * Up to two initials, from the first two words that start with a letter; numbers, emoji and symbols
 * are skipped, and a name without a letter has none (""), so the avatar shows a person glyph instead.
 * An Arabic name gets one letter: Arabic letters join, so two initials side by side read as a word
 * ("سلمى رحّال" would show "سر", which means "secret").
 */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .map(firstGrapheme)
    .filter((first) => LETTER.test(first));
  const first = letters[0] ?? "";
  if (ARABIC.test(first)) return first;
  return letters
    .slice(0, 2)
    .map((letter) => letter.toUpperCase())
    .join("");
}

export interface AvatarProps {
  name: string;
  src?: string | undefined;
  size?: keyof typeof sizes;
  className?: string | undefined;
}

/** Image avatar with initials fallback (or a person glyph). Decorative when next to the visible name. */
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
      {src ? (
        <img src={src} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
      ) : initials ? (
        <span aria-hidden>{initials}</span>
      ) : (
        <Icon icon={UserRound} size={glyphSizes[size]} />
      )}
    </span>
  );
}
