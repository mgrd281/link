import { detectLink, type Detection } from "@linkyo/blocks";

import { isProxiedImage } from "@/features/directions/shared/remote-images";

/**
 * Details for a pasted link, so a new block shows the real thing right away: a song's or video's
 * title and picture (the platforms' public oEmbed), an app's name, icon, maker, rating, category and
 * price (Apple's public lookup), a repository's description, stars, language and license (GitHub's
 * API) and a skill's own name and description (its SKILL.md). Only these fixed hosts are asked, never
 * the pasted address itself, so nothing can point this at arbitrary addresses. Pictures are only
 * returned from hosts our image optimizer re-serves. Used by /api/link-metadata (the editor) and by
 * the AI builder (server side, for the links it found).
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
  description?: string;
  /** Apps: the store's average rating (0–5, one decimal), category and price. */
  rating?: number;
  category?: string;
  pricing?: "free" | "paid";
  /** GitHub: stars, main language, license, and whether it is a skill (it has a SKILL.md). */
  stars?: number;
  language?: string;
  license?: string;
  kind?: "skill" | "repo";
}

/** No platform we know serves details for this address. */
export class LinkMetadataUnsupported extends Error {}
/** The platform answered, but has nothing for this address (or refused). */
export class LinkMetadataUnavailable extends Error {}

const text = (value: unknown, max: number): string | undefined => {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
};

async function read(url: string, headers: Record<string, string>): Promise<string> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(3000), next: { revalidate: DAY } });
  if (!response.ok) throw new LinkMetadataUnavailable(String(response.status));
  const body = await response.text();
  if (body.length > MAX_BYTES) throw new LinkMetadataUnavailable("too large");
  return body;
}

async function oembed(detection: Detection, endpoint: (url: string) => string): Promise<LinkMetadataResponse> {
  const data = JSON.parse(await read(endpoint(detection.url), { accept: "application/json" })) as Record<string, unknown>;
  const author = text(data.author_name, 120);
  let title = text(data.title, 200);
  // SoundCloud titles read "Song by Artist"; the artist has its own field.
  if (title && author && title.endsWith(` by ${author}`)) title = title.slice(0, -` by ${author}`.length);
  // YouTube's own thumbnail address is stable; take the large one for video ids we know.
  const thumbnail = detection.platform === "youtube" && detection.type === "video" && detection.id ? `https://i.ytimg.com/vi/${detection.id}/hqdefault.jpg` : text(data.thumbnail_url, 2048);
  const image = thumbnail && isProxiedImage(thumbnail) ? thumbnail : undefined;
  return { ...(title ? { title } : {}), ...(author ? { author } : {}), ...(image ? { image } : {}) };
}

/** Apple's public lookup: the app's name, icon, maker, rating, category and whether it costs money. */
async function appStore(detection: Detection): Promise<LinkMetadataResponse> {
  const country = /^\/([a-z]{2})\//i.exec(new URL(detection.url).pathname)?.[1]?.toLowerCase() ?? "us";
  const data = JSON.parse(await read(`https://itunes.apple.com/lookup?id=${detection.id ?? ""}&country=${country}`, { accept: "application/json" })) as { results?: Record<string, unknown>[] };
  const app = data.results?.[0];
  if (!app) throw new LinkMetadataUnavailable("not found");
  const icon = text(app.artworkUrl512, 2048) ?? text(app.artworkUrl100, 2048);
  const rating = typeof app.averageUserRating === "number" ? Math.round(app.averageUserRating * 10) / 10 : undefined;
  const title = text(app.trackName, 80);
  const author = text(app.sellerName ?? app.artistName, 80);
  const category = text(app.primaryGenreName, 40);
  return {
    ...(title ? { title } : {}),
    ...(author ? { author } : {}),
    ...(icon && isProxiedImage(icon) ? { image: icon } : {}),
    ...(rating !== undefined && rating >= 0 && rating <= 5 ? { rating } : {}),
    ...(category ? { category } : {}),
    ...(typeof app.price === "number" ? { pricing: app.price === 0 ? "free" : "paid" } : {}),
  };
}

/** A skill's name and description from the front matter of its SKILL.md ("name: …", "description: …"). */
export function skillFrontMatter(markdown: string): { name?: string; description?: string } {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)?.[1];
  if (!block) return {};
  const lines = block.split(/\r?\n/);
  const field = (key: string): string | undefined => {
    const index = lines.findIndex((line) => line.startsWith(`${key}:`));
    if (index < 0) return undefined;
    const value = (lines[index] ?? "").slice(key.length + 1).trim();
    // Folded or literal blocks ("description: >") continue on the indented lines below.
    if (/^[>|][+-]?$/.test(value)) {
      const rest: string[] = [];
      for (const line of lines.slice(index + 1)) {
        if (!/^\s/.test(line)) break;
        rest.push(line.trim());
      }
      return rest.join(" ") || undefined;
    }
    return value.replace(/^(["'])([\s\S]*)\1$/, "$2") || undefined;
  };
  const name = field("name");
  const description = field("description");
  return { ...(name ? { name } : {}), ...(description ? { description } : {}) };
}

/** GitHub: the repository's details, and for a skill (a folder with a SKILL.md) its own name and line. */
async function github(detection: Detection): Promise<LinkMetadataResponse> {
  const [owner = "", repo = "", ...folders] = (detection.id ?? "").split("/");
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) throw new LinkMetadataUnavailable("not a repository");
  const token = process.env.GITHUB_TOKEN;
  const data = JSON.parse(
    await read(`https://api.github.com/repos/${owner}/${repo}`, {
      accept: "application/vnd.github+json",
      "user-agent": "Linkyo",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    }),
  ) as Record<string, unknown>;
  const branch = text(data.default_branch, 100) ?? "main";
  const path = folders.filter((folder) => /^[\w.-]+$/.test(folder)).join("/");
  let skill: { name?: string; description?: string } = {};
  try {
    const file = `${path ? `${path}/` : ""}SKILL.md`;
    skill = skillFrontMatter(await read(`https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${file}`, { accept: "text/plain" }));
  } catch {
    // No SKILL.md there: a plain repository.
  }
  const license = data.license && typeof data.license === "object" ? text((data.license as Record<string, unknown>).spdx_id, 40) : undefined;
  const title = text(skill.name, 80) ?? (path ? text(path.split("/").at(-1), 80) : text(data.name, 80));
  const description = text(skill.description ?? data.description, 240);
  const language = text(data.language, 40);
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(typeof data.stargazers_count === "number" ? { stars: data.stargazers_count } : {}),
    ...(language ? { language } : {}),
    ...(license && license !== "NOASSERTION" ? { license } : {}),
    kind: skill.name || skill.description ? "skill" : "repo",
  };
}

/**
 * The details of a link from its platform. Throws `LinkMetadataUnsupported` when no platform we know
 * has details for it, `LinkMetadataUnavailable` when the platform has none, and any other error when
 * the platform did not answer (down, timed out).
 */
export async function lookupLinkMetadata(url: string): Promise<LinkMetadataResponse> {
  const detection = url.length <= 2048 ? detectLink(url) : null;
  const endpoint = detection?.platform ? OEMBED[detection.platform] : undefined;
  if (detection?.type === "app" && detection.platform === "appstore" && detection.id) return appStore(detection);
  if (detection?.type === "repo") return github(detection);
  if (detection && endpoint) return oembed(detection, endpoint);
  throw new LinkMetadataUnsupported("no platform for this address");
}
