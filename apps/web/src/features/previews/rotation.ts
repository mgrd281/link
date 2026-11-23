import type { Page } from "@linkyo/blocks";

import { MOTION_LIBRARY, withLibraryClip, type MotionClip } from "@/features/creator/motion-library";

/**
 * Where this server instance stands in the rotation: one step on every page it renders, from a random
 * start, so a visitor who refreshes sees the next clip (not merely a random one, which would repeat a
 * clip one time in four), and two instances do not walk in step. Nothing is stored on the visitor's
 * device: creator pages set no cookies.
 */
let turn = Math.floor(Math.random() * MOTION_LIBRARY.length);

/** The rotation's clips that exist in the library, in the order given. */
export function rotationClips(keys: readonly string[]): MotionClip[] {
  return keys.flatMap((key) => MOTION_LIBRARY.filter((clip) => clip.key === key));
}

/**
 * The page with the rotation's next clip as its moving header and that clip's first frame as its
 * header picture, described in the page's language (so the still and the film always belong
 * together). A rotation without a known clip leaves the page as it is.
 */
export function nextInRotation(page: Page, keys: readonly string[]): Page {
  const clips = rotationClips(keys);
  if (clips.length === 0) return page;
  const clip = clips[turn % clips.length] ?? clips[0];
  turn = (turn + 1) % (clips.length * 1_000);
  return clip ? { ...page, profile: withLibraryClip(page.profile, clip) } : page;
}
