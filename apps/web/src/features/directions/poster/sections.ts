import type { Block, BlockOf } from "@linkyo/blocks";

/**
 * Poster pages are read as titled sections. Creators never build containers: a "header" block
 * starts a section, a titled list block (events, shorts, gallery) starts one with its own title,
 * consecutive videos become a swipeable row and consecutive products a two-up grid.
 */
export type PosterItem =
  | { kind: "block"; block: Block }
  | { kind: "videos"; blocks: BlockOf<"video">[] }
  | { kind: "products"; blocks: BlockOf<"product">[] };

export interface PosterSection {
  /** Stable key: the id of the block that opened the section ("top" before the first title). */
  id: string;
  title: string | null;
  items: PosterItem[];
}

const SELF_TITLED = new Set<Block["type"]>(["events", "shorts", "gallery"]);

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
