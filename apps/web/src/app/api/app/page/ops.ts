import { blockSchema, detectLink, pageSchema, type Block } from "@linkyo/blocks";
import { z } from "zod";

import { blockFromLink, insertAt } from "@/features/app/blocks";
import { metadataPatch, metadataUrl, type LinkMetadata } from "@/features/app/metadata";
import { isStorageImage, STORAGE_MEDIA_PATH } from "@/features/directions/shared/remote-images";

/**
 * The page operations the iPhone app sends (`POST /api/app/page`, ADR 0088). The app never
 * builds block JSON itself: a link becomes a block here with the code the web's Add sheet uses
 * (`detectLink`, `blockFromLink`, the platform details of `/api/link-metadata`), and every other
 * operation only moves, shows, hides or removes a block by its id. The result must not make the page
 * fail the blocks schema in any way it did not already.
 */

/** At most this many operations in one call. */
export const MAX_OPS = 20;
/** The request body may be at most this large (bytes). */
export const MAX_BODY = 64 * 1024;

const id = z.string().min(1).max(200);

export const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), url: z.string().min(1).max(2048) }),
  z.object({
    op: z.literal("addImage"),
    src: z.string().min(1).max(2048),
    alt: z.string().max(300),
    w: z.number().int().min(1).max(8192),
    h: z.number().int().min(1).max(8192),
  }),
  z.object({ op: z.literal("move"), id, to: z.number().int().min(0) }),
  z.object({ op: z.literal("show"), id, visible: z.boolean() }),
  z.object({ op: z.literal("remove"), id }),
]);
export type PageOp = z.infer<typeof opSchema>;

/** A row's `updated_at` as Postgres writes it (ISO 8601 with up to microseconds and an offset). */
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/;

export const bodySchema = z.object({
  baseUpdatedAt: z.string().max(40).regex(TIMESTAMP),
  ops: z.array(opSchema).min(1).max(MAX_OPS),
});

/** Where a refused call went wrong: the error and the operation (its index) or block it names. */
export type OpsError = { error: "badUrl" | "badImage" | "badIndex"; op: number } | { error: "unknownBlock" | "ambiguousBlock"; id: string } | { error: "invalidPage"; problems: string[] };

export type OpsResult = { ok: true; page: Record<string, unknown>; changed: string[]; added: string[] } | ({ ok: false } & OpsError);

export interface OpsContext {
  /** The signed-in account: pictures must be in its own folder of the `media` bucket. */
  ownerId: string;
  /** This project's Supabase address (the media bucket's public URLs start with it). */
  storageUrl: string;
  /** The Add sheet's words for a new video, song or ticket link, in the page's language. */
  labels: { video: string; music: string; event: string };
  /** A new song's artist until its platform says otherwise: the page's name, as the Add sheet does. */
  artist: string;
  /** The platform's details for a link (`lookupLinkMetadata`), or null when there are none. */
  lookup: (url: string) => Promise<LinkMetadata | null>;
  newId: (type: string) => string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const idOf = (block: unknown): string | null => (isRecord(block) && typeof block.id === "string" ? block.id : null);

/** `<uid>/<yyyy>/<uuid>.<jpg|webp|png>`, the path every upload gets (features/app/media-upload.ts). */
const MEDIA_PATH = /^\d{4}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|webp|png)$/;

/** A picture the account uploaded itself: this project's public `media` bucket, its own folder, an upload's path. */
export function isOwnMedia(src: string, ownerId: string, storageUrl: string): boolean {
  const prefix = `${storageUrl.replace(/\/$/, "")}${STORAGE_MEDIA_PATH}${ownerId}/`;
  return isStorageImage(src, { supabaseUrl: storageUrl }) && src.startsWith(prefix) && MEDIA_PATH.test(src.slice(prefix.length));
}

/**
 * Which rule of the schema a problem breaks, by the block it is about (its id stays when blocks move):
 * "profile", "blocks" (their number), "block:<id>".
 */
function problems(profile: unknown, blocks: readonly unknown[]): Set<string> {
  const parsed = pageSchema.safeParse({ profile, blocks });
  if (parsed.success) return new Set();
  return new Set(
    parsed.error.issues.map(({ path }) => {
      const [first, index] = path;
      if (first === "blocks" && typeof index === "number") return `block:${idOf(blocks[index]) ?? `#${String(index)}`}`;
      return String(first ?? "page");
    }),
  );
}

/**
 * Applies the operations in order to the stored page (a copy) and answers the new page, or why it was
 * refused. Blocks the call does not touch stay exactly as stored, also ones the schema no longer
 * reads; new blocks pass `blockSchema` on their own.
 */
export async function applyOps(stored: unknown, ops: readonly PageOp[], ctx: OpsContext): Promise<OpsResult> {
  const page = isRecord(stored) ? stored : {};
  const before: unknown[] = Array.isArray(page.blocks) ? page.blocks : [];
  const blocks = [...before];
  const changed: string[] = [];
  const added: Block[] = [];

  /** The one block with this id (an id that is missing or appears twice names no block). */
  const find = (target: string): { index: number } | OpsError => {
    const indexes = blocks.flatMap((block, index) => (idOf(block) === target ? [index] : []));
    if (indexes.length === 0) return { error: "unknownBlock", id: target };
    if (indexes.length > 1) return { error: "ambiguousBlock", id: target };
    return { index: indexes[0] ?? 0 };
  };
  const freshId = (type: string): string => {
    let candidate = ctx.newId(type);
    while (blocks.some((block) => idOf(block) === candidate)) candidate = ctx.newId(type);
    return candidate;
  };
  // New blocks go where the Add sheet puts them: at the top, under the social icons, in the order sent.
  const insert = (block: Block) => {
    blocks.splice(Math.min(insertAt(blocks as Block[]) + added.length, blocks.length), 0, block);
    added.push(block);
    changed.push(block.id);
  };

  for (const [index, op] of ops.entries()) {
    if (op.op === "add") {
      const detection = op.url.length <= 2048 ? detectLink(op.url) : null;
      if (!detection) return { ok: false, error: "badUrl", op: index };
      const built = blockSchema.safeParse({ ...blockFromLink(detection, ctx.labels, ctx.artist), id: freshId(detection.type) });
      if (!built.success) return { ok: false, error: "badUrl", op: index };
      insert(built.data);
    } else if (op.op === "addImage") {
      if (!isOwnMedia(op.src, ctx.ownerId, ctx.storageUrl)) return { ok: false, error: "badImage", op: index };
      const built = blockSchema.safeParse({ id: freshId("image"), type: "image", visible: true, highlight: false, image: { src: op.src, alt: op.alt, w: op.w, h: op.h } });
      if (!built.success) return { ok: false, error: "badImage", op: index };
      insert(built.data);
    } else {
      const found = find(op.id);
      if ("error" in found) return { ok: false, ...found };
      if (op.op === "move") {
        if (op.to >= blocks.length) return { ok: false, error: "badIndex", op: index };
        const [block] = blocks.splice(found.index, 1);
        blocks.splice(op.to, 0, block);
      } else if (op.op === "show") {
        blocks[found.index] = { ...(blocks[found.index] as Record<string, unknown>), visible: op.visible };
      } else {
        blocks.splice(found.index, 1);
      }
      changed.push(op.id);
    }
  }

  // Titles, covers and artists from the platform, where the new block still shows its placeholder (as
  // the editor's `enrich` does); details that would break the schema are left out.
  await Promise.all(
    added.map(async (block) => {
      const url = metadataUrl(block);
      const meta = url ? await ctx.lookup(url).catch(() => null) : null;
      const patch = meta ? metadataPatch(block, block, meta) : null;
      if (!patch) return;
      const enriched = blockSchema.safeParse({ ...block, ...patch });
      const at = blocks.indexOf(block);
      if (enriched.success && at >= 0) blocks[at] = enriched.data;
    }),
  );

  // The whole page against the blocks schema: the call may not add a problem it did not have before.
  const had = problems(page.profile, before);
  const fresh = [...problems(page.profile, blocks)].filter((problem) => !had.has(problem));
  if (fresh.length > 0) return { ok: false, error: "invalidPage", problems: fresh };
  const kept = new Set(blocks.map(idOf));
  return { ok: true, page: { ...page, blocks }, changed: [...new Set(changed)], added: added.map((block) => block.id).filter((block) => kept.has(block)) };
}
