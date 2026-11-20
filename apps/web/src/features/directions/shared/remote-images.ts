/**
 * Pictures that come from a creator's platforms (video thumbnails, release covers, app icons). They are served
 * through our own image optimizer, so a visitor's browser only ever talks to Linkyo: no request to
 * YouTube or Spotify before consent, and no referrer telling them which page shows the picture.
 * Exact hosts only (next.config.ts builds `images.remotePatterns` from this list).
 */
export const PROXIED_IMAGE_HOSTS = [
  "i.ytimg.com",
  "i.scdn.co",
  "image-cdn-ak.spotifycdn.com",
  "image-cdn-fa.spotifycdn.com",
  "mosaic.scdn.co",
  "i.vimeocdn.com",
  "i1.sndcdn.com",
  // App icons from Apple's lookup.
  "is1-ssl.mzstatic.com",
  "is2-ssl.mzstatic.com",
  "is3-ssl.mzstatic.com",
  "is4-ssl.mzstatic.com",
  "is5-ssl.mzstatic.com",
] as const;

export function isProxiedImage(src: string): boolean {
  if (!src.startsWith("https://")) return false;
  try {
    return (PROXIED_IMAGE_HOSTS as readonly string[]).includes(new URL(src).hostname);
  } catch {
    return false;
  }
}
