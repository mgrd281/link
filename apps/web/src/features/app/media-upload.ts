import { browserSupabase } from "@/lib/supabase/browser";
import { SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";

import type { PreparedImage } from "./images";

/**
 * Pictures in Supabase Storage (EU) instead of inside the page. Real accounts upload each prepared
 * picture once to the public `media` bucket and keep its address; the demo keeps the data URL (it has
 * no server). Order photos (`briefing`) and Premium story pictures (`deliverables`) are private
 * buckets with the same folder rule: the first folder is the account's id (supabase/migrations).
 */

export type Bucket = "media" | "briefing" | "deliverables";

/** File types the `media` bucket accepts (its `allowed_mime_types`), with their extension. */
export const MEDIA_TYPES = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" } as const;
export type MediaType = keyof typeof MEDIA_TYPES;

const isMediaType = (type: string): type is MediaType => type in MEDIA_TYPES;

/** Uploads one file (browser session, row-level security decides). Files never change: cached for a year. */
export async function uploadToBucket(bucket: Bucket, path: string, blob: Blob, contentType: string): Promise<void> {
  const { error } = await browserSupabase().storage.from(bucket).upload(path, blob, { cacheControl: "31536000", upsert: false, contentType });
  if (error) throw new Error(`upload to ${bucket} failed: ${error.message}`);
}

/** Where a page picture goes inside the `media` bucket: `<uid>/<yyyy>/<uuid>.<ext>`. */
export function mediaObjectPath(uid: string, type: MediaType, now: Date = new Date(), id: string = crypto.randomUUID()): string {
  return `${uid}/${String(now.getUTCFullYear())}/${id}.${MEDIA_TYPES[type]}`;
}

/** The public address of a `media` object (served to visitors through our image optimizer). */
export function publicMediaUrl(objectPath: string, base: string = SUPABASE_URL): string {
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/media/${objectPath}`;
}

/** A base64 data URL of a picture we can store, as a file; null for anything else. */
export function dataUrlToBlob(dataUrl: string): { blob: Blob; type: MediaType } | null {
  const match = /^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  const type = match?.[1] ?? "";
  if (!match || !isMediaType(type)) return null;
  const binary = atob(match[2] ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { blob: new Blob([bytes], { type }), type };
}

export interface MediaDeps {
  /** Real accounts are on (otherwise pictures stay data URLs in the browser). */
  enabled: boolean;
  /** The signed-in account's id. */
  userId: () => Promise<string | null>;
  upload: (bucket: Bucket, path: string, blob: Blob, contentType: string) => Promise<void>;
  publicUrl: (objectPath: string) => string;
}

const browserDeps: MediaDeps = {
  enabled: supabaseEnabled,
  userId: async () => (await browserSupabase().auth.getSession()).data.session?.user.id ?? null,
  upload: uploadToBucket,
  publicUrl: (objectPath) => publicMediaUrl(objectPath),
};

/** Uploads a picture given as a data URL to the account's media folder and answers its public address. */
export async function uploadDataUrl(dataUrl: string, deps: MediaDeps = browserDeps): Promise<string> {
  const file = dataUrlToBlob(dataUrl);
  if (!file) throw new Error("not a storable picture");
  const uid = await deps.userId();
  if (!uid) throw new Error("not signed in");
  const path = mediaObjectPath(uid, file.type);
  await deps.upload("media", path, file.blob, file.type);
  return deps.publicUrl(path);
}

/**
 * A prepared picture as it is kept in the page: in real mode its Storage address (uploaded now), in
 * the demo the data URL unchanged. Throws when the upload fails (the caller says so on screen).
 */
export async function storePreparedImage(prepared: PreparedImage, deps: MediaDeps = browserDeps): Promise<PreparedImage> {
  if (!deps.enabled) return prepared;
  return { ...prepared, src: await uploadDataUrl(prepared.src, deps) };
}
