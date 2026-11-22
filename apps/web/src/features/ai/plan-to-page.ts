import { KINDS, LINK_ICONS, NO_IMAGE, PLATFORMS, pageSchema, type AiProfileField, type Block, type BlockOf, type CreatorKind, type Page, type Platform, type Profile } from "@linkyo/blocks";
import { BUTTON_SHAPES, BUTTON_STYLES, PAIRING_IDS, SWATCH_NAMES, TEMPLATE_IDS, type AiBlock, type PagePlan } from "@linkyo/blocks/ai-plan";
import { creatorTokens } from "@linkyo/tokens";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

import { blockFromLink, newBlockId } from "@/features/app/blocks";
import { STARTERS } from "@/features/app/kinds";
import { metadataPatch, type LinkMetadata } from "@/features/app/metadata";
import { validateBlock } from "@/features/app/validate";

import { checkFreeText, type Facts } from "./content-rules";
import { detectAddress } from "./server/sources/classify";

/**
 * Turns the AI's page plan into a real page (pure; runs on the server). The plan only names links by
 * id, so every address comes from the sources the code collected; rich cards are built by the same
 * code the editor uses when a link is pasted, and filled with the platforms' own titles and pictures.
 * Deterministic fixes come first (trim, cut long texts at a grapheme with "…", enum casing, at most
 * two highlights, header rules, at most 30 blocks), then the content rules (no invented numbers,
 * addresses, e-mails or phone numbers), then the editor's own validators. Every block is marked as
 * written by the AI. Each fix is counted, each removed block is reported with its reason.
 */

/** A link the plan may refer to (the server's source bundle entry, by id). */
export interface PlanLink {
  url: string;
  /** "social", "email", "phone", "music", "video", … or "link". */
  type: string;
  /** For social profiles: the platform of the socials block. */
  platform?: string | undefined;
  /** A title from the source (the anchor text) or the platform (link metadata). */
  title?: string | undefined;
  affiliateHint?: boolean | undefined;
}

export interface PlanContext {
  /** "L1" … "L40" → the link. */
  links: ReadonlyMap<string, PlanLink>;
  /** Platform details by address (titles, covers, app icons), as /api/link-metadata returns them. */
  metadata?: ReadonlyMap<string, LinkMetadata> | undefined;
  owner: {
    /** The name the owner typed, if any. */
    name?: string | undefined;
    /** Their current display name (the account's page), used when the plan has none. */
    currentName?: string | undefined;
    username: string;
    avatar?: Profile["avatar"] | undefined;
  };
  pageLocale: "de" | "en" | "ar";
  /** Colours the browser measured from the owner's photo. */
  photo: { vibrant: string; dominant: string } | null;
  facts: Facts;
  /** Words for cards built from a link (the editor's: "Video", "Musik", "Events"). */
  labels: { video: string; music: string; event: string };
}

export type DropReason = "unknownLink" | "duplicate" | "invalid" | "notSocial";

export interface PlanDrop {
  index: number;
  reason: DropReason;
}

export interface PageDraft {
  page: Page;
  theme: CreatorThemeConfig;
  kind: CreatorKind;
  notes: PagePlan["notes"];
  fixed: number;
  drops: PlanDrop[];
}

const MAX_BLOCKS = 30;
const MAX_HIGHLIGHTS = 2;

// ── Text fixes ───────────────────────────────────────────────────────────────

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Whitespace collapsed and cut to `max` characters with "…", never inside a letter (grapheme). */
export function cutText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  let out = "";
  for (const { segment } of segmenter.segment(clean)) {
    if (out.length + segment.length > max - 1) break;
    out += segment;
  }
  // Prefer ending at a word: unless the cut already falls before a space, go back to the last one
  // (when that keeps most of the text).
  const space = out.lastIndexOf(" ");
  if (clean.charAt(out.length) !== " " && space >= Math.floor(max * 0.6)) out = out.slice(0, space);
  return `${out.trimEnd()}…`;
}

/** Counts every change a normalizer makes. */
class Fixes {
  count = 0;
  /** A string cut to its limit (only a cut counts as a fix; trimming does not). */
  text(value: unknown, max: number): string {
    if (typeof value !== "string") {
      if (value !== undefined && value !== null) this.count += 1;
      return "";
    }
    const clean = value.replace(/\s+/g, " ").trim();
    const cut = cutText(clean, max);
    if (cut !== clean) this.count += 1;
    return cut;
  }
  choice<T extends string>(values: readonly T[], value: unknown, fallback: T): T {
    if (typeof value === "string") {
      if ((values as readonly string[]).includes(value)) return value as T;
      const match = values.find((candidate) => candidate.toLowerCase() === value.trim().toLowerCase());
      this.count += 1;
      if (match) return match;
      return fallback;
    }
    this.count += 1;
    return fallback;
  }
  flag(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    this.count += 1;
    return value === "true";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const REF = /^L(\d{1,2})$/i;
const ref = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const match = REF.exec(value.trim());
  return match ? `L${String(Number(match[1]))}` : null;
};

const BLOCK_TYPES = ["header", "link", "rich", "text", "socials", "newsletter"] as const;
const ICONS = ["auto", ...LINK_ICONS] as const;

/** One AI block with fixed casing, lengths and types, or null when it cannot be one. */
export function normalizeBlock(raw: unknown, fixes: Fixes = new Fixes()): AiBlock | null {
  if (!isRecord(raw)) return null;
  const rawType = typeof raw.type === "string" ? raw.type.trim().toLowerCase() : "";
  const type = BLOCK_TYPES.find((candidate) => candidate === rawType);
  if (!type) return null;
  if (type !== raw.type) fixes.count += 1;
  switch (type) {
    case "header":
      return { type, title: fixes.text(raw.title, 80) };
    case "text":
      return { type, text: fixes.text(raw.text, 400) };
    case "newsletter":
      return { type, title: fixes.text(raw.title, 80), description: fixes.text(raw.description, 200) };
    case "socials": {
      const refs = (Array.isArray(raw.refs) ? raw.refs : []).map(ref).filter((value): value is string => value !== null);
      if (refs.length > 12) fixes.count += 1;
      return { type, refs: refs.slice(0, 12) };
    }
    case "rich": {
      const id = ref(raw.ref);
      if (!id) return null;
      return { type, ref: id, highlight: fixes.flag(raw.highlight), ad: fixes.flag(raw.ad) };
    }
    case "link": {
      const id = ref(raw.ref);
      if (!id) return null;
      return {
        type,
        ref: id,
        title: fixes.text(raw.title, 120),
        subtitle: fixes.text(raw.subtitle ?? "", 80),
        icon: fixes.choice(ICONS, raw.icon ?? "auto", "auto"),
        highlight: fixes.flag(raw.highlight),
        ad: fixes.flag(raw.ad),
      };
    }
  }
}

/** A normalized plan: blocks that cannot be read stay as null, so their position is reported. */
export interface NormalizedPlan {
  kind: CreatorKind;
  theme: PagePlan["theme"];
  profile: PagePlan["profile"];
  blocks: (AiBlock | null)[];
  notes: PagePlan["notes"];
  fixed: number;
}

/** Fixes a parsed answer into PagePlan shape (or null when it is not even an object). */
export function normalizePlan(raw: unknown): NormalizedPlan | null {
  if (!isRecord(raw)) return null;
  const fixes = new Fixes();
  const kind = fixes.choice(KINDS, raw.kind, "other");
  const theme = isRecord(raw.theme) ? raw.theme : {};
  const starter = STARTERS[kind].theme.template;
  const profile = isRecord(raw.profile) ? raw.profile : {};
  const blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  if (blocks.length > MAX_BLOCKS) fixes.count += 1;
  const notes = Array.isArray(raw.notes) ? raw.notes : [];
  if (notes.length > 4) fixes.count += 1;
  const normalized: NormalizedPlan = {
    kind,
    theme: {
      template: fixes.choice(TEMPLATE_IDS, theme.template, starter ?? TEMPLATE_IDS[0]),
      accent: fixes.choice(["template", "photo_vibrant", "photo_dominant", ...SWATCH_NAMES], theme.accent, "template"),
      pairing: fixes.choice(["template", ...PAIRING_IDS], theme.pairing, "template"),
      buttonShape: fixes.choice(["template", ...BUTTON_SHAPES], theme.buttonShape, "template"),
      buttonStyle: fixes.choice(["template", ...BUTTON_STYLES], theme.buttonStyle, "template"),
    },
    profile: {
      displayName: fixes.text(profile.displayName ?? "", 60),
      tagline: fixes.text(profile.tagline ?? "", 80),
      bio: fixes.text(profile.bio ?? "", 160),
      location: fixes.text(profile.location ?? "", 60),
    },
    blocks: blocks.slice(0, MAX_BLOCKS).map((block: unknown) => normalizeBlock(block, fixes)),
    notes: notes
      .slice(0, 4)
      .filter(isRecord)
      .map((note) => ({ topic: fixes.choice(["look", "order", "copy", "missing"] as const, note.topic, "copy"), text: fixes.text(note.text, 140) }))
      .filter((note) => note.text.length > 0),
    fixed: 0,
  };
  normalized.fixed = fixes.count;
  return normalized;
}

// ── Blocks ───────────────────────────────────────────────────────────────────

const PLATFORM_SET = new Set<string>(PLATFORMS);
const WITH_AFFILIATE = new Set(["link", "card", "product", "app"]);
/** Cards Linkyo can build honestly from a link alone (with the platform's own details). */
const RICH_TYPES = new Set(["video", "music", "app", "repo", "live"]);
/** Rich links that become buttons: no event dates, prices or pictures may be made up for them. */
const RICH_ICONS: Partial<Record<string, BlockOf<"link">["icon"]>> = { events: "ticket", product: "shop" };

export interface BlockMapper {
  /** The page blocks for one AI block (a socials block may also yield buttons), or why it was removed. */
  map: (block: AiBlock, index: number) => { blocks: Block[]; fixed: number } | { drop: DropReason; fixed: number };
  /** The display name rich cards credit (a song's artist). */
  artist: string;
}

/** Maps blocks one by one, remembering which links were used and how many blocks are highlighted. */
export function createBlockMapper(ctx: PlanContext, artist: string): BlockMapper {
  const used = new Set<string>();
  let highlights = 0;

  const text = (value: string) => checkFreeText(value, ctx.facts);

  const finish = (block: Block, wantsHighlight: boolean): { block: Block; fixed: number } => {
    let fixed = 0;
    let highlight = false;
    if (wantsHighlight) {
      if (highlights < MAX_HIGHLIGHTS) {
        highlights += 1;
        highlight = true;
      } else fixed += 1;
    }
    return { block: { ...block, id: newBlockId(block.type), visible: true, highlight, origin: "ai" }, fixed };
  };

  const linkTitle = (link: PlanLink, label: string) => {
    const title = link.title?.trim() ?? "";
    return cutText(title.length > 0 ? title : label, 120);
  };

  const button = (link: PlanLink, fields: { title: string; subtitle?: string; icon?: BlockOf<"link">["icon"]; ad: boolean }): BlockOf<"link"> => ({
    id: "",
    type: "link",
    visible: true,
    highlight: false,
    title: fields.title,
    url: link.url,
    ...(fields.subtitle ? { subtitle: fields.subtitle } : {}),
    ...(fields.icon ? { icon: fields.icon } : {}),
    ...(fields.ad || link.affiliateHint ? { affiliate: true } : {}),
  });

  const take = (id: string): { link: PlanLink } | { drop: DropReason } => {
    const link = ctx.links.get(id);
    if (!link) return { drop: "unknownLink" };
    if (used.has(id)) return { drop: "duplicate" };
    used.add(id);
    return { link };
  };

  const valid = (block: Block) => validateBlock(block) === null;

  function map(block: AiBlock): { blocks: Block[]; fixed: number } | { drop: DropReason; fixed: number } {
    let fixed = 0;
    switch (block.type) {
      case "newsletter":
        // Phase 1 has no newsletter backend: a sign-up form would not work, so it never goes on a page.
        return { drop: "invalid", fixed };
      case "header":
      case "text": {
        const value = block.type === "header" ? block.title : block.text;
        const checked = text(value);
        if (checked.changed) fixed += 1;
        if (!checked.text || checked.invented) return { drop: "invalid", fixed: fixed + (checked.invented ? 1 : 0) };
        const made = finish(block.type === "header" ? { id: "", type: "header", visible: true, highlight: false, title: checked.text } : { id: "", type: "text", visible: true, highlight: false, text: checked.text }, false);
        return valid(made.block) ? { blocks: [made.block], fixed } : { drop: "invalid", fixed };
      }
      case "link": {
        const taken = take(block.ref);
        if ("drop" in taken) return { drop: taken.drop, fixed };
        const { link } = taken;
        const detection = detectAddress(link.url);
        const fallback = linkTitle(link, detection?.label ?? new URL(link.url).hostname);
        const title = text(block.title);
        if (title.changed || title.invented || !title.text) fixed += 1;
        const subtitle = text(block.subtitle);
        if (subtitle.changed || subtitle.invented) fixed += 1;
        const made = finish(
          button(link, {
            title: title.text && !title.invented ? title.text : fallback,
            ...(subtitle.text && !subtitle.invented ? { subtitle: subtitle.text } : {}),
            ...(block.icon !== "auto" ? { icon: block.icon } : {}),
            ad: block.ad,
          }),
          block.highlight,
        );
        return valid(made.block) ? { blocks: [made.block], fixed: fixed + made.fixed } : { drop: "invalid", fixed };
      }
      case "rich": {
        const taken = take(block.ref);
        if ("drop" in taken) return { drop: taken.drop, fixed };
        const { link } = taken;
        const detection = detectAddress(link.url);
        if (!detection) return { drop: "invalid", fixed };
        let built: Block;
        if (RICH_TYPES.has(detection.type)) {
          const card = blockFromLink(detection, ctx.labels, artist);
          const meta = ctx.metadata?.get(link.url);
          const patch = meta ? metadataPatch(card, card, meta) : null;
          built = (patch ? { ...card, ...patch } : card) as Block;
          if (block.ad && WITH_AFFILIATE.has(built.type)) built = { ...built, affiliate: true } as Block;
          else if (link.affiliateHint && WITH_AFFILIATE.has(built.type)) built = { ...built, affiliate: true } as Block;
        } else {
          // A plain link, a website, a ticket shop or a product page: a button (no made-up details).
          const icon = RICH_ICONS[detection.type];
          built = button(link, { title: linkTitle(link, detection.label), ...(icon ? { icon } : {}), ad: block.ad });
        }
        const made = finish(built, block.highlight);
        return valid(made.block) ? { blocks: [made.block], fixed: fixed + made.fixed } : { drop: "invalid", fixed };
      }
      case "socials": {
        const items: { platform: Platform; url: string }[] = [];
        const moved: Block[] = [];
        for (const id of block.refs) {
          const taken = take(id);
          if ("drop" in taken) {
            fixed += 1;
            continue;
          }
          const { link } = taken;
          if (link.type === "social" && link.platform && PLATFORM_SET.has(link.platform) && items.length < 12) {
            items.push({ platform: link.platform as Platform, url: link.url });
          } else {
            // Not a social profile: it becomes its own button right after the icons.
            fixed += 1;
            const made = finish(button(link, { title: linkTitle(link, detectAddress(link.url)?.label ?? link.url), ad: false }), false);
            if (valid(made.block)) moved.push(made.block);
          }
        }
        const blocks: Block[] = [];
        if (items.length) {
          const made = finish({ id: "", type: "socials", visible: true, highlight: false, items }, false);
          if (valid(made.block)) blocks.push(made.block);
        }
        blocks.push(...moved);
        return blocks.length ? { blocks, fixed } : { drop: items.length ? "invalid" : "unknownLink", fixed };
      }
    }
  }

  return { map: (block) => map(block), artist };
}

/** Header rules: never two in a row, never one at the end, never the same title twice. */
function headerRules(blocks: Block[]): { blocks: Block[]; fixed: number } {
  const out: Block[] = [];
  const titles = new Set<string>();
  let fixed = 0;
  blocks.forEach((block, index) => {
    if (block.type !== "header") {
      out.push(block);
      return;
    }
    const next = blocks[index + 1];
    const title = block.title.trim().toLowerCase();
    if (!next || next.type === "header" || titles.has(title)) {
      fixed += 1;
      return;
    }
    titles.add(title);
    out.push(block);
  });
  return { blocks: out, fixed };
}

// ── Theme and profile ────────────────────────────────────────────────────────

/** The plan's look as the creator theme: "template" means "as the template has it" (absent). */
export function planTheme(theme: PagePlan["theme"], photo: PlanContext["photo"]): CreatorThemeConfig {
  const out: CreatorThemeConfig = { template: theme.template as CreatorThemeConfig["template"] };
  const swatches = creatorTokens.swatches as Record<string, string>;
  if (theme.accent === "photo_vibrant" && photo) out.accent = photo.vibrant;
  else if (theme.accent === "photo_dominant" && photo) out.accent = photo.dominant;
  else if (theme.accent !== "template" && theme.accent !== "photo_vibrant" && theme.accent !== "photo_dominant" && swatches[theme.accent]) out.accent = swatches[theme.accent];
  if (theme.pairing !== "template") out.pairing = theme.pairing as CreatorThemeConfig["pairing"];
  if (theme.buttonShape !== "template") out.buttonShape = theme.buttonShape as CreatorThemeConfig["buttonShape"];
  if (theme.buttonStyle !== "template") out.buttonStyle = theme.buttonStyle as CreatorThemeConfig["buttonStyle"];
  return out;
}

/** The profile: texts from the plan (checked), name and picture from the account. */
export function planProfile(profile: PagePlan["profile"], ctx: PlanContext): { profile: Profile; fixed: number } {
  let fixed = 0;
  const check = (value: string, clearInvented = true): string => {
    if (!value) return "";
    const checked = checkFreeText(value, ctx.facts);
    if (checked.changed) fixed += 1;
    if (checked.invented && clearInvented) {
      fixed += 1;
      return "";
    }
    return checked.text;
  };
  const typed = ctx.owner.name?.trim() ?? "";
  const planned = check(profile.displayName);
  const current = ctx.owner.currentName?.trim() ?? "";
  const displayName = cutText([planned, typed, current].find((name) => name.length > 0) ?? ctx.owner.username, 60);
  const tagline = check(profile.tagline);
  const bio = check(profile.bio);
  const location = check(profile.location);
  const aiFields: AiProfileField[] = [];
  if (planned && planned === displayName && planned !== typed) aiFields.push("displayName");
  if (tagline) aiFields.push("tagline");
  if (bio) aiFields.push("bio");
  return {
    profile: {
      username: ctx.owner.username,
      displayName,
      bio,
      ...(tagline ? { tagline } : {}),
      ...(location ? { location } : {}),
      avatar: ctx.owner.avatar ?? { src: NO_IMAGE, alt: "" },
      verified: false,
      locale: ctx.pageLocale,
      ...(aiFields.length ? { aiFields } : {}),
    },
    fixed,
  };
}

/** The whole plan as a draft page, validated with the editor's page schema. */
export function planToPage(plan: PagePlan | NormalizedPlan, ctx: PlanContext): PageDraft {
  const normalized: NormalizedPlan = "fixed" in plan ? plan : { ...plan, blocks: plan.blocks, fixed: 0 };
  let fixed = normalized.fixed;
  const drops: PlanDrop[] = [];
  const { profile, fixed: profileFixes } = planProfile(normalized.profile, ctx);
  fixed += profileFixes;
  const mapper = createBlockMapper(ctx, profile.displayName);
  let blocks: Block[] = [];
  normalized.blocks.forEach((block, index) => {
    if (!block) {
      drops.push({ index, reason: "invalid" });
      return;
    }
    const result = mapper.map(block, index);
    fixed += result.fixed;
    if ("drop" in result) drops.push({ index, reason: result.drop });
    else blocks.push(...result.blocks);
  });
  const headers = headerRules(blocks);
  fixed += headers.fixed;
  blocks = headers.blocks;
  if (blocks.length > MAX_BLOCKS) {
    fixed += 1;
    blocks = blocks.slice(0, MAX_BLOCKS);
  }
  const page = pageSchema.safeParse({ profile, blocks });
  if (!page.success) throw new Error("The draft page does not match the page schema");
  return { page: page.data, theme: planTheme(normalized.theme, ctx.photo), kind: normalized.kind, notes: normalized.notes, fixed, drops };
}
