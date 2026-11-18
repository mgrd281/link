import type { Block } from "@linkyo/blocks";

/** Which companies' players a page can load (used on the server to decide on the privacy notice). */
const PROVIDERS: [RegExp, string][] = [
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)vimeo\.com$/, "Vimeo"],
];
const NAMES: Record<string, string> = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", vimeo: "Vimeo" };

/** The company behind a player link ("YouTube", "TikTok" …), or null. */
export const providerOf = (url: string): string | null => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return PROVIDERS.find(([pattern]) => pattern.test(host))?.[1] ?? null;
  } catch {
    return null;
  }
};

/** The companies whose players this page can load (in page order, each once). */
export function externalProviders(blocks: readonly Block[]): string[] {
  const names = blocks.flatMap((block) => {
    // A video that opens on the platform loads nothing on the page.
    if (block.type === "video") return block.provider === "upload" || block.playback === "external" ? [] : [NAMES[block.provider] ?? block.provider];
    if (block.type === "shorts") return block.items.map((item) => providerOf(item.url)).filter((name): name is string => name !== null);
    return [];
  });
  return [...new Set(names)];
}

/** The video ID of a YouTube link (watch, youtu.be, shorts or embed), or null. */
export function youtubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^(www|m)\./, "");
    const id =
      host === "youtu.be"
        ? parsed.pathname.slice(1)
        : host === "youtube.com" || host === "youtube-nocookie.com"
          ? (parsed.searchParams.get("v") ?? /^\/(?:shorts|embed|live)\/([^/?#]+)/.exec(parsed.pathname)?.[1] ?? "")
          : "";
    return /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Seconds a preview plays on the page before visitors continue on the platform. */
export const PREVIEW_SECONDS = 30;

/** Where to keep watching a YouTube video, from a given second on. */
export const youtubeWatchUrl = (id: string, from = 0): string => `https://www.youtube.com/watch?v=${id}${from > 0 ? `&t=${from}s` : ""}`;

/**
 * Whether a message from YouTube's embedded player says the video has ended. The player reports its
 * state as {"event":"onStateChange","info":0} or {"event":"infoDelivery","info":{"playerState":0}}.
 */
export function youtubeEnded(data: unknown): boolean {
  let message: unknown = data;
  if (typeof data === "string") {
    try {
      message = JSON.parse(data);
    } catch {
      return false;
    }
  }
  if (typeof message !== "object" || message === null) return false;
  const { event, info } = message as { event?: unknown; info?: unknown };
  if (event === "onStateChange") return info === 0;
  if (event === "infoDelivery" && typeof info === "object" && info !== null) return (info as { playerState?: unknown }).playerState === 0;
  return false;
}
