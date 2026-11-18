import type { BlockType, Platform } from "./schema";

/**
 * Smart detect (brand promise: "add anything in one paste").
 * Pure + synchronous so the editor can create the right block optimistically (< 1 ms);
 * metadata (title, image, price…) is fetched afterwards on the server.
 */
export interface Detection {
  type: BlockType;
  /** Platform/provider when known. */
  platform?: Platform | "vimeo" | "eventbrite" | "eventim" | "ticketmaster" | "shopify" | "pdf" | "image" | "phone" | undefined;
  /** Provider-specific id (e.g. YouTube video id). */
  id?: string | undefined;
  /** Normalized URL (https, no tracking params). */
  url: string;
  /** Human label for the optimistic block title until metadata arrives. */
  label: string;
}

const TRACKING = /^(utm_\w+|fbclid|gclid|igsh|si|feature|ref_src|mc_cid|mc_eid)$/i;

export function normalizeUrl(input: string): URL | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^(mailto|tel):/i.test(raw)) {
    try {
      return new URL(raw);
    } catch {
      return null;
    }
  }
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(raw)) return new URL(`mailto:${raw}`);
  if (/^\+?[\d\s()/-]{7,}$/.test(raw)) return new URL(`tel:${raw.replace(/[^\d+]/g, "")}`);
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) return null;
    url.protocol = "https:";
    for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
    url.hash = url.hash === "#" ? "" : url.hash;
    return url;
  } catch {
    return null;
  }
}

const host = (url: URL): string => url.hostname.replace(/^(www|m|music|open|on|vm)\./, "");

export function detectLink(input: string): Detection | null {
  const url = normalizeUrl(input);
  if (!url) return null;
  const href = url.toString();

  if (url.protocol === "mailto:") return { type: "link", platform: "email", url: href, label: url.pathname };
  if (url.protocol === "tel:") return { type: "link", platform: "phone", url: href, label: url.pathname };

  const h = host(url);
  const path = url.pathname;
  const segments = path.split("/").filter(Boolean);

  // Music first: music.youtube.com is music, youtube.com is video.
  if (url.hostname === "music.youtube.com") return { type: "music", platform: "youtubemusic", url: href, label: "YouTube Music" };
  if (h === "spotify.com" && ["track", "album", "playlist", "artist", "episode", "show"].includes(segments[0] ?? "")) {
    return { type: "music", platform: "spotify", id: segments[1], url: href, label: "Spotify" };
  }
  if (h === "apple.com" && url.hostname.startsWith("music.")) return { type: "music", platform: "applemusic", url: href, label: "Apple Music" };
  if (h === "soundcloud.com") return { type: "music", platform: "soundcloud", url: href, label: "SoundCloud" };
  if (h === "deezer.com" || h === "deezer.page.link") return { type: "music", platform: "deezer", url: href, label: "Deezer" };
  if (h === "tidal.com") return { type: "music", platform: "tidal", url: href, label: "TIDAL" };
  if (h.endsWith("bandcamp.com")) return { type: "music", platform: "bandcamp", url: href, label: "Bandcamp" };

  if (h === "youtube.com" || h === "youtu.be" || h === "youtube-nocookie.com") {
    if (h === "youtu.be" && segments[0]) return { type: "video", platform: "youtube", id: segments[0], url: href, label: "YouTube" };
    if (segments[0] === "shorts" && segments[1]) return { type: "video", platform: "youtube", id: segments[1], url: href, label: "YouTube Short" };
    const v = url.searchParams.get("v");
    if (v) return { type: "video", platform: "youtube", id: v, url: href, label: "YouTube" };
    if (segments[0]?.startsWith("@") || segments[0] === "channel" || segments[0] === "c") {
      return { type: "shorts", platform: "youtube", id: segments[0].startsWith("@") ? segments[0] : segments[1], url: href, label: "YouTube" };
    }
  }
  if (h === "vimeo.com" && /^\d+$/.test(segments[0] ?? "")) return { type: "video", platform: "vimeo", id: segments[0], url: href, label: "Vimeo" };
  if (h === "tiktok.com") {
    const id = segments[1] === "video" ? segments[2] : undefined;
    return id
      ? { type: "video", platform: "tiktok", id, url: href, label: "TikTok" }
      : { type: "link", platform: "tiktok", url: href, label: "TikTok" };
  }
  if (h === "instagram.com") {
    if (["p", "reel", "reels", "tv"].includes(segments[0] ?? "")) {
      return { type: "video", platform: "instagram", id: segments[1], url: href, label: "Instagram" };
    }
    return { type: "link", platform: "instagram", url: href, label: "Instagram" };
  }
  if (h === "twitch.tv" && segments[0]) return { type: "live", platform: "twitch", id: segments[0], url: href, label: "Twitch" };

  if (h.endsWith("eventbrite.com") || h.endsWith("eventbrite.de")) return { type: "events", platform: "eventbrite", url: href, label: "Eventbrite" };
  if (h.endsWith("eventim.de") || h.endsWith("eventim.com")) return { type: "events", platform: "eventim", url: href, label: "Eventim" };
  if (h.endsWith("ticketmaster.de") || h.endsWith("ticketmaster.com")) return { type: "events", platform: "ticketmaster", url: href, label: "Ticketmaster" };

  if (h === "wa.me" || h === "api.whatsapp.com") return { type: "link", platform: "whatsapp", url: href, label: "WhatsApp" };
  if (h === "t.me") return { type: "link", platform: "telegram", url: href, label: "Telegram" };
  if (h === "x.com" || h === "twitter.com") return { type: "link", platform: "x", url: href, label: "X" };
  if (h === "threads.net" || h === "threads.com") return { type: "link", platform: "threads", url: href, label: "Threads" };
  if (h === "bsky.app") return { type: "link", platform: "bluesky", url: href, label: "Bluesky" };
  if (h === "discord.gg" || h === "discord.com") return { type: "link", platform: "discord", url: href, label: "Discord" };
  if (h === "linkedin.com") return { type: "link", platform: "linkedin", url: href, label: "LinkedIn" };
  if (h === "github.com" && segments[0]) return { type: "link", platform: "github", url: href, label: "GitHub" };

  if (/\.(png|jpe?g|webp|avif|gif)$/i.test(path)) return { type: "image", platform: "image", url: href, label: segments.at(-1) ?? h };
  if (/\.pdf$/i.test(path)) return { type: "link", platform: "pdf", url: href, label: segments.at(-1) ?? "PDF" };
  if (segments[0] === "products" && segments[1]) return { type: "product", platform: "shopify", url: href, label: h };

  return { type: "card", platform: "website", url: href, label: h };
}

/** Bulk add: one detection per URL found in pasted text. */
export function detectMany(text: string): Detection[] {
  const candidates = text.split(/[\s,]+/).filter(Boolean);
  const seen = new Set<string>();
  const result: Detection[] = [];
  for (const candidate of candidates) {
    const detection = detectLink(candidate);
    if (detection && !seen.has(detection.url)) {
      seen.add(detection.url);
      result.push(detection);
    }
  }
  return result;
}
