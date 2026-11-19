import { hasImage, type Block } from "@linkyo/blocks";

/** What /api/link-metadata knows about a pasted link. */
export interface LinkMetadata {
  title?: string;
  author?: string;
  image?: string;
}

/** The address whose details a new block can use: a video's page, or a release's first link. */
export function metadataUrl(block: Block): string | null {
  if (block.type === "video") return block.provider === "upload" ? null : block.url;
  if (block.type === "music") return block.links[0]?.url ?? null;
  return null;
}

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
