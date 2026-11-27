import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { hasImage, type Page } from "@linkyo/blocks";

import { posterClip } from "@/features/creator/motion-library";
import { isStorageImage, STORAGE_MEDIA_PATH } from "@/features/directions/shared/remote-images";

import { isActive } from "./input";
import { parseJpeg, type Jpeg } from "./pdf/jpeg";

/**
 * The CV's photo: only a real portrait the owner uploaded. The about block's portrait (of an about
 * block the page shows right now), else the avatar, when it is a picture of the person (no still of a
 * drawn clip) stored as a JPEG in this deployment's Storage (never a sample, a data URL or a
 * platform's picture), read server-side within 3 seconds and 2 MB, and a baseline or progressive
 * JPEG. Otherwise the CV has no picture at all: no illustration ever stands in for a person, and no
 * initials either.
 *
 * One exception: a prepared page's own photo, which the person gave the Linkyo team for that page
 * (features/previews/preview-media.ts), is read from the app's files (PREVIEW_PHOTOS below).
 *
 * The page's miniature and page count ask `photoCandidate` too, so the card and the PDF agree on
 * whether a photo stands in the head. Uploads keep their type in their name (`<uid>/<yyyy>/<uuid>.jpg`,
 * features/app/media-upload.ts): a PNG or WebP upload is no candidate (v1 embeds JPEG only).
 */

const TIMEOUT_MS = 3000;
const MAX_BYTES = 2 * 1024 * 1024;
const JPEG_NAME = /\.jpe?g$/iu;
/** A dot segment, written plainly or percent-encoded ("..", "%2e%2e", ".%2E"). */
const DOT_SEGMENT = /(?:^|\/)(?:\.|%2e){2}(?:\/|$)/iu;

/**
 * A prepared page's own photos, each read from the app's files. Each path is written out whole: the
 * build's file tracer follows only literal paths (see pdf/fonts.ts).
 */
const PREVIEW_PHOTOS: Readonly<Record<string, () => Promise<Buffer>>> = {
  "sample:pv-sevag-portrait": () => readFile(join(process.cwd(), "src/assets/previews/sevag-portrait.jpg")),
  "sample:pv-sevag-avatar": () => readFile(join(process.cwd(), "src/assets/previews/sevag-avatar.jpg")),
};

/** Whether `src` names a prepared page's own photo (a picture of the person, never stock or a drawing). */
export function isPreviewPhoto(src: string): boolean {
  return Object.hasOwn(PREVIEW_PHOTOS, src);
}

/**
 * A Storage address the server may fetch: this deployment's media bucket by origin and normalised
 * path, with no dot segment that `fetch` would resolve to another endpoint of the same host.
 */
export function storageObjectUrl(src: string, env: { supabaseUrl?: string | undefined; vercel?: string | undefined } = {}): URL | null {
  const base = env.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!base || !isStorageImage(src, env)) return null;
  try {
    const url = new URL(src);
    const raw = src.slice(url.origin.length).split(/[?#]/u)[0] ?? "";
    if (url.origin !== new URL(base).origin || DOT_SEGMENT.test(raw) || !url.pathname.startsWith(STORAGE_MEDIA_PATH)) return null;
    return url;
  } catch {
    return null;
  }
}

/** The portrait the CV would print, before its bytes are read; null when there is none. */
export function photoCandidate(page: Page, now: Date, env: { supabaseUrl?: string | undefined; vercel?: string | undefined } = {}): { src: string; focal: readonly [number, number] | undefined } | null {
  const about = page.blocks.find((block) => block.type === "about" && isActive(block, now));
  const portrait = about?.type === "about" ? about.portrait : undefined;
  const picture = hasImage(portrait) ? portrait : page.profile.avatar;
  if (!hasImage(picture) || posterClip(picture.src) !== undefined) return null;
  if (isPreviewPhoto(picture.src)) return { src: picture.src, focal: picture.focal };
  const url = storageObjectUrl(picture.src, env);
  if (!url || !JPEG_NAME.test(url.pathname)) return null;
  return { src: url.href, focal: picture.focal };
}

/** A response's body, read until it passes `limit` bytes (then null: the rest is never read). */
async function readCapped(response: Response, limit: number): Promise<Uint8Array | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes;
}

/** The portrait's bytes as a JPEG with the owner's focal point, or null (none, not ours, too slow, too large, not a JPEG). */
export async function fetchPhoto(page: Page, now: Date, load: typeof fetch = fetch): Promise<Jpeg | null> {
  const candidate = photoCandidate(page, now);
  if (!candidate) return null;
  const local = PREVIEW_PHOTOS[candidate.src];
  if (local) {
    try {
      const bytes = await local();
      const jpeg = bytes.byteLength <= MAX_BYTES ? parseJpeg(new Uint8Array(bytes)) : null;
      return jpeg ? { ...jpeg, focal: candidate.focal } : null;
    } catch {
      return null;
    }
  }
  try {
    // No redirect is followed: the bytes come from the address checked above or not at all.
    const response = await load(candidate.src, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store", redirect: "error" });
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (!response.ok || declared > MAX_BYTES) return null;
    const bytes = await readCapped(response, MAX_BYTES);
    const jpeg = bytes ? parseJpeg(bytes) : null;
    return jpeg ? { ...jpeg, focal: candidate.focal } : null;
  } catch {
    return null;
  }
}
