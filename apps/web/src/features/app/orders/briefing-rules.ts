/**
 * What a briefing may hold, checked in the form before anything is sent. Sending locks the briefing
 * for good (changes then come as a revision round), so nothing is left out silently: an empty
 * briefing is not sent, links beyond the limit stop the sending, and every photo that was not taken
 * is counted and named on screen. The route (`/api/orders/<id>/briefing`) has the same limits.
 */

import { z } from "zod";

/** File types the `briefing` bucket accepts, with their extension. */
export const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
export const MAX_PHOTOS = 10;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_LINKS = 20;

/** The links as they are sent: one per line, trimmed, empty lines left out. All of them (no cut). */
export function briefingLinks(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export type BriefingProblem = "empty" | "tooManyLinks";

/**
 * Why this briefing cannot be sent, or null. Empty means neither a link nor a wish: photos alone
 * tell the team nothing about what the page is for (the route refuses that too).
 */
export function briefingProblem(input: { links: readonly string[]; wishes: string }): BriefingProblem | null {
  if (input.links.length > MAX_LINKS) return "tooManyLinks";
  if (input.links.length === 0 && input.wishes.trim() === "") return "empty";
  return null;
}

/**
 * The picked files that can be added now, in the order they were picked, and how many were left out:
 * a type the bucket does not take (also a file whose type the browser could not tell), more than 10
 * MB, or no room left under the photo limit.
 */
export function choosePhotos<T extends { type: string; size: number }>(picked: readonly T[], alreadyAdded: number): { kept: T[]; skipped: number } {
  const fitting = picked.filter((file) => file.type in PHOTO_TYPES && file.size <= MAX_PHOTO_BYTES);
  const kept = fitting.slice(0, Math.max(0, MAX_PHOTOS - alreadyAdded));
  return { kept, skipped: picked.length - kept.length };
}

/**
 * The briefing as the route takes it: the same limits, and the same refusal of an empty one (neither
 * a link nor a wish) as the form. The form is not the only way to reach the route, and a sent
 * briefing is locked for good.
 */
export const briefingSchema = z
  .object({
    links: z.array(z.string().trim().min(1).max(500)).max(MAX_LINKS),
    photos: z.array(z.string().min(1).max(300)).max(MAX_PHOTOS),
    wishes: z.string().trim().max(2000),
    pageLocale: z.enum(["de", "en", "ar"]),
  })
  .refine((value) => value.links.length > 0 || value.wishes.length > 0);
