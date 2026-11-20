import { hasImage, type Block } from "@linkyo/blocks";

/** What /api/link-metadata knows about a pasted link (see LinkMetadataResponse in the route). */
export interface LinkMetadata {
  title?: string;
  author?: string;
  image?: string;
  description?: string;
  rating?: number;
  category?: string;
  pricing?: "free" | "paid";
  stars?: number;
  language?: string;
  license?: string;
  kind?: "skill" | "repo";
}

/**
 * The address whose details a new block can use: a video's page, a release's first link, an app's
 * App Store page (Apple has a public lookup; Google Play has none), or a repository on GitHub.
 */
export function metadataUrl(block: Block): string | null {
  if (block.type === "video") return block.provider === "upload" ? null : block.url;
  if (block.type === "music") return block.links[0]?.url ?? null;
  if (block.type === "app") return block.stores.find((store) => store.store === "appstore")?.url ?? null;
  if (block.type === "repo") return block.url;
  return null;
}

/** The skills CLI's command: the whole repository, or one skill from it by its name. */
export const installCommand = (owner: string, repo: string, skill?: string): string => `npx skills add ${owner}/${repo}${skill ? ` --skill ${skill}` : ""}`;

/** A skill's name as skill files spell it: lowercase letters, digits and hyphens. */
const SKILL_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** YouTube's auto-generated artist channels are called "Artist - Topic". */
const artistName = (author: string) => author.replace(/ - Topic$/, "");

/**
 * Fields to fill in from the details, only where the block still shows what it had when it was
 * added: anything the creator changed in the meantime stays as they wrote it.
 */
export function metadataPatch(current: Block, added: Block, meta: LinkMetadata): Partial<Block> | null {
  const patch: Record<string, unknown> = {};
  if (current.type === "video" && added.type === "video") {
    if (meta.title && current.title === added.title) patch.title = meta.title;
    if (meta.image && current.poster.src === added.poster.src) patch.poster = { src: meta.image, alt: "" };
  } else if (current.type === "music" && added.type === "music") {
    if (meta.title && current.title === added.title) patch.title = meta.title;
    if (meta.author && current.artist === added.artist) patch.artist = artistName(meta.author);
    if (meta.image && (current.cover.src === added.cover.src || !hasImage(current.cover))) patch.cover = { src: meta.image, alt: "" };
  } else if (current.type === "app" && added.type === "app") {
    if (meta.title && current.title === added.title) patch.title = meta.title;
    if (meta.author && !current.developer) patch.developer = meta.author;
    if (meta.image && !hasImage(current.icon)) patch.icon = { src: meta.image, alt: "" };
    if (meta.rating !== undefined && current.rating === undefined) patch.rating = meta.rating;
    if (meta.category && !current.category) patch.category = meta.category;
    if (meta.pricing && !current.pricing) patch.pricing = meta.pricing;
  } else if (current.type === "repo" && added.type === "repo") {
    if (meta.title && current.title === added.title) patch.title = meta.title;
    if (meta.description && !current.description) patch.description = meta.description;
    if (meta.stars !== undefined) patch.stars = meta.stars;
    if (meta.language && !current.language) patch.language = meta.language;
    if (meta.license && !current.license) patch.license = meta.license;
    if (meta.kind && current.kind === added.kind) patch.kind = meta.kind;
    // A skill is installed by its own name: keep the suggested command in step with it (only a name
    // the command line takes as it is; "Brand Voice" would need quotes, so the folder's name stays).
    if (meta.kind === "skill" && meta.title && SKILL_NAME.test(meta.title) && current.path && current.install === added.install) {
      patch.install = installCommand(current.owner, current.repo, meta.title);
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata | null> {
  try {
    const response = await fetch(`/api/link-metadata?url=${encodeURIComponent(url)}`);
    if (!response.ok) return null;
    return (await response.json()) as LinkMetadata;
  } catch {
    return null;
  }
}
