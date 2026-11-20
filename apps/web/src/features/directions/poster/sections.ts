import type { Block, BlockOf } from "@linkyo/blocks";

/**
 * Poster pages are read as titled sections. Creators never build containers: a "header" block
 * starts a section, a titled list block (events, shorts, gallery) starts one with its own title,
 * consecutive videos become a swipeable row, consecutive products a two-up grid and consecutive
 * apps one list.
 */
export type RowBlock = BlockOf<"music"> | BlockOf<"card"> | BlockOf<"link">;

export type PosterItem =
  | { kind: "block"; block: Block }
  | { kind: "videos"; blocks: BlockOf<"video">[] }
  | { kind: "products"; blocks: BlockOf<"product">[] }
  /** Consecutive apps: one card, one app per row, like a store's list. */
  | { kind: "apps"; blocks: BlockOf<"app">[] }
  /** Artwork-beside-title cards. Up to RAIL_THRESHOLD - 1 stack; more become a two-row swipe rail. */
  | { kind: "rows"; blocks: RowBlock[] };

/** From this many consecutive media rows on, a section becomes a two-row horizontal rail. */
export const RAIL_THRESHOLD = 4;

/** Blocks shown as a media row: non-featured releases and cards, and links that carry an image. */
export function isRowBlock(block: Block): block is RowBlock {
  if (block.type === "music" || block.type === "card") return !block.highlight;
  return block.type === "link" && block.thumbnail !== undefined;
}

export interface PosterSection {
  /** Stable key: the id of the block that opened the section ("top" before the first title). */
  id: string;
  title: string | null;
  items: PosterItem[];
}

const SELF_TITLED = new Set<Block["type"]>(["events", "shorts", "gallery", "brands"]);

/** The title a block brings for its own section, if any. */
export function selfTitle(block: Block): string | null {
  if (!SELF_TITLED.has(block.type)) return null;
  return "title" in block && typeof block.title === "string" && block.title.trim() ? block.title : null;
}

export function groupSections(blocks: readonly Block[]): PosterSection[] {
  const sections: PosterSection[] = [{ id: "top", title: null, items: [] }];
  for (const block of blocks) {
    if (block.type === "socials") continue; // rendered in the hero
    if (block.type === "header") {
      sections.push({ id: block.id, title: block.title, items: [] });
      continue;
    }
    const ownTitle = selfTitle(block);
    if (ownTitle) {
      sections.push({ id: block.id, title: ownTitle, items: [{ kind: "block", block }] });
      continue;
    }
    const current = sections.at(-1);
    if (!current) continue;
    const last = current.items.at(-1);
    if (block.type === "video") {
      if (last?.kind === "videos") last.blocks.push(block);
      else current.items.push({ kind: "videos", blocks: [block] });
    } else if (block.type === "product") {
      if (last?.kind === "products") last.blocks.push(block);
      else current.items.push({ kind: "products", blocks: [block] });
    } else if (block.type === "app") {
      if (last?.kind === "apps") last.blocks.push(block);
      else current.items.push({ kind: "apps", blocks: [block] });
    } else if (isRowBlock(block)) {
      if (last?.kind === "rows") last.blocks.push(block);
      else current.items.push({ kind: "rows", blocks: [block] });
    } else {
      current.items.push({ kind: "block", block });
    }
  }
  // An empty titled section still renders its title (the creator just added it); an empty top does not.
  return sections.filter((section) => section.items.length > 0 || section.title !== null);
}

/** Where a link leads, shown under its title so visitors know before they tap. */
export function linkDestination(url: string): string {
  if (url.startsWith("mailto:")) return url.slice("mailto:".length);
  if (url.startsWith("tel:")) return url.slice("tel:".length);
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
