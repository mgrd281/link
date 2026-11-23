/**
 * What kind of page someone is making. Asked first in the welcome flow: it picks a fitting template
 * and decides which few questions come next (a shop is asked for its address and opening hours, a
 * TikToker for their handle and whether they go live). Everything stays editable afterwards.
 *
 * Lives here (not in the web app) because the AI page plan (`./ai-plan`) offers exactly these kinds.
 */
export const KINDS = [
  "tiktok",
  "instagram",
  "youtube",
  "apps",
  "streamer",
  "podcast",
  "music",
  "affiliate",
  "store",
  "marketing",
  "shop",
  "business",
  "coach",
  "developer",
  "designer",
  "photographer",
  "writer",
  "journalist",
  "engineer",
  "lawyer",
  "freelancer",
  "student",
  "warehouse",
  "other",
] as const;
export type CreatorKind = (typeof KINDS)[number];

export const isKind = (value: unknown): value is CreatorKind => typeof value === "string" && (KINDS as readonly string[]).includes(value);
