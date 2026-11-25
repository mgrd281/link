const SAMPLE_PREFIX = "sample:motion-";

/** Where a moving picture lives: our sample clips by key, or the creator's own https link. */
export function resolveMotion(src: string): string | null {
  if (src.startsWith(SAMPLE_PREFIX)) return `/media/motion/${src.slice(SAMPLE_PREFIX.length)}.mp4`;
  return src.startsWith("https://") ? src : null;
}
