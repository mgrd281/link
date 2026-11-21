import { hasImage } from "@linkyo/blocks";

import type { Site } from "@/features/account/types";

import { legalStatus } from "../legal";
import type { SiteDoc } from "../site-context";

/** Home's steps to a finished page, in the order they are offered: content first (a page without links has nothing to tap). */
export const HOME_TASKS = ["links", "photo", "bio", "socials", "look", "legal"] as const;
export type HomeTaskKey = (typeof HOME_TASKS)[number];

/** What a link-in-bio page needs before it is worth sharing: something to tap, a face, a line about you. */
export const ESSENTIALS: ReadonlySet<HomeTaskKey> = new Set<HomeTaskKey>(["links", "photo", "bio"]);

/** Which steps are done, from the page as it is now. */
export function homeTasksDone(doc: Pick<SiteDoc, "blocks" | "profile" | "theme">, site: Pick<Site, "legal">): Record<HomeTaskKey, boolean> {
  const contentBlocks = doc.blocks.filter((block) => block.type !== "header" && block.type !== "divider");
  return {
    links: contentBlocks.length >= 3,
    photo: hasImage(doc.profile.avatar) || hasImage(doc.profile.hero),
    bio: doc.profile.bio.trim().length > 0,
    socials: doc.blocks.some((block) => block.type === "socials" && block.items.some((item) => item.url)),
    look: Object.keys(doc.theme).some((key) => key !== "template") || doc.theme.template !== "nocturne",
    legal: legalStatus(site.legal) === "complete",
  };
}

/**
 * Where the page stands. `ready`: the essentials are there, so sharing is Home's primary action.
 * `complete`: every step is done. Home and its section panel both read this, so the panel lists
 * exactly the parts the screen shows.
 */
export function homeProgress(doc: Pick<SiteDoc, "blocks" | "profile" | "theme">, site: Pick<Site, "legal">): { ready: boolean; complete: boolean; done: number; total: number } {
  const tasks = homeTasksDone(doc, site);
  const done = HOME_TASKS.filter((key) => tasks[key]).length;
  return {
    ready: HOME_TASKS.every((key) => tasks[key] || !ESSENTIALS.has(key)),
    complete: done === HOME_TASKS.length,
    done,
    total: HOME_TASKS.length,
  };
}
