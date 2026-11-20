import { tokens } from "@linkyo/tokens";

/** Phone screen proportions of the captures (iPhone-class 390 × 844 viewport). */
export const PHONE_SCREEN_RATIO = 844 / 390;

const px = (n: number): string => `${n}px`;
/** The round faces under the hero's pages (touch-target size). */
export const faceSize = px(tokens.size.touchTarget);
/** `sizes` hints derived from layout tokens (no raw lengths in components). */
export const phoneSizes = {
  hero: `(max-width: ${px(tokens.breakpoint.lg)}) 45vw, ${px(Math.round(tokens.layout.creator / 2))}`,
  side: `(max-width: ${px(tokens.breakpoint.lg)}) 36vw, ${px(Math.round(tokens.layout.creator / 2.6))}`,
  rail: `(max-width: ${px(tokens.breakpoint.sm)}) 44vw, ${px(tokens.layout.menu)}`,
  story: px(tokens.layout.preview),
} as const;
