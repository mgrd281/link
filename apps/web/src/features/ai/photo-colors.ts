"use client";

import { extractSeed } from "@linkyo/tokens/creator";

import { prepareImage, type PreparedImage } from "@/features/app/images";

/**
 * Colours for the AI draft from the owner's photo, measured in the browser: the photo never goes to
 * the AI (only two colours and a mode do), and it is uploaded only when the draft is used (then it
 * becomes the profile picture, through `storePreparedImage`).
 */

export interface PhotoColors {
  vibrant: string;
  dominant: string;
  mode: "light" | "dark" | "vivid";
}

/** The side of the canvas the colours are measured on (64 × 64 pixels are plenty for two colours). */
const SAMPLE = 64;

const HEX = /^#[0-9a-f]{6}$/i;

async function sample(src: string): Promise<Uint8ClampedArray> {
  const image = new Image();
  image.src = src;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("no canvas");
  context.drawImage(image, 0, 0, SAMPLE, SAMPLE);
  return context.getImageData(0, 0, SAMPLE, SAMPLE).data;
}

/** Resizes the picked photo (as the profile photo would be) and measures its colours. */
export async function photoColors(file: File): Promise<{ prepared: PreparedImage; colors: PhotoColors }> {
  const prepared = await prepareImage(file, "avatar");
  const seed = extractSeed(await sample(prepared.src));
  const colors: PhotoColors = { vibrant: seed.vibrant.toLowerCase(), dominant: seed.dominant.toLowerCase(), mode: seed.mode };
  if (!HEX.test(colors.vibrant) || !HEX.test(colors.dominant)) throw new Error("no colours");
  return { prepared, colors };
}
