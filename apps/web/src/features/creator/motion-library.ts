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
  /** The first frame, a sample picture ("sample:ex-motion-<key>"). */
  poster: string;
  /** The first frame's size in px (every clip is 4 : 5, 1080 × 1350). */
  w: number;
  h: number;
  seconds: number;
  topic: "warehouse";
  /** What the still shows, in each page language (it becomes the header picture's description). */
  alt: Readonly<Record<"de" | "en" | "ar", string>>;
}

export const MOTION_LIBRARY: readonly MotionClip[] = [
  {
    key: "lagerarbeit",
    poster: "sample:ex-motion-lagerarbeit",
    w: 1080,
    h: 1350,
    seconds: 18,
    topic: "warehouse",
    alt: {
      de: "Illustration: Ein Schubmaststapler-Fahrer scannt eine Palette und hebt sie in ein Hochregal",
      en: "Illustration: a reach-truck driver scans a pallet and lifts it into a high rack",
      ar: "رسم توضيحي: سائق رافعة شوكية يمسح منصة بضائع ويرفعها إلى رف عالٍ",
    },
  },
  {
    key: "ware-scannen",
    poster: "sample:ex-motion-ware-scannen",
    w: 1080,
    h: 1350,
    seconds: 8,
    topic: "warehouse",
    alt: {
      de: "Illustration: Ein Lagerist scannt Kartons auf einem Rollenband, das Terminal bestätigt jeden Scan",
      en: "Illustration: a warehouse worker scans cartons on a roller conveyor; the terminal confirms each scan",
      ar: "رسم توضيحي: عامل مستودع يمسح الكراتين على سير بكرات، والجهاز يؤكد كل عملية مسح",
    },
  },
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

/** The library clip whose still a header picture is, if it is one. */
export const posterClip = (src: string | undefined): MotionClip | undefined => MOTION_LIBRARY.find((clip) => clip.poster === src);
