import type { Page } from "@linkyo/blocks";

import { MOTION_LIBRARY, withLibraryClip, type MotionClip } from "@/features/creator/motion-library";

/** The rotation's clips that exist in the library, in the order given. */
export function rotationClips(keys: readonly string[]): MotionClip[] {
  return keys.flatMap((key) => MOTION_LIBRARY.filter((clip) => clip.key === key));
}

/** One visit of a page that takes turns with clips: the clip it shows and the one a refresh shows. */
export interface RotationTurn {
  clip: MotionClip;
  next: MotionClip;
}

/**
 * The clip a visit shows: the one the address names (`?clip=<key>`), else the rotation's first, the
 * page's own clip (a first visit, a link preview, a shared link: the share button leaves the
 * parameter out). The page itself names the next clip in its address once it has loaded
 * (RotationAddress), so a refresh asks for exactly that one. Pure: whichever server copy answers, a
 * refresh never shows the clip before it again. Nothing is stored on the visitor's device and nothing
 * about them is read: creator pages set no cookies. Null when the rotation names no clip of the library.
 */
export function rotationTurn(keys: readonly string[], asked: string | readonly string[] | undefined): RotationTurn | null {
  const clips = rotationClips(keys);
  const key = typeof asked === "string" ? asked : asked?.[0];
  const index = Math.max(0, clips.findIndex((clip) => clip.key === key));
  const clip = clips[index];
  const next = clips[(index + 1) % clips.length];
  return clip && next ? { clip, next } : null;
}

/**
 * The page with that clip as its moving header and the clip's first frame as its header picture,
 * described in the page's language (so the still and the film always belong together).
 */
export function withRotationClip(page: Page, clip: MotionClip): Page {
  return { ...page, profile: withLibraryClip(page.profile, clip) };
}
