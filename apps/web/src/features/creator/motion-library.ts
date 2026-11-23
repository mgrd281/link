/**
 * Linkyo's own moving pictures that any page may use as its moving header (profile.motion): original
 * illustrated loops drawn for Linkyo (sources in .claude/skills/linkyo-media-assets/scripts), served
 * from /media/motion like every sample clip, so a page that uses one loads nothing from elsewhere.
 * Each comes with its first frame as a sample picture: chosen as the header, it is the still that
 * shows before the clip starts and for visitors who prefer less motion, so nothing jumps.
 */
export interface MotionClip {
  /** "sample:motion-<key>" plays /media/motion/<key>.mp4. */
  key: string;
  /** The first frame, a sample picture ("sample:ex-motion-<key>"), 4 : 5. */
  poster: string;
  seconds: number;
  topic: "warehouse";
}

export const MOTION_LIBRARY: readonly MotionClip[] = [
  { key: "lagerarbeit", poster: "sample:ex-motion-lagerarbeit", seconds: 18, topic: "warehouse" },
  { key: "ware-scannen", poster: "sample:ex-motion-ware-scannen", seconds: 8, topic: "warehouse" },
];

const PREFIX = "sample:motion-";

/** The profile's motion value for a library clip. */
export const motionSrc = (clip: MotionClip): string => `${PREFIX}${clip.key}`;

/** The library clip a profile's motion value plays, if it is one. */
export function libraryClip(src: string | undefined): MotionClip | undefined {
  if (!src?.startsWith(PREFIX)) return undefined;
  const key = src.slice(PREFIX.length);
  return MOTION_LIBRARY.find((clip) => clip.key === key);
}
