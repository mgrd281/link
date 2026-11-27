import "server-only";

import { hasImage, type Page } from "@linkyo/blocks";

import { posterClip } from "@/features/creator/motion-library";
import { isStorageImage } from "@/features/directions/shared/remote-images";

import { parseJpeg, type Jpeg } from "./pdf/jpeg";

/**
 * The CV's photo: only a real portrait the owner uploaded. The about block's portrait, else the
 * avatar, when it is a picture of the person (no still of a drawn clip) stored in this deployment's
 * Storage (never a sample, a data URL or a platform's picture), read server-side within 3 seconds
 * and 2 MB, and a baseline or progressive JPEG. Otherwise the CV has no picture at all: no
 * illustration ever stands in for a person, and no initials either.
 */

const TIMEOUT_MS = 3000;
const MAX_BYTES = 2 * 1024 * 1024;

/** The portrait the CV would print, before its bytes are read; null when there is none. */
export function photoCandidate(page: Page): { src: string } | null {
  const about = page.blocks.find((block) => block.type === "about" && block.visible);
  const portrait = about?.type === "about" ? about.portrait : undefined;
  const picture = hasImage(portrait) ? portrait : page.profile.avatar;
  if (!hasImage(picture) || posterClip(picture.src) !== undefined || !isStorageImage(picture.src)) return null;
  return { src: picture.src };
}

/** The portrait's bytes as a JPEG, or null (none, not ours, too slow, too large, not a JPEG). */
export async function fetchPhoto(page: Page, load: typeof fetch = fetch): Promise<Jpeg | null> {
  const candidate = photoCandidate(page);
  if (!candidate) return null;
  try {
    const response = await load(candidate.src, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (!response.ok || declared > MAX_BYTES) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length > MAX_BYTES ? null : parseJpeg(bytes);
  } catch {
    return null;
  }
}
