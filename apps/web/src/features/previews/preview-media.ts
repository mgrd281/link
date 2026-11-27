import type { StaticImageData } from "next/image";

import sevagAvatar from "@/assets/previews/sevag-avatar.jpg";
import sevagPortrait from "@/assets/previews/sevag-portrait.jpg";

/**
 * Photos the person a prepared page is for gave the Linkyo team for that page (never stock, never a
 * drawing). The CV prints them as the applicant's photo (features/documents/photo.ts); everything
 * else treats them like any sample picture.
 */
export const previewMedia = {
  "sample:pv-sevag-avatar": sevagAvatar,
  "sample:pv-sevag-portrait": sevagPortrait,
} satisfies Record<string, StaticImageData>;
