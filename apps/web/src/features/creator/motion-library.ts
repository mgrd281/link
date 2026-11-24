import type { Page } from "@linkyo/blocks";

/**
 * Linkyo's own moving pictures that any page may use as its moving header (profile.motion): original
 * illustrated loops drawn for Linkyo (sources in .claude/skills/linkyo-media-assets/scripts) and real
 * footage under a free license, cut into a loop without an identifiable face (a clip may stand for any
 * creator; credits in src/assets/examples/CREDITS.md). All are served from /media/motion like every
 * sample clip, so a page that uses one loads nothing from elsewhere.
 * Each comes with its first frame as a sample picture: chosen as the header, it is the still that
 * shows before the clip starts and for visitors who prefer less motion, so nothing jumps.
 */
export interface MotionClip {
  /** "sample:motion-<key>" plays /media/motion/<key>.mp4. */
  key: string;
  /** The first frame, a sample picture ("sample:ex-motion-<key>"). */
  poster: string;
  /** The first frame's size in px (every clip is 4 : 5). */
  w: number;
  h: number;
  seconds: number;
  topic: "warehouse";
  /** Real footage or an illustration: the picker says which, so nobody takes a drawing for a film. */
  kind: "film" | "illustration";
  /** What the still shows, in each page language (it becomes the header picture's description). */
  alt: Readonly<Record<"de" | "en" | "ar", string>>;
}

export const MOTION_LIBRARY: readonly MotionClip[] = [
  {
    key: "barcode-scannen",
    poster: "sample:ex-motion-barcode-scannen",
    w: 864,
    h: 1080,
    seconds: 6,
    topic: "warehouse",
    kind: "film",
    alt: {
      de: "Video: Eine Hand scannt mit einem Handscanner den Barcode auf einer in Folie gewickelten Palette im Lager",
      en: "Video: a hand scans the barcode on a stretch-wrapped pallet in a warehouse with a handheld scanner",
      ar: "فيديو: يد تمسح الباركود على منصة مغلّفة بالنايلون في مستودع بماسح يدوي",
    },
  },
  {
    key: "hochregal",
    poster: "sample:ex-motion-hochregal",
    w: 1080,
    h: 1350,
    seconds: 6,
    topic: "warehouse",
    kind: "film",
    alt: {
      de: "Video: Ein Schubmaststapler arbeitet vor einem Hochregal voller Paletten in einer Lagerhalle",
      en: "Video: a reach truck at work in front of a high-bay rack full of pallets in a warehouse",
      ar: "فيديو: رافعة شوكية تعمل أمام رفوف عالية مليئة بالمنصات في مستودع",
    },
  },
  {
    key: "stapler-fahren",
    poster: "sample:ex-motion-stapler-fahren",
    w: 864,
    h: 1080,
    seconds: 8,
    topic: "warehouse",
    kind: "film",
    alt: {
      de: "Video: Ein Stapler bringt eine Palette mit Kartons durch einen langen Regalgang",
      en: "Video: a forklift carries a pallet of cartons down a long warehouse aisle",
      ar: "فيديو: رافعة شوكية تنقل منصة كراتين عبر ممر طويل بين الرفوف",
    },
  },
  {
    key: "hubwagen",
    poster: "sample:ex-motion-hubwagen",
    w: 864,
    h: 1080,
    seconds: 8,
    topic: "warehouse",
    kind: "film",
    alt: {
      de: "Video: Ein Lagerarbeiter, von hinten gesehen, zieht einen Hubwagen durch die Regalgänge",
      en: "Video: a warehouse worker, seen from behind, pulls a pallet truck through the aisles",
      ar: "فيديو: عامل مستودع يظهر من الخلف يسحب رافعة منصات يدوية بين ممرات الرفوف",
    },
  },
  {
    key: "lagerarbeit",
    poster: "sample:ex-motion-lagerarbeit",
    w: 1080,
    h: 1350,
    seconds: 18,
    topic: "warehouse",
    kind: "illustration",
    alt: {
      de: "Illustration: Ein Schubmaststapler-Fahrer scannt eine Palette und hebt sie in ein Hochregal",
      en: "Illustration: a reach-truck driver scans a pallet and lifts it into a high rack",
      ar: "رسم توضيحي: سائق رافعة شوكية يمسح منصة بضائع ويرفعها إلى رف عالٍ",
    },
  },
  {
    key: "palette-packen",
    poster: "sample:ex-motion-palette-packen",
    w: 1080,
    h: 1350,
    seconds: 22,
    topic: "warehouse",
    kind: "illustration",
    alt: {
      de: "Illustration: Ein Lagerist scannt jeden Karton mit dem Handscanner, die EAN erscheint; er packt die Palette und sichert sie mit Stretchfolie",
      en: "Illustration: a warehouse worker scans each carton with a handheld scanner and its EAN comes up; he builds the pallet and secures it with stretch film",
      ar: "رسم توضيحي: عامل مستودع يمسح كل كرتونة بالماسح اليدوي فيظهر رقم EAN، ثم يجهّز المنصة ويؤمّنها بغلاف النايلون",
    },
  },
  {
    key: "ware-scannen",
    poster: "sample:ex-motion-ware-scannen",
    w: 1080,
    h: 1350,
    seconds: 8,
    topic: "warehouse",
    kind: "illustration",
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

/**
 * A profile with a library clip as its moving header and the clip's first frame as its header
 * picture (so nothing jumps when the clip starts), described in the page's language.
 */
export function withLibraryClip(profile: Page["profile"], clip: MotionClip): Page["profile"] {
  return { ...profile, motion: { src: motionSrc(clip) }, hero: { src: clip.poster, alt: clip.alt[profile.locale], w: clip.w, h: clip.h } };
}
