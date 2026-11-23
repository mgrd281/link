import type { Page } from "@linkyo/blocks";

/**
 * Pictures that still sit inside a page as data URLs (pages imported from the demo, the photo of the
 * "Try it" draft) move to Storage on the next save of a real account. Pure: the uploader is passed in,
 * so the same code runs in the store and in tests.
 */

/** Data URLs Storage takes (the `media` bucket's types); anything else stays as it is. */
const STORABLE = /^data:image\/(?:jpeg|png|webp);base64,/;

export const isStorableDataUrl = (src: string): boolean => STORABLE.test(src);

/** Calls `visit` with every picture source of the page (profile pictures and every block's pictures). */
function forEachSource(page: Page, visit: (src: string) => void): void {
  mapSources(page, (src) => {
    visit(src);
    return src;
  });
}

/** A copy of the page with every picture source passed through `map`. */
export function mapSources(page: Page, map: (src: string) => string): Page {
  const image = <T extends { src: string }>(value: T): T => {
    const src = map(value.src);
    return src === value.src ? value : { ...value, src };
  };
  const { profile } = page;
  const nextProfile: Page["profile"] = { ...profile, avatar: image(profile.avatar) };
  if (profile.hero) nextProfile.hero = image(profile.hero);
  if (profile.logo) nextProfile.logo = image(profile.logo);
  const blocks = page.blocks.map((block) => {
    switch (block.type) {
      case "link":
        return block.thumbnail ? { ...block, thumbnail: image(block.thumbnail) } : block;
      case "card":
      case "image":
      case "product":
        return { ...block, image: image(block.image) };
      case "gallery":
        return { ...block, images: block.images.map(image) };
      case "video":
        return { ...block, poster: image(block.poster) };
      case "shorts":
        return { ...block, items: block.items.map((item) => ({ ...item, poster: image(item.poster) })) };
      case "music":
        return { ...block, cover: image(block.cover) };
      case "events":
        return { ...block, items: block.items.map((item) => (item.image ? { ...item, image: image(item.image) } : item)) };
      case "brands":
        return { ...block, items: block.items.map((item) => (item.logo ? { ...item, logo: image(item.logo) } : item)) };
      case "app":
        return { ...block, icon: image(block.icon) };
      case "project": {
        const next = { ...block };
        if (block.cover) next.cover = image(block.cover);
        if (block.pictures) next.pictures = block.pictures.map((picture) => ({ ...picture, image: image(picture.image) }));
        return next;
      }
      case "about":
        return block.portrait ? { ...block, portrait: image(block.portrait) } : block;
      case "quotes":
        return { ...block, items: block.items.map((item) => (item.photo ? { ...item, photo: image(item.photo) } : item)) };
      // No `default`: a new block type must be listed here, with or without pictures, or this
      // function does not compile. A picture-bearing block skipped in silence would keep its data
      // URL in the page for good.
      case "header":
      case "text":
      case "divider":
      case "socials":
      case "newsletter":
      case "repo":
      case "live":
      case "tools":
      case "timeline":
      case "contact":
        return block;
    }
  });
  return { profile: nextProfile, blocks };
}

/** Every distinct data URL on the page that can go to Storage. */
export function collectDataUrls(page: Page): string[] {
  const found = new Set<string>();
  forEachSource(page, (src) => {
    if (isStorableDataUrl(src)) found.add(src);
  });
  return [...found];
}

export const hasDataUrls = (page: Page): boolean => collectDataUrls(page).length > 0;

/** The page with the data URLs that have an uploaded address replaced by it. */
export const replaceSources = (page: Page, uploaded: ReadonlyMap<string, string>): Page => mapSources(page, (src) => uploaded.get(src) ?? src);

/**
 * Uploads every data URL of the page (at most `parallel` at a time) and answers the page with their
 * addresses. A picture whose upload fails keeps its data URL and is tried again on the next save.
 * `uploaded` remembers what went up already, so a picture is never uploaded twice.
 */
export async function migrateDataUrls(
  page: Page,
  upload: (dataUrl: string) => Promise<string>,
  { parallel = 3, uploaded = new Map<string, string>() }: { parallel?: number; uploaded?: Map<string, string> } = {},
): Promise<Page> {
  const queue = collectDataUrls(page).filter((src) => !uploaded.has(src));
  const worker = async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      try {
        uploaded.set(next, await upload(next));
      } catch {
        // Kept as a data URL; the next save tries again.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, worker));
  return replaceSources(page, uploaded);
}
