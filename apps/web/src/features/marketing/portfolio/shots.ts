import type { StaticImageData } from "next/image";

import type { LookId } from "@/features/examples/looks";

import ronjaHafenlicht from "./shots/ronja-feldkamp.hafenlicht.jpg";
import ronjaLaptop from "./shots/ronja-feldkamp.laptop.jpg";

/**
 * Pictures of real example pages for the Portfolio page, taken from the running product by
 * `node scripts/capture-example-shots.mjs laptop:<slug> project:<slug>/<project>` (the phone
 * pictures of the first screen are the homepage's, in ../examples.ts):
 *
 * - LAPTOP: the first screen at 1440 × 810, for the laptop frame in the opening;
 * - PROJECT: one project page on a phone, for "What a project page can do".
 *
 * The photos are the examples' own (Unsplash, see assets/examples/CREDITS.md).
 */
export const LAPTOP_SHOTS: Partial<Record<LookId, StaticImageData>> = {
  "ronja-feldkamp": ronjaLaptop,
};

export const PROJECT_SHOTS: Partial<Record<LookId, { project: string; image: StaticImageData }>> = {
  "ronja-feldkamp": { project: "hafenlicht", image: ronjaHafenlicht },
};
