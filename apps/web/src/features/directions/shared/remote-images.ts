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

/** Where public page pictures live in Supabase Storage (the `media` bucket). */
export const STORAGE_MEDIA_PATH = "/storage/v1/object/public/media/";

const LOOPBACK = new Set(["127.0.0.1", "localhost"]);

/**
 * A picture a creator uploaded to our own Storage (the public `media` bucket of this deployment's
 * Supabase project). It goes through our optimizer too, so visitors never contact the Storage host.
 * https only, except the local stack (http on a loopback address) outside Vercel.
 */
export function isStorageImage(src: string, env: { supabaseUrl?: string | undefined; vercel?: string | undefined } = {}): boolean {
  const base = env.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!base || !src.startsWith(`${base.replace(/\/$/, "")}${STORAGE_MEDIA_PATH}`)) return false;
  try {
    const url = new URL(src);
    if (url.protocol === "https:") return true;
    const vercel = "vercel" in env ? env.vercel : process.env.VERCEL;
    return url.protocol === "http:" && LOOPBACK.has(url.hostname) && !vercel;
  } catch {
    return false;
  }
}

export function isProxiedImage(src: string): boolean {
  if (isStorageImage(src)) return true;
  if (!src.startsWith("https://")) return false;
  try {
    return (PROXIED_IMAGE_HOSTS as readonly string[]).includes(new URL(src).hostname);
  } catch {
    return false;
  }
}
