/**
 * Pictures that come from a creator's platforms (video thumbnails, release covers, app icons). They are served
 * through our own image optimizer, so a visitor's browser only ever talks to Linkyo: no request to
 * YouTube or Spotify before consent, and no referrer telling them which page shows the picture.
 * Exact hosts only (next.config.ts builds `images.remotePatterns` from this list).
 */
export const PROXIED_IMAGE_HOSTS = [
  "i.ytimg.com",
  // Channel avatars (a creator's YouTube profile picture).
  "yt3.googleusercontent.com",
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

/** An address on another server: http(s), or protocol-relative ("//host", and "/\host" as browsers read it). */
const ABSOLUTE = /^(?:https?:)?[/\\]{2}/i;

/**
 * A picture that would make the visitor's browser talk to someone else's server: an address on
 * another host that our optimizer does not re-serve (not on the list above, not our own Storage).
 * Creator pages never load it (`MediaImage` shows a calm tile instead). Our own files, sample
 * assets, `data:` and `blob:` pictures are not foreign.
 */
export function isForeignImage(src: string): boolean {
  const address = src.trim();
  return ABSOLUTE.test(address) && !isProxiedImage(address);
}

/**
 * An SVG address (by its path, before `?` and `#`). Our optimizer does not re-serve SVG
 * (`dangerouslyAllowSVG` stays off), and next/image hands such an address to the browser as it is,
 * so it would load from the other host: never treat it as ours.
 */
function isSvgAddress(src: string): boolean {
  try {
    return new URL(src).pathname.toLowerCase().endsWith(".svg");
  } catch {
    return false;
  }
}

/** A picture our optimizer re-serves: our own Storage, or an exact platform host, and never an SVG. */
export function isProxiedImage(src: string): boolean {
  if (isSvgAddress(src.trim())) return false;
  if (isStorageImage(src)) return true;
  if (!src.startsWith("https://")) return false;
  try {
    return (PROXIED_IMAGE_HOSTS as readonly string[]).includes(new URL(src).hostname);
  } catch {
    return false;
  }
}
