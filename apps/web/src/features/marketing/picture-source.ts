import type { StaticImageData } from "next/image";

/**
 * A bundled picture as the home page passes it on: where it is and how big it is, and nothing else.
 * A static import also carries a blurred preview (`blurDataURL`, about 0.7 KB each); the home page
 * shows its token colour while a picture loads instead, so the preview never travels in the page
 * (E-03, ADR 0008).
 */
export interface PictureSource {
  src: string;
  width: number;
  height: number;
}

/** The size of a bundled picture without its blurred preview. */
export const source = ({ src, width, height }: StaticImageData | PictureSource): PictureSource => ({ src, width, height });

/**
 * The widths of a `srcset` that can differ: every width below the picture's own, and the first at or
 * above it. Next's optimizer never enlarges a picture (`withoutEnlargement`), so every wider entry
 * returns the very same pixels as that one, under a longer address. `src` becomes that entry's address
 * (the browser takes the picture from `srcset`; `src` is its fallback). Lists in density form (1x, 2x)
 * and pictures of unknown width stay as they are (null).
 */
export function trimSrcSet(srcSet: string, intrinsicWidth: number | undefined): { srcSet: string; src: string } | null {
  if (!intrinsicWidth) return null;
  const entries = srcSet.split(", ").map((entry) => {
    const space = entry.lastIndexOf(" ");
    return { url: entry.slice(0, space), width: /^(\d+)w$/.exec(entry.slice(space + 1))?.[1] };
  });
  if (entries.some((entry) => entry.width === undefined)) return null;
  const kept: typeof entries = [];
  for (const entry of entries) {
    kept.push(entry);
    if (Number(entry.width) >= intrinsicWidth) break;
  }
  const last = kept.at(-1);
  if (!last) return null;
  return { srcSet: kept.map((entry) => `${entry.url} ${String(entry.width)}w`).join(", "), src: last.url };
}
