import { creatorTokens } from "@linkyo/tokens";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

import type { CreatorKind } from "@/features/app/kinds";
import { STAR_LOOKS } from "@/features/previews/stars-looks";

/**
 * The example gallery: one fictional person or business per kind of page, each in its own look.
 * This file holds only what the browser needs (look, kind, category, language), so "Use this
 * template" can start an account with exactly that look; the page content lives in catalog.ts.
 */
/** Accent colors come from the tokens (no raw colors in app code). */
const SW = creatorTokens.swatches;

export const CATEGORIES = ["creators", "online", "tech", "music", "sport", "film", "business", "public", "local", "careers", "people"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Look {
  kind: CreatorKind;
  category: Category;
  locale: "de" | "en" | "ar";
  theme: CreatorThemeConfig;
}

export const LOOKS = {
  // Sport
  "rafael-duarte": { kind: "other", category: "sport", locale: "en", theme: { template: "pulse", accent: SW.pitch, pairing: "bold", buttonShape: "square" } },
  "lena-vogt": { kind: "other", category: "sport", locale: "de", theme: { template: "daylight", accent: SW.flame, pairing: "modern", buttonStyle: "filled", buttonShape: "pill" } },
  "fc-kiezkicker": { kind: "business", category: "sport", locale: "de", theme: { template: "marquee", accent: SW.pine, pairing: "bold" } },
  // Business
  "adrian-kessler": { kind: "business", category: "business", locale: "en", theme: { template: "nocturne", accent: SW.sky, pairing: "tech", buttonStyle: "outline" } },
  "karim-almansour": { kind: "business", category: "business", locale: "ar", theme: { template: "atelier", accent: SW.brass, mode: "light" } },
  "nordstadt-bank": { kind: "business", category: "business", locale: "de", theme: { template: "marquee", accent: SW.navy, pairing: "modern", mode: "light", buttonShape: "rounded" } },
  "malik-immobilien": { kind: "business", category: "business", locale: "de", theme: { template: "atelier", accent: SW["deep-sea"], pairing: "modern", buttonShape: "pill" } },
  // Public life
  "julia-brandt": { kind: "other", category: "public", locale: "de", theme: { template: "daylight", accent: SW.teal, pairing: "modern", buttonStyle: "soft" } },
  "daniel-okafor": { kind: "other", category: "public", locale: "en", theme: { template: "atelier", accent: SW.oxblood, pairing: "editorial" } },
  "bruecken-ev": { kind: "business", category: "public", locale: "de", theme: { template: "marquee", accent: SW.poppy, pairing: "modern", mode: "light" } },
  // Music
  "adam-nour": { kind: "music", category: "music", locale: "ar", theme: { template: "nocturne", accent: SW.saffron, buttonStyle: "glass" } },
  "mara-vale": { kind: "music", category: "music", locale: "en", theme: { template: "pulse", accent: SW.flamingo, pairing: "stage", buttonShape: "pill" } },
  "zwei-kaffee": { kind: "podcast", category: "music", locale: "de", theme: { template: "pulse", accent: SW.grape, pairing: "modern", buttonStyle: "shadow" } },
  // Film
  "karam-haddad": { kind: "other", category: "film", locale: "ar", theme: { template: "nocturne", accent: SW.ruby, buttonStyle: "minimal" } },
  "sofia-laurent": { kind: "other", category: "film", locale: "en", theme: { template: "atelier", accent: SW.mauve, pairing: "elegant", mode: "dark" } },
  // Creators
  "jonas-brenner": { kind: "youtube", category: "creators", locale: "de", theme: { template: "pulse", accent: SW.signal, pairing: "bold", buttonStyle: "soft" } },
  "matbakh-reem": { kind: "youtube", category: "creators", locale: "ar", theme: { template: "daylight", accent: SW.terracotta } },
  "coach-yara": { kind: "instagram", category: "creators", locale: "en", theme: { template: "pulse", accent: SW.mint, pairing: "bold", buttonShape: "pill" } },
  "lina-beauty": { kind: "instagram", category: "creators", locale: "ar", theme: { template: "daylight", accent: SW.rose, buttonStyle: "soft", buttonShape: "pill" } },
  "timo-lacht": { kind: "tiktok", category: "creators", locale: "de", theme: { template: "pulse", accent: SW.lemon, pairing: "bold", buttonStyle: "shadow" } },
  "novaplays": { kind: "streamer", category: "creators", locale: "en", theme: { template: "nocturne", accent: SW.aqua, pairing: "tech", buttonStyle: "outline", buttonShape: "square" } },
  "sami-travels": { kind: "instagram", category: "creators", locale: "ar", theme: { template: "pulse", accent: SW.apricot } },
  "nina-falk": { kind: "business", category: "creators", locale: "de", theme: { template: "nocturne", accent: SW.ink, pairing: "editorial", mode: "light", buttonStyle: "minimal" } },
  "omar-saleh": { kind: "other", category: "creators", locale: "ar", theme: { template: "atelier", accent: SW.clay, mode: "light" } },
  "clara-wendt": { kind: "writer", category: "creators", locale: "de", theme: { template: "atelier", accent: SW.wine, pairing: "elegant" } },
  // Online business: affiliate creators, online retailers, marketing, courses
  "felix-deals": { kind: "affiliate", category: "online", locale: "de", theme: { template: "daylight", accent: SW.signal, pairing: "modern", buttonStyle: "shadow", buttonShape: "pill" } },
  "maya-finds": { kind: "affiliate", category: "online", locale: "en", theme: { template: "atelier", accent: SW.rose, pairing: "elegant", mode: "light", buttonShape: "pill" } },
  "nordlicht-sneaker": { kind: "store", category: "online", locale: "de", theme: { template: "nocturne", accent: SW.lemon, pairing: "bold", buttonStyle: "filled", buttonShape: "square" } },
  "rihana-store": { kind: "store", category: "online", locale: "ar", theme: { template: "atelier", accent: SW["gold-leaf"], mode: "dark", buttonShape: "pill" } },
  "hanna-berger": { kind: "marketing", category: "online", locale: "de", theme: { template: "daylight", accent: SW.grape, pairing: "modern", buttonStyle: "soft", buttonShape: "pill" } },
  brightfunnel: { kind: "marketing", category: "online", locale: "en", theme: { template: "pulse", accent: SW.tangerine, pairing: "bold", buttonStyle: "shadow" } },
  "excel-ahmed": { kind: "coach", category: "online", locale: "ar", theme: { template: "daylight", accent: SW.leaf, buttonStyle: "filled" } },
  // Tech & design
  "leon-park": { kind: "developer", category: "tech", locale: "en", theme: { template: "nocturne", accent: SW.mint, pairing: "tech", buttonStyle: "outline", buttonShape: "square" } },
  "yousef-codes": { kind: "developer", category: "tech", locale: "ar", theme: { template: "pulse", accent: SW["deep-sea"], pairing: "tech" } },
  "studio-mira": { kind: "designer", category: "tech", locale: "de", theme: { template: "atelier", accent: SW.terracotta, pairing: "editorial", buttonShape: "square" } },
  // Local businesses
  "baeckerei-sonnenkorn": { kind: "shop", category: "local", locale: "de", theme: { template: "marquee", accent: SW.honey, pairing: "classic", mode: "light", buttonShape: "pill" } },
  "halawiyat-alsham": { kind: "shop", category: "local", locale: "ar", theme: { template: "pulse", accent: SW.cedar, buttonStyle: "soft" } },
  "trattoria-lucia": { kind: "shop", category: "local", locale: "de", theme: { template: "daylight", accent: SW.tomato, pairing: "elegant", buttonStyle: "outline" } },
  "kings-cut": { kind: "shop", category: "local", locale: "de", theme: { template: "nocturne", accent: SW.caramel, pairing: "bold", buttonShape: "square" } },
  "zahnarzt-klein": { kind: "business", category: "local", locale: "de", theme: { template: "daylight", accent: SW.lagoon, pairing: "modern", buttonShape: "pill" } },
  "kfz-kaya": { kind: "shop", category: "local", locale: "de", theme: { template: "nocturne", accent: SW.tangerine, pairing: "bold", buttonStyle: "filled" } },
  "studio-atem": { kind: "shop", category: "local", locale: "de", theme: { template: "daylight", accent: SW.sage, pairing: "elegant", buttonStyle: "soft", buttonShape: "pill" } },
  "pflege-sonnenschein": { kind: "business", category: "local", locale: "de", theme: { template: "daylight", accent: SW.marigold, pairing: "modern", buttonShape: "rounded" } },
  "golden-day": { kind: "business", category: "local", locale: "de", theme: { template: "atelier", accent: SW["gold-leaf"], pairing: "elegant", mode: "light" } },
  "lumen-atelier": { kind: "store", category: "local", locale: "en", theme: { template: "marquee", accent: SW.sand, pairing: "elegant", buttonStyle: "outline" } },
  // Careers
  "miriam-hoffmann": { kind: "lawyer", category: "careers", locale: "de", theme: { template: "atelier", accent: SW["ink-blue"], pairing: "classic" } },
  "lukas-weber": { kind: "engineer", category: "careers", locale: "de", theme: { template: "daylight", accent: SW.apricot, pairing: "tech", buttonShape: "square" } },
  "ahmet-yilmaz": { kind: "warehouse", category: "careers", locale: "de", theme: { template: "daylight", accent: SW.leaf, pairing: "modern" } },
  "elif-demir": { kind: "student", category: "careers", locale: "de", theme: { template: "pulse", accent: SW.amethyst, pairing: "modern", buttonShape: "pill" } },
  "sarah-neumann": { kind: "coach", category: "business", locale: "de", theme: { template: "daylight", accent: SW.mauve, pairing: "elegant", buttonShape: "pill" } },
  "mathe-mit-paul": { kind: "business", category: "careers", locale: "de", theme: { template: "atelier", accent: SW.pine, pairing: "modern", buttonStyle: "soft" } },
  journalist: { kind: "journalist", category: "careers", locale: "en", theme: { template: "atelier", pairing: "editorial" } },
} as const satisfies Record<string, Look>;

export type LookId = keyof typeof LOOKS;

export const isLook = (value: unknown): value is LookId => typeof value === "string" && value in LOOKS;

/**
 * Pages of real people in the gallery ("Well-known people"): unofficial concept pages (ADR 0020) and
 * prepared previews. Only their look and kind, so "Use this template" starts with that design.
 */
export const PEOPLE_LOOKS: Record<string, { kind: CreatorKind; theme: CreatorThemeConfig }> = {
  ...STAR_LOOKS,
  nizar: { kind: "tiktok", theme: { template: "nocturne" } },
};

/** The look behind a gallery card: an example's, or a well-known person's page. */
export function findLook(value: string | null): { kind: CreatorKind; theme: CreatorThemeConfig } | null {
  if (!value) return null;
  if (isLook(value)) return LOOKS[value];
  return Object.hasOwn(PEOPLE_LOOKS, value) ? (PEOPLE_LOOKS[value] ?? null) : null;
}
