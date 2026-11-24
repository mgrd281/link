import { detectMany, hasImage, slugFor, type Block, type BlockOf, type CreatorKind, type LinkIcon, type Platform } from "@linkyo/blocks";
import { creatorTokens, type CreatorTemplateId } from "@linkyo/tokens";
import { suggestedTemplates, type CreatorThemeConfig } from "@linkyo/tokens/creator";

import { blockFromLink, newBlockId } from "./blocks";

// What kind of page someone is making: the list moved to @linkyo/blocks (the AI page plan offers the
// same kinds); re-exported here so every importer keeps working.
export { KINDS, isKind, type CreatorKind } from "@linkyo/blocks";

/** Profiles asked for in the welcome flow, with what goes in front of the handle. */
export const SOCIAL_PREFIX = {
  instagram: "instagram.com/",
  tiktok: "tiktok.com/@",
  youtube: "youtube.com/@",
  spotify: "open.spotify.com/artist/",
  x: "x.com/",
  threads: "threads.net/@",
  linkedin: "linkedin.com/in/",
  facebook: "facebook.com/",
  whatsapp: "wa.me/",
  github: "github.com/",
  twitch: "twitch.tv/",
  discord: "discord.gg/",
} as const satisfies Partial<Record<Platform, string>>;
export type SocialPlatform = keyof typeof SOCIAL_PREFIX;

/**
 * Questions beyond profiles; each one that is answered becomes a block on the page. `proof` (up to
 * three pieces of work) and `action` (one way to be reached) are steps of their own in the welcome flow.
 */
export type StarterField =
  | "address"
  | "phone"
  | "hours"
  | "shopUrl"
  | "website"
  | "booking"
  | "email"
  | "book"
  | "cv"
  | "newsletter"
  | "tiktokLive"
  | "affiliate"
  | "proof"
  | "action";

export interface Starter {
  theme: CreatorThemeConfig;
  socials: readonly SocialPlatform[];
  fields: readonly StarterField[];
  /** Businesses lead with a logo; people with a portrait. */
  logoFirst: boolean;
}

export const STARTERS: Record<CreatorKind, Starter> = {
  tiktok: { theme: { template: "pulse" }, socials: ["tiktok", "instagram", "youtube"], fields: ["tiktokLive"], logoFirst: false },
  instagram: { theme: { template: "daylight" }, socials: ["instagram", "tiktok", "threads"], fields: [], logoFirst: false },
  youtube: { theme: { template: "nocturne" }, socials: ["youtube", "instagram", "tiktok"], fields: [], logoFirst: false },
  // App tips: the apps from the videos as a store-like list (pasted store links become app cards).
  apps: { theme: { template: "aura", accent: creatorTokens.swatches.sky }, socials: ["tiktok", "instagram", "youtube"], fields: [], logoFirst: false },
  writer: { theme: { template: "atelier" }, socials: ["instagram", "x", "threads"], fields: ["book", "newsletter"], logoFirst: false },
  journalist: { theme: { template: "atelier", pairing: "editorial" }, socials: ["x", "linkedin", "instagram"], fields: ["email"], logoFirst: false },
  business: { theme: { template: "daylight", pairing: "modern" }, socials: ["linkedin", "instagram", "whatsapp"], fields: ["website", "booking", "email"], logoFirst: true },
  shop: { theme: { template: "marquee" }, socials: ["instagram", "facebook", "whatsapp"], fields: ["address", "phone", "hours"], logoFirst: true },
  store: { theme: { template: "marquee", pairing: "bold" }, socials: ["instagram", "tiktok", "facebook"], fields: ["shopUrl"], logoFirst: true },
  // Portfolio kinds open with their work on a wide-canvas template (lead decision G2, reversible):
  // engineers and developers on Tiefdruck, designers, photographers and freelancers on Werkbogen.
  engineer: { theme: { template: "tiefdruck" }, socials: ["linkedin", "x", "instagram"], fields: ["proof", "action", "cv"], logoFirst: false },
  lawyer: { theme: { template: "atelier", pairing: "classic" }, socials: ["linkedin", "facebook", "whatsapp"], fields: ["booking", "phone", "email", "address"], logoFirst: false },
  student: { theme: { template: "pulse", pairing: "modern" }, socials: ["instagram", "linkedin", "tiktok"], fields: ["cv", "email"], logoFirst: false },
  warehouse: { theme: { template: "daylight", pairing: "modern" }, socials: ["linkedin", "whatsapp", "facebook"], fields: ["cv", "phone", "email"], logoFirst: false },
  music: { theme: { template: "nocturne" }, socials: ["spotify", "instagram", "tiktok", "youtube"], fields: [], logoFirst: false },
  streamer: { theme: { template: "nocturne", pairing: "tech" }, socials: ["twitch", "discord", "youtube", "tiktok"], fields: [], logoFirst: false },
  podcast: { theme: { template: "atelier", pairing: "editorial" }, socials: ["instagram", "youtube", "tiktok"], fields: ["newsletter"], logoFirst: false },
  // Affiliate links must be recognisable as advertising (UWG § 5a, MStV § 22): the switch labels them.
  affiliate: { theme: { template: "daylight", pairing: "modern", buttonStyle: "shadow" }, socials: ["instagram", "tiktok", "youtube"], fields: ["affiliate", "newsletter"], logoFirst: false },
  marketing: { theme: { template: "daylight", pairing: "modern", buttonShape: "pill" }, socials: ["linkedin", "instagram", "x"], fields: ["booking", "website", "newsletter", "email"], logoFirst: false },
  coach: { theme: { template: "daylight", pairing: "elegant" }, socials: ["instagram", "linkedin", "youtube"], fields: ["booking", "newsletter", "email"], logoFirst: false },
  developer: { theme: { template: "tiefdruck" }, socials: ["github", "linkedin", "x"], fields: ["proof", "action", "cv"], logoFirst: false },
  designer: { theme: { template: "werkbogen" }, socials: ["instagram", "linkedin", "threads"], fields: ["proof", "action"], logoFirst: false },
  photographer: { theme: { template: "werkbogen" }, socials: ["instagram", "linkedin", "youtube"], fields: ["proof", "action"], logoFirst: false },
  freelancer: { theme: { template: "werkbogen" }, socials: ["linkedin", "instagram", "whatsapp"], fields: ["proof", "action"], logoFirst: false },
  other: { theme: { template: "nocturne" }, socials: ["instagram", "tiktok", "youtube"], fields: [], logoFirst: false },
};

/** Kinds whose page is a portfolio: the welcome flow asks them for their work and one way to reach them. */
export const PORTFOLIO_KINDS = ["designer", "photographer", "developer", "engineer", "freelancer"] as const satisfies readonly CreatorKind[];
export const isPortfolioKind = (kind: CreatorKind | undefined): boolean => kind !== undefined && (PORTFOLIO_KINDS as readonly CreatorKind[]).includes(kind);

/** The welcome flow's steps. Portfolio kinds are asked for their work and one way to reach them instead of links. */
export const WELCOME_STEPS = ["kind", "you", "look", "links", "done"] as const;
export const PORTFOLIO_STEPS = ["kind", "you", "look", "proof", "action", "done"] as const;
export type WelcomeStep = (typeof WELCOME_STEPS)[number] | (typeof PORTFOLIO_STEPS)[number];

/** The steps for a kind (no kind chosen yet: the general ones). */
export const welcomeSteps = (kind: CreatorKind | null | undefined): readonly WelcomeStep[] =>
  kind !== null && kind !== undefined && isPortfolioKind(kind) ? PORTFOLIO_STEPS : WELCOME_STEPS;

/**
 * The questions a kind is asked. Real accounts have no newsletter yet (the Add sheet does not offer
 * it and public pages leave it out), so they are not asked for one.
 */
export const starterFields = (kind: CreatorKind, offers: { newsletter: boolean }): StarterField[] =>
  STARTERS[kind].fields.filter((field) => field !== "newsletter" || offers.newsletter);

/**
 * The order of the look step: the kind's starter first, then the templates the tokens suggest for
 * the kind (`suggestFor`); the picker puts every other look after them. Data-driven, so a new
 * template that names a kind is offered to it first without code.
 */
export function lookOrder(kind: CreatorKind): CreatorTemplateId[] {
  const starter = STARTERS[kind].theme.template;
  return [...new Set([...(starter ? [starter] : []), ...suggestedTemplates(kind)])];
}

/** A default section title: a message key under `app.portfolio` ("titles.work.designer"). */
export type TitleKey<Section extends string, Variant extends string> = `titles.${Section}.${Variant}`;
export interface TitleKeys {
  work: TitleKey<"work", "default" | "designer" | "developer" | "writer" | "coach" | "lawyer">;
  tools: TitleKey<"tools", "default" | "designer" | "developer" | "lawyer" | "writer">;
  quotes: TitleKey<"quotes", "default" | "developer">;
  timeline: TitleKey<"timeline", "default">;
  about: TitleKey<"about", "default">;
  clients: TitleKey<"clients", "default">;
}

const WORK_TITLES: Partial<Record<CreatorKind, TitleKeys["work"]>> = {
  designer: "titles.work.designer",
  photographer: "titles.work.designer",
  developer: "titles.work.developer",
  engineer: "titles.work.developer",
  student: "titles.work.developer",
  writer: "titles.work.writer",
  journalist: "titles.work.writer",
  coach: "titles.work.coach",
  lawyer: "titles.work.lawyer",
};
const TOOLS_TITLES: Partial<Record<CreatorKind, TitleKeys["tools"]>> = {
  designer: "titles.tools.designer",
  photographer: "titles.tools.designer",
  developer: "titles.tools.developer",
  engineer: "titles.tools.developer",
  lawyer: "titles.tools.lawyer",
  writer: "titles.tools.writer",
  journalist: "titles.tools.writer",
};
const QUOTES_TITLES: Partial<Record<CreatorKind, TitleKeys["quotes"]>> = {
  developer: "titles.quotes.developer",
  engineer: "titles.quotes.developer",
};

/**
 * The default section titles of a kind's page, as message keys under `app.portfolio`: a designer
 * shows "Work", a developer "Projects", a coach "Client stories". Prefilled into a section's title
 * (or the header before the first project) and always editable. The one place that maps a kind to
 * its titles: the welcome flow and the AI builder both read it.
 */
export function titleKeys(kind: CreatorKind | undefined): TitleKeys {
  return {
    work: (kind && WORK_TITLES[kind]) ?? "titles.work.default",
    tools: (kind && TOOLS_TITLES[kind]) ?? "titles.tools.default",
    quotes: (kind && QUOTES_TITLES[kind]) ?? "titles.quotes.default",
    timeline: "titles.timeline.default",
    about: "titles.about.default",
    clients: "titles.clients.default",
  };
}

/** A handle, @handle, phone number or full link → the profile URL. */
export function socialUrl(platform: SocialPlatform, value: string): string | null {
  const raw = value.trim().replace(/^@/, "");
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (platform === "whatsapp") {
    const digits = raw.replace(/[^\d]/g, "");
    return digits.length >= 6 ? `https://wa.me/${digits}` : null;
  }
  return `https://${SOCIAL_PREFIX[platform]}${raw}`;
}

const withScheme = (value: string) => (/^https?:\/\//i.test(value) ? value : `https://${value}`);
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** A picture as the welcome flow keeps it (what `storedImage` returns, with its description). */
export interface ProofCover {
  src: string;
  alt: string;
  tone?: "light" | "dark" | undefined;
  focal?: [number, number] | undefined;
  w?: number | undefined;
  h?: number | undefined;
}

/** One of the pieces of work a portfolio kind is asked for: a title, one sentence and, if they like, a cover. */
export interface ProofRow {
  title: string;
  summary: string;
  cover?: ProofCover | undefined;
}

/** A project's limits (the schema's), so a field lets through only what the page can keep. */
export const PROOF_TITLE_MAX = 60;
export const PROOF_SUMMARY_MAX = 140;

/**
 * What a piece of work still needs before it can become a project: nothing when it was left empty
 * (every question is optional), else a title and a sentence (every project card shows both).
 */
export function proofProblem(row: ProofRow): "title" | "summary" | null {
  const started = row.title.trim() !== "" || row.summary.trim() !== "" || hasImage(row.cover);
  if (!started) return null;
  if (!row.title.trim()) return "title";
  if (!row.summary.trim()) return "summary";
  return null;
}

/** The page's one button, as the reach field returns it (`ReachInput`). */
export interface StarterReach {
  label: string;
  url: string;
  icon?: LinkIcon | undefined;
}

export interface StarterInput {
  kind: CreatorKind;
  handles: Partial<Record<SocialPlatform, string>>;
  values: Partial<Record<StarterField, string>>;
  switches: Partial<Record<StarterField, boolean>>;
  links: string;
  /** Portfolio kinds: the pieces of work, made into projects under the kind's work title. */
  proof?: readonly ProofRow[] | undefined;
  /** Portfolio kinds: the page's one button, made into the contact block that closes the page. */
  reach?: StarterReach | undefined;
  /** Project addresses the page already uses (current and earlier ones): new ones never repeat them. */
  taken?: readonly string[] | undefined;
  /** The word a project address falls back to when its title has no Latin letters (`slugWord`). */
  slugWord?: string | undefined;
  /** False for real accounts: no newsletter block is made (see `starterFields`). */
  newsletter?: boolean | undefined;
}

export interface StarterLabels {
  directions: (address: string) => string;
  call: string;
  hours: string;
  shop: string;
  website: string;
  booking: string;
  contact: string;
  book: string;
  cv: string;
  newsletter: string;
  liveTitle: string;
  detection: { video: string; music: string; event: string };
  artist: string;
  /** The title over a portfolio's work (`titleKeys(kind).work`: "Arbeiten", "Projekte" …). */
  work: string;
  /** The contact block's closing line. */
  closing: string;
}

/**
 * Turns the welcome answers into the first blocks of the page: profiles on top, then the one action
 * that matters most for this kind (directions for a shop, the shop for a store, booking for a
 * business), then pasted links as the right blocks. A portfolio kind's page opens with its work
 * (the kind's work title over the projects) and is closed by its contact block, which also takes a
 * CV. A piece of work without a title or a sentence is left out: the flow asks for both before it
 * goes on (`proofProblem`), so nothing typed is lost.
 */
export function starterBlocks(input: StarterInput, labels: StarterLabels): Block[] {
  const starter = STARTERS[input.kind];
  const fields = starterFields(input.kind, { newsletter: input.newsletter ?? true });
  const base = (type: string) => ({ id: newBlockId(type), visible: true, highlight: false });
  const link = (title: string, url: string, highlight = false, icon?: LinkIcon): BlockOf<"link"> => ({
    ...base("link"),
    type: "link",
    title: title.slice(0, 120),
    url,
    highlight,
    ...(icon ? { icon } : {}),
  });
  const value = (field: StarterField) => input.values[field]?.trim() ?? "";
  const blocks: Block[] = [];

  const items = starter.socials.flatMap((platform) => {
    const url = socialUrl(platform, input.handles[platform] ?? "");
    return url ? [{ platform, url }] : [];
  });
  if (items.length) blocks.push({ ...base("socials"), type: "socials", items });

  // Portfolio kinds: the page's one button is the contact block, which closes the page after
  // everything else; a CV becomes one of its other ways.
  const reachUrl = input.reach?.url.trim() ?? "";
  const reachLabel = input.reach?.label.trim().slice(0, 40) ?? "";
  const reachIcon = input.reach?.icon;
  const contact: BlockOf<"contact"> | null =
    fields.includes("action") && reachUrl && reachLabel
      ? { ...base("contact"), type: "contact", title: labels.closing.slice(0, 80), primary: { label: reachLabel, url: reachUrl, ...(reachIcon ? { icon: reachIcon } : {}) } }
      : null;
  const contactWays: NonNullable<BlockOf<"contact">["links"]> = [];
  for (const field of fields) {
    const text = value(field);
    switch (field) {
      case "proof": {
        const taken = new Set(input.taken ?? []);
        const projects = (input.proof ?? []).flatMap((row): BlockOf<"project">[] => {
          const title = row.title.trim().slice(0, PROOF_TITLE_MAX);
          const summary = row.summary.trim().replace(/\s+/g, " ").slice(0, PROOF_SUMMARY_MAX);
          if (!title || !summary) return [];
          const slug = slugFor(title, taken, input.slugWord ?? "project");
          taken.add(slug);
          const cover = row.cover !== undefined && hasImage(row.cover) ? { cover: row.cover } : {};
          return [{ ...base("project"), type: "project", slug, title, summary, ...cover }];
        });
        if (projects.length) blocks.push({ ...base("header"), type: "header", title: labels.work.slice(0, 80) }, ...projects);
        break;
      }
      case "action":
        // Made above: it closes the page, so it is added last.
        break;
      case "address":
        if (text) blocks.push(link(labels.directions(text), `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`, true, "map"));
        break;
      case "phone": {
        const phone = text.replace(/[^\d+]/g, "");
        if (phone.length >= 5) blocks.push(link(labels.call, `tel:${phone}`));
        break;
      }
      case "hours":
        if (text) blocks.push({ ...base("header"), type: "header", title: labels.hours }, { ...base("text"), type: "text", text: text.slice(0, 2000) });
        break;
      case "shopUrl":
        if (text) blocks.push(link(labels.shop, withScheme(text), true, "shop"));
        break;
      case "website":
        if (text) blocks.push(link(labels.website, withScheme(text), false, "globe"));
        break;
      case "booking":
        if (text) blocks.push(link(labels.booking, withScheme(text), true, "calendar"));
        break;
      case "email":
        if (isEmail(text)) blocks.push(link(labels.contact, `mailto:${text}`));
        break;
      case "book":
        if (text) blocks.push(link(labels.book, withScheme(text), true, "book"));
        break;
      case "cv":
        // With a contact block the CV is one of its ways (the page words it); otherwise its own button.
        if (text && contact) contactWays.push({ kind: "cv", url: withScheme(text) });
        else if (text) blocks.push(link(labels.cv, withScheme(text), true, "file"));
        break;
      case "newsletter":
        if (input.switches.newsletter) blocks.push({ ...base("newsletter"), type: "newsletter", title: labels.newsletter });
        break;
      case "affiliate":
        // Handled below: it labels the pasted links, it adds no block of its own.
        break;
      case "tiktokLive": {
        const handle = (input.handles.tiktok ?? "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/i, "").split(/[/?#]/)[0] ?? "";
        if (input.switches.tiktokLive && handle) {
          blocks.push({ ...base("live"), type: "live", platform: "tiktok", channel: handle, url: `https://www.tiktok.com/@${handle}/live`, isLive: false, title: labels.liveTitle });
        }
        break;
      }
    }
  }

  // Affiliate links are labelled as advertising ("Ad"/"Anzeige") wherever a block can carry the label.
  const ads = fields.includes("affiliate") && input.switches.affiliate === true;
  for (const detection of detectMany(input.links)) {
    const block = blockFromLink(detection, labels.detection, labels.artist);
    blocks.push(ads && (block.type === "link" || block.type === "card" || block.type === "product") ? { ...block, affiliate: true } : block);
  }
  if (contact) blocks.push(contactWays.length ? { ...contact, links: contactWays } : contact);
  return blocks;
}
