import type { CreatorKind } from "./kinds";
import { FEATURED_PROJECTS, hasImage, isProjectSlug, PROJECT_SLUG_MAX } from "./rules";
import type { Block, BlockOf, CodeLang, Page } from "./schema";

/**
 * Portfolio rules as pure functions: addresses, covers, "is there more to read", layouts, section
 * order and "what is missing". Rules where rules suffice: nothing here asks a model, and nothing
 * here imports Zod (the schema types are type-only), so creator pages can use it
 * (`@linkyo/blocks/project`) without the schemas in their JavaScript.
 */

export type Project = BlockOf<"project">;
type Quotes = BlockOf<"quotes">;
type Contact = BlockOf<"contact">;
type Picture = NonNullable<Project["pictures"]>[number];
type ProjectImage = NonNullable<Project["cover"]>;

const filled = (text: string | undefined): boolean => text !== undefined && text.trim() !== "";

// ─── Addresses ────────────────────────────────────────────────────────────────────────────────

/** The word a project address falls back to: "projekt-1" on German pages, "project-1" elsewhere. */
export const slugWord = (locale: string): "projekt" | "project" => (locale === "de" ? "projekt" : "project");

/** A fallback address ("project-3", "projekt-1"): the title had no Latin letters to make one from. */
export const FALLBACK_SLUG = /^(project|projekt)-\d+$/;

const FOLD: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss", ø: "o", å: "a", æ: "ae" };

/** Cut to `max` characters, never ending in a dash. */
const cut = (slug: string, max: number): string => slug.slice(0, max).replace(/-+$/, "");

/** Lower case, German and Nordic letters written out, other accents dropped, every other run one dash. */
function slugify(text: string): string {
  const folded = text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[äöüßøåæ]/g, (letter) => FOLD[letter] ?? letter)
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "");
  return cut(folded.replace(/[^a-z0-9]+/g, "-").replace(/^-+/, ""), PROJECT_SLUG_MAX);
}

/** An address says something when it has a letter, fits the rules and is not a reserved word. */
const usable = (slug: string): boolean => isProjectSlug(slug) && /[a-z]/.test(slug);

/** Room kept for "-2" … "-99", so a counted address never grows past the limit. */
const COUNTER_ROOM = 3;

function firstFree(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffix = `-${String(n)}`;
    const candidate = cut(base, PROJECT_SLUG_MAX - Math.max(COUNTER_ROOM, suffix.length)) + suffix;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * The address of a new project, made from its title. `taken` holds every `slug` and every `was`
 * value of the page. A title without a usable Latin word (an Arabic title, "2024", a reserved word
 * like "Work") gets `<word>-<n>` with the first free number; for a project read from a repository,
 * the repository's name is tried before that. A taken address gets "-2", "-3" …
 * The address never follows the title afterwards: only the owner changes it.
 */
export function slugFor(title: string, taken: Iterable<string>, word: string, repo?: string): string {
  const used = new Set(taken);
  for (const source of [title, repo]) {
    if (source === undefined) continue;
    const base = slugify(source);
    if (usable(base)) return firstFree(base, used);
  }
  for (let n = 1; ; n += 1) {
    const candidate = `${word}-${String(n)}`;
    if (!used.has(candidate)) return candidate;
  }
}

// ─── Covers and pictures ──────────────────────────────────────────────────────────────────────

/** The picture a card shows: the cover, else the first picture. */
export function coverImage(project: Project): ProjectImage | undefined {
  if (hasImage(project.cover)) return project.cover;
  const first = project.pictures?.[0]?.image;
  return hasImage(first) ? first : undefined;
}

/**
 * What stands in the cover area of a card. Every card has a cover, also without a picture: the
 * picture; else the first result figure set large; else the title set large. Never a placeholder.
 */
export function coverMode(project: Project): "picture" | "figure" | "title" {
  if (coverImage(project)) return "picture";
  return (project.results?.length ?? 0) > 0 ? "figure" : "title";
}

/**
 * The pictures visitors see: those with a description, or marked as needing none. The others wait
 * in the editor; they never hide the project. Public pages and every count use this list.
 */
export function shownPictures(project: Project): Picture[] {
  return (project.pictures ?? []).filter((picture) => hasImage(picture.image) && (filled(picture.image.alt) || picture.decorative === true));
}

const storyParts = (project: Project): (string | undefined)[] => [project.story?.about, project.story?.problem, project.story?.solution, project.story?.result];
const hasStory = (project: Project): boolean => storyParts(project).some(filled);

/**
 * Is there more to read than the card holds? Only then a project has a page of its own: a filled
 * story part, a result figure, a code sample, an install command, more than one shown picture
 * (counting the cover), or a quote about it. Repository facts alone do not count: the card prints them.
 */
export function hasDetail(project: Project, quotes: readonly Quotes[] = []): boolean {
  if (hasStory(project) || (project.results?.length ?? 0) > 0 || project.code !== undefined || filled(project.source?.install)) return true;
  // The cover the card shows counts once, whether it is the `cover` or a first picture standing in
  // for it (which shows on the card even while it waits for its description).
  const shown = shownPictures(project);
  const cover = coverImage(project);
  const coverExtra = cover !== undefined && !shown.some((picture) => picture.image === cover) ? 1 : 0;
  if (coverExtra + shown.length > 1) return true;
  return quotes.some((block) => block.items.some((item) => item.project === project.id));
}

/** The repository a project's facts were read from. */
export const repositoryUrl = (source: NonNullable<Project["source"]>): string => `https://github.com/${source.owner}/${source.repo}`;

export type ProjectTarget = { kind: "page"; href: string } | { kind: "link"; href: string } | { kind: "none" };

/**
 * Where a card leads: the project's page when there is more to read, else its first link (for a
 * repository-only project that is the repository), else nowhere. `base` is "/<username>" on public
 * pages and "/<locale>/p/<slug>" on example pages; `suffix` carries a query for sample routes.
 */
export function projectTarget(project: Project, base: string, quotes: readonly Quotes[] = [], suffix = ""): ProjectTarget {
  if (hasDetail(project, quotes)) return { kind: "page", href: `${base}/${project.slug}${suffix}` };
  const link = project.links?.[0]?.url ?? (project.source ? repositoryUrl(project.source) : undefined);
  return link ? { kind: "link", href: link } : { kind: "none" };
}

export type LinkLabelKey = "linkView" | "linkViewCode" | "linkWatch" | "linkListen" | "linkOpenPdf";

const LINK_HOSTS: readonly (readonly [LinkLabelKey, readonly string[]])[] = [
  ["linkViewCode", ["github.com", "gitlab.com", "codeberg.org"]],
  ["linkWatch", ["youtube.com", "youtu.be", "vimeo.com"]],
  ["linkListen", ["open.spotify.com", "podcasts.apple.com", "soundcloud.com"]],
];

/** The label of a project link without one of its own (a key under creator.portfolio), by host and ending. */
export function linkLabelKey(url: string): LinkLabelKey {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "linkView";
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  for (const [key, hosts] of LINK_HOSTS) if (hosts.some((known) => host === known || host.endsWith(`.${known}`))) return key;
  return parsed.pathname.toLowerCase().endsWith(".pdf") ? "linkOpenPdf" : "linkView";
}

// ─── Layouts ──────────────────────────────────────────────────────────────────────────────────

export type WorkLayout = "bento" | "list" | "rail";

/**
 * The layout a run of projects gets. `wanted` is the theme's resolved choice. A fixed choice the
 * content cannot fill becomes the list; "auto" picks: a later run of 2–6 picture projects is a rail,
 * three or more with at least 60 % pictures a grid, anything else the list. Shares are counted on
 * the projects the run shows (the first six).
 */
export function chooseProjectsLayout(group: readonly Project[], groupIndex: number, wanted: WorkLayout | "auto"): WorkLayout {
  const shown = group.slice(0, FEATURED_PROJECTS);
  const pictures = shown.filter((project) => coverMode(project) === "picture").length;
  const railFits = group.length >= 2 && group.length <= FEATURED_PROJECTS;
  if (wanted === "list") return "list";
  if (wanted === "rail") return railFits ? "rail" : "list";
  if (wanted === "bento") return shown.length >= 3 && pictures * 2 >= shown.length ? "bento" : "list";
  if (groupIndex > 0 && railFits && pictures === shown.length) return "rail";
  if (shown.length >= 3 && pictures * 10 >= shown.length * 6) return "bento";
  return "list";
}

/** One row of the grid: `tiles` projects in page order; with `lead`, the first of them is the large tile. */
export interface BentoRow {
  lead: boolean;
  tiles: number;
}

/**
 * The grid's rows for 1–6 tiles, in page order. The first tile leads and takes up to two beside it;
 * the rest fills a second row. With `leadTaken` the hero already shows the first project (Werkbogen's
 * plate): `count` is what is left, in rows of equal tiles.
 */
export function bentoRows(count: number, leadTaken = false): BentoRow[] {
  const total = Math.max(0, Math.min(FEATURED_PROJECTS, Math.floor(count)));
  if (total === 0) return [];
  if (leadTaken) {
    if (total <= 3) return [{ lead: false, tiles: total }];
    const first = total === 4 ? 2 : 3;
    return [
      { lead: false, tiles: first },
      { lead: false, tiles: total - first },
    ];
  }
  if (total <= 3) return [{ lead: true, tiles: total }];
  return [
    { lead: true, tiles: 3 },
    { lead: false, tiles: total - 3 },
  ];
}

/** Ratio of a picture whose size is unknown (aspect.photo, 3:2). */
export const FALLBACK_RATIO = 1.5;

export const pictureRatio = (image: { w?: number | undefined; h?: number | undefined }): number => (image.w && image.h ? image.w / image.h : FALLBACK_RATIO);

export interface PlateItem {
  /** Position in the list that was passed in. */
  index: number;
  ratio: number;
}

export type PlateRow =
  /** A landscape picture: its own row at full width. */
  | { kind: "full"; items: [PlateItem] }
  /** Two upright or square pictures. True portraits stay side by side on phones; other pairs stack there. */
  | { kind: "pair"; items: [PlateItem, PlateItem]; phone: "pair" | "stack" }
  /** An upright or square picture left alone: its own row at three fifths of the width. */
  | { kind: "narrow"; items: [PlateItem] };

/** A project page's pictures as rows, by ratio: pictures follow the story, nobody places them by hand. */
export function plateRows(pictures: readonly { image: { w?: number | undefined; h?: number | undefined } }[]): PlateRow[] {
  const items = pictures.map((picture, index): PlateItem => ({ index, ratio: pictureRatio(picture.image) }));
  const rows: PlateRow[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item) continue;
    const next = items[index + 1];
    if (item.ratio >= 1.2) rows.push({ kind: "full", items: [item] });
    else if (next && next.ratio < 1.2) {
      rows.push({ kind: "pair", items: [item, next], phone: item.ratio < 0.9 && next.ratio < 0.9 ? "pair" : "stack" });
      index += 1;
    } else rows.push({ kind: "narrow", items: [item] });
  }
  return rows;
}

/** The ratios a lead tile or the hero plate can take, by the name of their aspect token. */
export const COVER_RATIOS = { portrait: 4 / 5, square: 1, photo: 3 / 2, video: 16 / 9 } as const;
export type CoverRatio = keyof typeof COVER_RATIOS;

/** The nearest of 4:5, 1:1, 3:2 and 16:9 to a picture's own ratio (3:2 when its size is unknown). */
export function nearestRatio(w: number | undefined, h: number | undefined): CoverRatio {
  if (!w || !h) return "photo";
  const ratio = Math.log(w / h);
  let best: CoverRatio = "photo";
  for (const name of Object.keys(COVER_RATIOS) as CoverRatio[]) {
    if (Math.abs(Math.log(COVER_RATIOS[name]) - ratio) < Math.abs(Math.log(COVER_RATIOS[best]) - ratio)) best = name;
  }
  return best;
}

// ─── The primary action ───────────────────────────────────────────────────────────────────────

/** The same test as `isBlockActive` in the schema file, which this file must not import (Zod). */
function active(block: Block, now: Date): boolean {
  if (!block.visible) return false;
  const from = block.schedule?.from ? new Date(block.schedule.from) : null;
  const until = block.schedule?.until ? new Date(block.schedule.until) : null;
  return (!from || from <= now) && (!until || until > now);
}

/**
 * The page's one primary action: the `primary` of its first active contact block, or null. A page
 * without a contact block has none; a highlighted link is never promoted to one.
 */
export function primaryAction(blocks: readonly Block[], now: Date = new Date()): Contact["primary"] | null {
  return blocks.find((block): block is Contact => block.type === "contact" && active(block, now))?.primary ?? null;
}

/** The availability line, or null when there is none or its last day (`statusUntil`) has passed. */
export function contactStatus(contact: Pick<Contact, "status" | "statusUntil">, now: Date = new Date()): string | null {
  const status = contact.status?.trim();
  if (!status) return null;
  if (contact.statusUntil && contact.statusUntil < now.toISOString().slice(0, 10)) return null;
  return status;
}

// ─── Section order ────────────────────────────────────────────────────────────────────────────

export type SectionKind = "work" | "about" | "clients" | "quotes" | "tools" | "timeline" | "repositories" | "contact" | "other";

const ORDER_DEFAULT: readonly SectionKind[] = ["work", "about", "quotes", "clients", "tools", "timeline", "contact"];
const ORDER_VISUAL: readonly SectionKind[] = ["work", "about", "clients", "quotes", "tools", "timeline", "contact"];
const ORDER_CODE: readonly SectionKind[] = ["work", "tools", "timeline", "repositories", "about", "quotes", "contact"];
const ORDER_TRUST: readonly SectionKind[] = ["about", "work", "quotes", "timeline", "tools", "clients", "contact"];
const ORDER_WORDS: readonly SectionKind[] = ["work", "about", "clients", "quotes", "timeline", "tools", "contact"];
const ORDERS: Partial<Record<CreatorKind, readonly SectionKind[]>> = {
  designer: ORDER_VISUAL,
  photographer: ORDER_VISUAL,
  developer: ORDER_CODE,
  engineer: ORDER_CODE,
  coach: ORDER_TRUST,
  lawyer: ORDER_TRUST,
  writer: ORDER_WORDS,
  journalist: ORDER_WORDS,
};

/** The order of a kind's sections after the hero. */
export const sectionOrder = (kind: CreatorKind | undefined): readonly SectionKind[] => (kind ? ORDERS[kind] : undefined) ?? ORDER_DEFAULT;

/**
 * A suggested order for a page's sections, as positions in `sectionKinds`. The sections the kind's
 * order names come first, in that order; every other section keeps its place among the others and
 * sits before the contact section, which closes the page. Sections of one kind keep their order.
 */
export function suggestOrder(sectionKinds: readonly SectionKind[], kind: CreatorKind | undefined): number[] {
  const order = sectionOrder(kind);
  const rank = (section: SectionKind): number => {
    if (section === "contact") return order.length + 1;
    const position = order.indexOf(section);
    return position < 0 ? order.length : position;
  };
  return sectionKinds.map((_, index) => index).sort((a, b) => rank(sectionKinds[a] ?? "other") - rank(sectionKinds[b] ?? "other") || a - b);
}

/** Which section a block belongs to (clients are a `brands` block, repositories `repo` blocks). */
export function sectionKindOf(block: Block): SectionKind {
  switch (block.type) {
    case "project":
      return "work";
    case "brands":
      return "clients";
    case "repo":
      return "repositories";
    case "about":
    case "tools":
    case "timeline":
    case "quotes":
    case "contact":
      return block.type;
    default:
      return "other";
  }
}

/** `contact` never has a section title: its own line closes the page. */
const SELF_TITLED: ReadonlySet<Block["type"]> = new Set<Block["type"]>(["events", "shorts", "gallery", "brands", "about", "tools", "timeline", "quotes"]);

/**
 * The title a block brings for its own section, if any. A block with such a title opens a section
 * on the page exactly as a header does; the renderer and the suggested order both ask here.
 */
export function selfTitle(block: Block): string | null {
  if (!SELF_TITLED.has(block.type)) return null;
  return "title" in block && typeof block.title === "string" && block.title.trim() ? block.title : null;
}

/**
 * The page's blocks in the suggested order (`suggestOrder`). A title travels with the blocks it
 * titles, whether it is a header or a block's own title; a run of projects or repositories moves
 * as one; social icons stay on top (the hero shows them). The blocks themselves are not changed.
 */
export function suggestBlockOrder(blocks: readonly Block[], kind: CreatorKind | undefined): Block[] {
  const pinned: Block[] = [];
  // `open`: a header that still waits for its first block, which decides what the section is.
  const sections: { kind: SectionKind; titled: boolean; open: boolean; blocks: Block[] }[] = [];
  for (const block of blocks) {
    if (block.type === "socials") {
      pinned.push(block);
      continue;
    }
    if (block.type === "header") {
      sections.push({ kind: "other", titled: true, open: true, blocks: [block] });
      continue;
    }
    const mine = sectionKindOf(block);
    const current = sections.at(-1);
    if (current?.open) {
      current.blocks.push(block);
      current.kind = mine;
      current.open = false;
      continue;
    }
    // A block with its own title opens a section, as on the page.
    if (selfTitle(block) !== null) {
      sections.push({ kind: mine, titled: true, open: false, blocks: [block] });
      continue;
    }
    // A run of the same kind stays together; plain blocks stay with the titled section they follow.
    const sameRun = current?.kind === mine && (mine === "work" || mine === "repositories" || mine === "other");
    const trails = current?.titled === true && mine === "other";
    if (current && (sameRun || trails)) current.blocks.push(block);
    else sections.push({ kind: mine, titled: false, open: false, blocks: [block] });
  }
  const order = suggestOrder(
    sections.map((section) => section.kind),
    kind,
  );
  return [...pinned, ...order.flatMap((index) => sections[index]?.blocks ?? [])];
}

// ─── What is missing ──────────────────────────────────────────────────────────────────────────

export type ProjectStep = "address" | "alt" | "codeOrStory" | "resultOrPicture" | "storyOrLink" | "year";

/** The one next step the editor suggests for a project (a key under app.portfolio.next), or null. */
export function nextStep(project: Project): ProjectStep | null {
  if (FALLBACK_SLUG.test(project.slug)) return "address";
  const pictures = (project.pictures ?? []).filter((picture) => hasImage(picture.image));
  if ((hasImage(project.cover) && !filled(project.cover.alt)) || pictures.some((picture) => !filled(picture.image.alt) && picture.decorative !== true)) return "alt";
  const result = (project.results?.length ?? 0) > 0 || filled(project.story?.result);
  if (project.source && project.code === undefined && !hasStory(project) && !result) return "codeOrStory";
  if (!result && !hasImage(project.cover) && pictures.length === 0) return "resultOrPicture";
  if (!hasStory(project) && (project.links?.length ?? 0) === 0) return "storyOrLink";
  if (project.year === undefined) return "year";
  return null;
}

export type PageStep = "contact" | "secondProject" | "quote" | "recent";

/** The one next step for a page that shows work (a key under app.portfolio.page), or null. */
export function nextPageStep(page: Pick<Page, "blocks">, now: Date = new Date()): PageStep | null {
  const projects = page.blocks.filter((block): block is Project => block.type === "project");
  if (!page.blocks.some((block) => block.type === "contact")) return "contact";
  if (projects.length < 3) return "secondProject";
  if (!page.blocks.some((block) => block.type === "quotes")) return "quote";
  const thisYear = now.getUTCFullYear();
  const years = projects.flatMap((project) => (project.year ? [project.year.to === "now" ? thisYear : (project.year.to ?? project.year.from)] : []));
  if (years.length > 0 && thisYear - Math.max(...years) > 3) return "recent";
  return null;
}

// ─── Figures, code and years ──────────────────────────────────────────────────────────────────

function graphemes(value: string): number {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)).length;
  }
  return Array.from(value).length;
}

/**
 * How large a result figure is set, by what a reader sees (graphemes, so Arabic marks and emoji
 * count once): up to 4 large, up to 8 medium, longer small. Every place that prints a figure maps
 * these to its own classes and lets the value break.
 */
export function figureSize(value: string): "lg" | "md" | "sm" {
  const length = graphemes(value);
  return length <= 4 ? "lg" : length <= 8 ? "md" : "sm";
}

export type CodeTone = "plain" | "comment" | "string";
export interface CodeToken {
  text: string;
  tone: CodeTone;
}

interface CodeFamily {
  /** Markers that start a comment to the end of the line. */
  line: readonly string[];
  /** Comments with an opening and a closing marker. */
  block: readonly (readonly [string, string])[];
  /** Quotes of a string that ends on its line. */
  quotes: readonly string[];
  /** Quotes of a string that may run over lines. */
  long: readonly string[];
  /** Bare words are common (shell, YAML, TOML): a quote inside a word ("don't") starts no string. */
  bare: boolean;
}

const family = (line: readonly string[], block: readonly (readonly [string, string])[], quotes: readonly string[], long: readonly string[] = [], bare = false): CodeFamily => ({ line, block, quotes, long, bare });

const SLASH_BLOCK = [["/*", "*/"]] as const;
const C_LIKE = family(["//"], SLASH_BLOCK, ['"', "'"]);
const SCRIPT = family(["//"], SLASH_BLOCK, ['"', "'"], ["`"]);
const HASH = family(["#"], [], ['"', "'"]);
const HASH_BARE = family(["#"], [], ['"', "'"], [], true);
const FAMILIES: Record<Exclude<CodeLang, "text">, CodeFamily> = {
  ts: SCRIPT,
  js: SCRIPT,
  go: SCRIPT,
  // A lifetime ('a) is no string: only double quotes count.
  rust: family(["//"], SLASH_BLOCK, ['"']),
  swift: family(["//"], SLASH_BLOCK, ['"']),
  kotlin: C_LIKE,
  java: C_LIKE,
  csharp: C_LIKE,
  cpp: C_LIKE,
  dart: C_LIKE,
  php: family(["//", "#"], SLASH_BLOCK, ['"', "'"]),
  python: family(["#"], [], ['"', "'"], ['"""', "'''"]),
  ruby: HASH,
  shell: HASH_BARE,
  yaml: HASH_BARE,
  toml: HASH_BARE,
  sql: family(["--"], SLASH_BLOCK, ["'", '"']),
  lua: family(["--"], [], ['"', "'"]),
  // Running text has apostrophes: only comments are toned.
  html: family([], [["<!--", "-->"]], []),
  css: family([], SLASH_BLOCK, ['"', "'"]),
  json: family([], [], ['"']),
};

const isWord = (char: string | undefined): boolean => char !== undefined && /[\p{L}\p{N}_]/u.test(char);

/** Where a string that began at `start` with `quote` ends (exclusive). */
function stringEnd(text: string, start: number, quote: string, long: boolean): number {
  for (let index = start + quote.length; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\") index += 1;
    else if (!long && char === "\n") return index;
    else if (text.startsWith(quote, index)) return index + quote.length;
  }
  return text.length;
}

/**
 * A code sample as tokens for quiet toning: comments and strings, by language family. No parser and
 * no dependency; an unknown language is one plain token. The joined tokens always equal the input.
 */
export function tintCode(text: string, lang?: string): CodeToken[] {
  const rules = lang !== undefined && Object.hasOwn(FAMILIES, lang) ? FAMILIES[lang as keyof typeof FAMILIES] : undefined;
  if (!rules) return text ? [{ text, tone: "plain" }] : [];
  const tokens: CodeToken[] = [];
  let plain = 0;
  const push = (from: number, to: number, tone: CodeTone) => {
    if (to <= from) return;
    const last = tokens.at(-1);
    if (last?.tone === tone) last.text += text.slice(from, to);
    else tokens.push({ text: text.slice(from, to), tone });
  };
  const take = (from: number, to: number, tone: CodeTone): number => {
    push(plain, from, "plain");
    push(from, to, tone);
    plain = to;
    return to;
  };
  let index = 0;
  while (index < text.length) {
    const before = index > 0 ? text[index - 1] : undefined;
    const block = rules.block.find(([open]) => text.startsWith(open, index));
    if (block) {
      const close = text.indexOf(block[1], index + block[0].length);
      index = take(index, close < 0 ? text.length : close + block[1].length, "comment");
      continue;
    }
    // "#" and "--" open a comment at the start of a line or after a space ("a#b" and "$#" do not);
    // "//" does not after a colon (an address).
    const line = rules.line.find((marker) => text.startsWith(marker, index) && (marker === "//" ? before !== ":" : before === undefined || /\s/.test(before)));
    if (line) {
      const end = text.indexOf("\n", index);
      index = take(index, end < 0 ? text.length : end, "comment");
      continue;
    }
    const long = rules.long.find((quote) => text.startsWith(quote, index));
    const quote = long ?? rules.quotes.find((mark) => text.startsWith(mark, index));
    if (quote && !(rules.bare && isWord(before))) {
      index = take(index, stringEnd(text, index, quote, long !== undefined), "string");
      continue;
    }
    index += 1;
  }
  push(plain, text.length, "plain");
  return tokens;
}

/** "2025", "2023–2025" or "2024–today": an en dash, Latin digits, the caller's word for "until now". */
export function formatYears(years: NonNullable<Project["year"]>, nowWord: string): string {
  if (years.to === undefined || years.to === years.from) return String(years.from);
  return `${String(years.from)}–${years.to === "now" ? nowWord : String(years.to)}`;
}
