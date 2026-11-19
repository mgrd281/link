import { detectLink } from "@linkyo/blocks";
import { NextResponse, type NextRequest } from "next/server";

import { isProxiedImage } from "@/features/directions/shared/remote-images";

/**
 * Title, author and picture for a pasted link, so a new block shows the real song or video right
 * away. Only the platforms' public oEmbed endpoints are asked (fixed hosts, no keys), so this can't
 * be pointed at arbitrary addresses. The creator's browser asks us, never the platform; pictures are
 * only returned from hosts our image optimizer re-serves.
 */
const OEMBED: Partial<Record<string, (url: string) => string>> = {
  youtube: (url) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  youtubemusic: (url) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url.replace("music.youtube.com", "www.youtube.com"))}`,
  spotify: (url) => `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
  vimeo: (url) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
  soundcloud: (url) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  tiktok: (url) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
};

const MAX_BYTES = 200_000;
const DAY = 86_400;

export interface LinkMetadataResponse {
  title?: string;
  author?: string;
  image?: string;
}

const text = (value: unknown, max: number): string | undefined => {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean && clean.length <= max ? clean : undefined;
};

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url") ?? "";
  const detection = raw.length <= 2048 ? detectLink(raw) : null;
  const endpoint = detection?.platform ? OEMBED[detection.platform] : undefined;
  if (!detection || !endpoint) return NextResponse.json({}, { status: 422 });

  try {
    const response = await fetch(endpoint(detection.url), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(3000),
      next: { revalidate: DAY },
    });
    if (!response.ok) return NextResponse.json({}, { status: 404 });
    const body = await response.text();
    if (body.length > MAX_BYTES) return NextResponse.json({}, { status: 502 });
    const data = JSON.parse(body) as Record<string, unknown>;

    const author = text(data.author_name, 120);
    let title = text(data.title, 200);
    // SoundCloud titles read "Song by Artist"; the artist has its own field.
    if (title && author && title.endsWith(` by ${author}`)) title = title.slice(0, -` by ${author}`.length);
    // YouTube's own thumbnail address is stable; take the large one for video ids we know.
    const thumbnail = detection.platform === "youtube" && detection.type === "video" && detection.id ? `https://i.ytimg.com/vi/${detection.id}/hqdefault.jpg` : text(data.thumbnail_url, 2048);
    const image = thumbnail && isProxiedImage(thumbnail) ? thumbnail : undefined;

    const result: LinkMetadataResponse = { ...(title ? { title } : {}), ...(author ? { author } : {}), ...(image ? { image } : {}) };
    return NextResponse.json(result, { headers: { "cache-control": `public, max-age=3600, s-maxage=${DAY}` } });
  } catch {
    return NextResponse.json({}, { status: 504 });
  }
}
