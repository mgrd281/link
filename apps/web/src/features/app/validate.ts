import { blockSchema, hasImage, isProjectSlug, MAX_PROJECTS, PROJECT_SLUG, PROJECT_SLUG_MAX, PROJECT_SLUG_MIN, RESERVED_PROJECT_SLUGS, type Block, type Page } from "@linkyo/blocks";

import { isReachWay, reachesBy } from "./reach";

/**
 * Field errors by path ("title", "items.0.url"), as message keys under app.errors; keys that start
 * with "portfolio." are under app.portfolio ("portfolio.slugTaken"). The path "page" holds a problem
 * of the page as a whole (a 25th project, a second contact block).
 */
export type FieldErrors = Record<string, string>;

/** At most this many lines in a project's code sample (the schema caps the characters). */
export const MAX_CODE_LINES = 30;

/**
 * The page a block is being edited on. The edit forms register every draft they hand on with
 * `inPage`, so the same check that runs on save can see the other blocks (a slug taken by another
 * project, a second contact block) without the save itself knowing about pages.
 */
const pages = new WeakMap<Block, readonly Block[]>();

/** Marks a draft as edited on a page with these blocks (the draft's own older version may be among them). */
export function inPage<B extends Block>(block: B, blocks: readonly Block[]): B {
  pages.set(block, blocks);
  return block;
}

/** Why a slug cannot be used on this page, as an app.portfolio key; null when it can. */
export function slugProblem(slug: string, id: string, blocks: readonly Block[]): "slugInvalid" | "slugReserved" | "slugTaken" | null {
  if (slug.length < PROJECT_SLUG_MIN || slug.length > PROJECT_SLUG_MAX || !PROJECT_SLUG.test(slug)) return "slugInvalid";
  if (RESERVED_PROJECT_SLUGS.has(slug)) return "slugReserved";
  // Another project's current address is taken; one of its earlier addresses can be taken over.
  if (blocks.some((block) => block.type === "project" && block.id !== id && block.slug === slug)) return "slugTaken";
  return null;
}

const codeLines = (text: string): number => text.replace(/\n+$/, "").split("\n").length;

function schemaErrors(block: Block, errors: FieldErrors) {
  const result = blockSchema.safeParse(block);
  if (result.success) return;
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (errors[path]) continue;
    const origin = "origin" in issue ? issue.origin : undefined;
    errors[path] =
      issue.code === "too_small"
        ? origin === "array"
          ? "atLeastOne"
          : "required"
        : issue.code === "too_big"
          ? "tooLong"
          : issue.code === "invalid_format" && "format" in issue && issue.format === "url"
            ? "url"
            : "invalid";
  }
}

/** What the portfolio blocks need beyond the schema, and the schema's problems in their own words. */
function portfolioErrors(block: Block, errors: FieldErrors, blocks: readonly Block[] | undefined) {
  switch (block.type) {
    case "project": {
      // A title or sentence of spaces alone says nothing (the card would have no name).
      if (!errors.title && block.title.trim() === "") errors.title = "required";
      if (!errors.summary && block.summary.trim() === "") errors.summary = "required";
      // The address in the owner's words: why it cannot be used, not "check this field".
      delete errors.slug;
      const slug = blocks ? slugProblem(block.slug, block.id, blocks) : isProjectSlug(block.slug) ? null : RESERVED_PROJECT_SLUGS.has(block.slug) ? "slugReserved" : "slugInvalid";
      if (slug) errors.slug = `portfolio.${slug}`;
      if (errors["year.to"] === "invalid") errors["year.to"] = "portfolio.yearOrder";
      if (block.code && codeLines(block.code.text) > MAX_CODE_LINES) errors["code.text"] = "portfolio.codeTooLong";
      // A confidential client has no name: the form clears it, so this only guards a hand-made block.
      if (errors.client === "invalid") errors.client = "portfolio.hideClientHint";
      if (blocks && !blocks.some((other) => other.id === block.id) && blocks.filter((other) => other.type === "project").length >= MAX_PROJECTS) errors.page = "portfolio.tooMany";
      break;
    }
    case "quotes":
      block.items.forEach((item, index) => {
        const path = `items.${String(index)}.consent`;
        if (errors[path] || !(item.consent as boolean)) errors[path] = "portfolio.quotes.consentMissing";
      });
      break;
    case "timeline":
      block.items.forEach((item, index) => {
        if (typeof item.years.to === "number" && item.years.to < item.years.from) errors[`items.${String(index)}.years.to`] = "portfolio.yearOrder";
      });
      break;
    case "contact":
      if (blocks?.some((other) => other.type === "contact" && other.id !== block.id)) errors.page = "portfolio.oneContact";
      // Another way leads where its kind says: a WhatsApp way to a chat, not to the phone's dialler.
      block.links?.forEach((link, index) => {
        const path = `links.${String(index)}.url`;
        if (!errors[path] && isReachWay(link.kind) && !reachesBy(link.kind, link.url)) errors[path] = link.kind === "email" ? "invalidEmail" : "invalid";
      });
      break;
    default:
      break;
  }
}

/**
 * Validates a block with the same schema the API uses, plus what a page needs to look finished
 * (an image block needs a picture). Returns the first problem per field, or null when it can be saved.
 * A picture without a description is never a problem: it waits in the editor (`shownPictures`).
 */
export function validateBlock(block: Block): FieldErrors | null {
  const errors: FieldErrors = {};
  schemaErrors(block, errors);
  if (block.type === "image" && !hasImage(block.image)) errors["image.src"] = "imageRequired";
  // Owner and repository come from the GitHub address: a problem with them is a problem with the link.
  if (block.type === "repo" && (errors.owner || errors.repo || errors.url)) {
    delete errors.owner;
    delete errors.repo;
    errors.url = "githubUrl";
  }
  if (block.type === "gallery") {
    if (block.images.length === 0) errors.images = "atLeastOne";
    block.images.forEach((image, index) => {
      if (!hasImage(image)) errors[`images.${index}.src`] = "imageRequired";
    });
  }
  portfolioErrors(block, errors, pages.get(block));
  return Object.keys(errors).length > 0 ? errors : null;
}

/** A page-level problem, as a key under app.portfolio. */
export type PageProblem = "tooMany" | "oneContact" | "slugTaken" | "pageSize";

/** The page's size from which the editor warns (the database refuses a little over 1,000,000 bytes). */
export const PAGE_SIZE_WARNING = 800_000;

/** Pictures kept inside the page (the demo's data URLs) do not count: real accounts keep them in Storage. */
function withoutData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutData);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, withoutData(inner)]));
  return typeof value === "string" && value.startsWith("data:") ? "" : value;
}

/** The UTF-8 size of what a real account stores for its page: page, look and legal details. */
export const storedSize = (parts: { page: Pick<Page, "profile" | "blocks">; theme?: unknown; legal?: unknown }): number =>
  new TextEncoder().encode(JSON.stringify(withoutData([parts.page, parts.theme ?? null, parts.legal ?? null]))).length;

/**
 * The page rules (at most 24 projects, every project address once, one contact block) and, with
 * real accounts only, a warning when the page gets close to the database's size limit. In the demo
 * nothing is measured: the browser's own storage is the limit there, and saving says so.
 */
export function validatePage(parts: { page: Pick<Page, "profile" | "blocks">; theme?: unknown; legal?: unknown }, { real }: { real: boolean }): PageProblem[] {
  const problems: PageProblem[] = [];
  const { blocks } = parts.page;
  if (blocks.filter((block) => block.type === "project").length > MAX_PROJECTS) problems.push("tooMany");
  if (blocks.filter((block) => block.type === "contact").length > 1) problems.push("oneContact");
  const addresses = blocks.flatMap((block) => (block.type === "project" ? [block.slug, ...(block.was ?? [])] : []));
  if (new Set(addresses).size !== addresses.length) problems.push("slugTaken");
  if (real && storedSize(parts) >= PAGE_SIZE_WARNING) problems.push("pageSize");
  return problems;
}
