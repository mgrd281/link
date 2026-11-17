import type { CreatorTemplateId } from "@linkyo/tokens";
import { tokens } from "@linkyo/tokens";
import type { StaticImageData } from "next/image";

import pageAr from "@/assets/marketing/page-ar.jpg";
import pageDe from "@/assets/marketing/page-de.jpg";
import atelierAr from "@/assets/marketing/phone-atelier-ar.jpg";
import atelierDe from "@/assets/marketing/phone-atelier-de.jpg";
import daylightAr from "@/assets/marketing/phone-daylight-ar.jpg";
import daylightDe from "@/assets/marketing/phone-daylight-de.jpg";
import marqueeAr from "@/assets/marketing/phone-marquee-ar.jpg";
import marqueeDe from "@/assets/marketing/phone-marquee-de.jpg";
import nocturneAr from "@/assets/marketing/phone-nocturne-ar.jpg";
import nocturneDe from "@/assets/marketing/phone-nocturne-de.jpg";
import pulseAr from "@/assets/marketing/phone-pulse-ar.jpg";
import pulseDe from "@/assets/marketing/phone-pulse-de.jpg";

/**
 * Marketing imagery = real Linkyo creator pages (our own sample creators, captured from the product)
 * shown on phones — brand §10: "real creator pages on phones, dark studio backgrounds".
 */
const phones: Record<"de" | "ar", Record<CreatorTemplateId, StaticImageData>> = {
  de: { nocturne: nocturneDe, daylight: daylightDe, marquee: marqueeDe, pulse: pulseDe, atelier: atelierDe },
  ar: { nocturne: nocturneAr, daylight: daylightAr, marquee: marqueeAr, pulse: pulseAr, atelier: atelierAr },
};

export const phoneShots = (locale: string) => phones[locale === "ar" ? "ar" : "de"];
export const fullPage = (locale: string): StaticImageData => (locale === "ar" ? pageAr : pageDe);

/** Phone screen proportions of the captures (iPhone-class 390 × 844 viewport). */
export const PHONE_SCREEN_RATIO = 844 / 390;

const px = (n: number): string => `${n}px`;
/** `sizes` hints derived from layout tokens (no raw lengths in components). */
export const phoneSizes = {
  hero: `(max-width: ${px(tokens.breakpoint.lg)}) 45vw, ${px(Math.round(tokens.layout.creator / 2))}`,
  side: `(max-width: ${px(tokens.breakpoint.lg)}) 36vw, ${px(Math.round(tokens.layout.creator / 2.6))}`,
  rail: `(max-width: ${px(tokens.breakpoint.sm)}) 44vw, ${px(tokens.layout.menu)}`,
  story: px(tokens.layout.preview),
} as const;
