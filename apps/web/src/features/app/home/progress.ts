import { hasImage } from "@linkyo/blocks/rules";

import type { Site } from "@/features/account/types";

import { isPortfolioKind, type CreatorKind } from "../kinds";
import { legalStatus } from "../legal";
import type { SiteDoc } from "../site-context";

/** Home's steps to a finished page, in the order they are offered: content first (a page without links has nothing to tap). */
export const HOME_TASKS = ["links", "photo", "bio", "socials", "look", "legal"] as const;

/**
 * A page that shows work (designer, photographer, developer …) gets its own first steps instead of
 * "3 things": three pieces of work, then the one way clients reach you. Both used to be a second
 * next step of their own beside the checklist; now Home always shows exactly one.
 */
export const PORTFOLIO_TASKS = ["projects", "contact", "photo", "bio", "look", "legal"] as const;

export type HomeTaskKey = (typeof HOME_TASKS)[number] | (typeof PORTFOLIO_TASKS)[number];

/** What a page needs before it is worth sharing: something to tap (or work to see), a face, a line about you. */
export const ESSENTIALS: ReadonlySet<HomeTaskKey> = new Set<HomeTaskKey>(["links", "photo", "bio"]);
/** A portfolio also needs the way to reach its owner before it is worth sharing. */
export const PORTFOLIO_ESSENTIALS: ReadonlySet<HomeTaskKey> = new Set<HomeTaskKey>(["projects", "contact", "photo", "bio"]);

/** How many pieces of work make a portfolio worth showing ("Show three pieces of work"). */
export const PORTFOLIO_PROJECTS = 3;

type HomeSite = Pick<Site, "legal" | "kind">;

const portfolioPage = (site: HomeSite): boolean => isPortfolioKind(site.kind as CreatorKind | undefined);

/** The steps this page is offered, in order: by its kind (chosen in the welcome flow). */
export function homeTasks(site: HomeSite): readonly HomeTaskKey[] {
  return portfolioPage(site) ? PORTFOLIO_TASKS : HOME_TASKS;
}

/** Which steps are done, from the page as it is now (every step, whichever list the page is offered). */
export function homeTasksDone(doc: Pick<SiteDoc, "blocks" | "profile" | "theme">, site: Pick<Site, "legal">): Record<HomeTaskKey, boolean> {
  const contentBlocks = doc.blocks.filter((block) => block.type !== "header" && block.type !== "divider");
  return {
    links: contentBlocks.length >= 3,
    projects: doc.blocks.filter((block) => block.type === "project").length >= PORTFOLIO_PROJECTS,
    contact: doc.blocks.some((block) => block.type === "contact"),
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
export function homeProgress(doc: Pick<SiteDoc, "blocks" | "profile" | "theme">, site: HomeSite): { ready: boolean; complete: boolean; done: number; total: number } {
  const tasks = homeTasksDone(doc, site);
  const keys = homeTasks(site);
  const essentials = portfolioPage(site) ? PORTFOLIO_ESSENTIALS : ESSENTIALS;
  const done = keys.filter((key) => tasks[key]).length;
  return {
    ready: keys.every((key) => tasks[key] || !essentials.has(key)),
    complete: done === keys.length,
    done,
    total: keys.length,
  };
}

/**
 * What "3 things" suggests, by the kind of page: a musician's latest song, a shop's products, a
 * coach's offer. Pages without a kind get the general line. A key under app.home.checklist.linkHints.
 */
export type LinkHint = "music" | "podcast" | "video" | "sell" | "business" | "apps" | "work" | "other";

const LINK_HINTS: Partial<Record<CreatorKind, LinkHint>> = {
  music: "music",
  podcast: "podcast",
  tiktok: "video",
  instagram: "video",
  youtube: "video",
  streamer: "video",
  apps: "apps",
  affiliate: "sell",
  store: "sell",
  shop: "sell",
  warehouse: "sell",
  business: "business",
  marketing: "business",
  coach: "business",
  lawyer: "business",
  writer: "work",
  journalist: "work",
  student: "work",
};

export const linkHint = (kind: string | undefined): LinkHint => (kind && Object.hasOwn(LINK_HINTS, kind) ? (LINK_HINTS[kind as CreatorKind] ?? "other") : "other");
