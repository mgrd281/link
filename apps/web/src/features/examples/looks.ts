import { creatorTokens } from "@linkyo/tokens";
import { TEMPLATE_IDS, type CreatorThemeConfig } from "@linkyo/tokens/creator";

import type { CreatorKind } from "@/features/app/kinds";
import { STAR_LOOKS } from "@/features/previews/stars-looks";

/**
 * The example gallery: one fictional person or business per kind of page, each in its own look.
 * This file holds only what the browser needs (look, kind, category, language), so "Use this
 * template" can start an account with exactly that look; the page content lives in catalog.ts.
 */
/** Accent colors come from the tokens (no raw colors in app code). */
const SW = creatorTokens.swatches;

/** In the order of the filter chips: the biggest audiences first. */
export const CATEGORIES = ["creators", "portfolio", "music", "local", "online", "sport", "tech", "business", "careers", "film", "public", "people"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Look {
  kind: CreatorKind;
  category: Category;
  locale: "de" | "en" | "ar";
  theme: CreatorThemeConfig;
  /**
   * Who took the page's photographs. A portfolio shows pictures as the person's own work, so an
   * example page names the photographers in its "Example" note (assets/examples/CREDITS.md has the
   * licences).
   */
  credit?: string;
  /**
   * Some of the page's pictures are original Linkyo drawings (boards, plans, screens), not
   * photographs: the note then says so instead of crediting every picture to the photographers.
   */
  drawings?: true;
}

export const LOOKS = {
  // Portfolios on the two portfolio templates: a photographer, an engineer, a coach and a carpenter.
  // With the two portfolios on Folio (an architecture photographer, an open-source author) they make
  // the gallery's "Portfolio" category, which the /portfolio page and the homepage band read.
  "ronja-feldkamp": { kind: "photographer", category: "portfolio", locale: "de", theme: { template: "werkbogen" }, credit: "Paul Einerhand, Metin Ozer, Bob van Aubel, Declan Sun, Peyman Shojaei (Unsplash)" },
  "tobin-achterberg": { kind: "developer", category: "portfolio", locale: "en", theme: { template: "tiefdruck" }, credit: "Vitaly Gariev (Unsplash)", drawings: true },
  "naya-aldabbas": { kind: "coach", category: "portfolio", locale: "ar", theme: { template: "werkbogen", accent: SW.oxblood }, credit: "Lisa Marie Theck (Unsplash)" },
  // Brass, not an orange: the page's one accent on a warm black ground. The owner chose the grid over the template's list.
  "jorinde-ahlfeld": { kind: "freelancer", category: "portfolio", locale: "de", theme: { template: "tiefdruck", accent: SW.brass, projects: "bento" }, credit: "Caroline Badran, Josh Davies, Bailey Alexander, mahdi chaghari (Unsplash)" },
  // The three Stage 3 portfolio templates as they come, one person each (catalog-i.ts): a dance and stage
  // photographer on Leuchttisch, an architect in Amman on Grundriss, a firmware developer and hardware
  // maker on Logbuch. Merle's work is photographs (credited); Rana's and Ines's are original drawings.
  "merle-kastorf": { kind: "photographer", category: "portfolio", locale: "de", theme: { template: "leuchttisch" }, credit: "Ahmad Odeh, Samantha Weisburg, Hossein Nasr, Kazuo ota, Marissa Lewis (Unsplash)" },
  "rana-al-khatib": { kind: "designer", category: "portfolio", locale: "ar", theme: { template: "grundriss" }, credit: "kilarov (Unsplash)", drawings: true },
  "ines-vasconcelos": { kind: "engineer", category: "portfolio", locale: "en", theme: { template: "logbuch" }, credit: "ThisisEngineering (Unsplash)", drawings: true },
  // Apps and skills (ADR 0055): an app explainer and a skills author, first in the gallery.
  "merve-aksoy": { kind: "apps", category: "tech", locale: "de", theme: { template: "aura", accent: SW.sky } },
  "arjun-mehta": { kind: "developer", category: "portfolio", locale: "en", theme: { template: "folio", accent: SW["ink-blue"] } },
  // The five newer templates, one example each (ADR 0054): first in the gallery.
  lenz: { kind: "music", category: "music", locale: "de", theme: { template: "studio" } },
  "mira-sol": { kind: "coach", category: "creators", locale: "en", theme: { template: "aura" } },
  "jonas-ek": { kind: "designer", category: "portfolio", locale: "de", theme: { template: "folio" } },
  "rina-vex": { kind: "streamer", category: "creators", locale: "en", theme: { template: "signal" } },
  "dana-issa": { kind: "business", category: "local", locale: "ar", theme: { template: "bloom" } },
  // Spotlight: magazine-style pages of people, first in the gallery. Full-colour portraits on templates
  // that keep the photo's own colors (no duotone); vivid mode puts the page in the photo's color.
  "lou-ferreira": { kind: "instagram", category: "creators", locale: "de", theme: { template: "nocturne", accent: SW.ruby, mode: "vivid", pairing: "elegant", buttonShape: "pill" } },
  "juno-kade": { kind: "music", category: "music", locale: "en", theme: { template: "nocturne", accent: SW.flamingo, neutral: SW.navy, tint: 1, pairing: "stage", buttonStyle: "filled", buttonShape: "pill" } },
  "fenja-roth": { kind: "other", category: "sport", locale: "de", theme: { template: "daylight", accent: SW.sky, mode: "vivid", pairing: "bold", buttonShape: "pill" } },
  "nico-hale": { kind: "other", category: "film", locale: "en", theme: { template: "atelier", accent: SW.tangerine, mode: "dark", pairing: "editorial", buttonStyle: "filled" } },
  "salma-rahhal": { kind: "instagram", category: "creators", locale: "ar", theme: { template: "daylight", accent: SW.rose, neutral: SW.flamingo, tint: 1, buttonStyle: "filled", buttonShape: "pill" } },
  "elias-navarro": { kind: "coach", category: "sport", locale: "en", theme: { template: "daylight", accent: SW.tangerine, neutral: SW.apricot, tint: 0.8, pairing: "bold", buttonStyle: "filled", buttonShape: "pill" } },
  "layal-mansour": { kind: "music", category: "music", locale: "ar", theme: { template: "daylight", accent: SW.cyan, mode: "vivid", buttonShape: "pill" } },
  "tomas-reyes": { kind: "youtube", category: "creators", locale: "de", theme: { template: "nocturne", accent: SW.apricot, neutral: SW.tangerine, tint: 0.6, pairing: "modern", buttonShape: "pill" } },
  // Spotlight, second set: young men, each look taken from the colours of the portrait.
  "yazan-khoury": { kind: "music", category: "music", locale: "ar", theme: { template: "nocturne", accent: SW.rose, neutral: SW.wine, tint: 1, buttonStyle: "filled", buttonShape: "pill" } },
  "kai-moreno": { kind: "youtube", category: "creators", locale: "en", theme: { template: "nocturne", accent: SW.amethyst, mode: "vivid", pairing: "modern", buttonShape: "rounded" } },
  "moritz-albrecht": { kind: "lawyer", category: "careers", locale: "de", theme: { template: "nocturne", accent: SW.sky, neutral: SW["ink-blue"], tint: 1, pairing: "elegant", buttonStyle: "filled", buttonShape: "rounded" } },
  "noah-sarkis": { kind: "writer", category: "creators", locale: "en", theme: { template: "atelier", accent: SW.honey, neutral: SW.sage, tint: 0.5, mode: "dark", pairing: "editorial" } },
  "theo-baptiste": { kind: "tiktok", category: "creators", locale: "en", theme: { template: "nocturne", accent: SW.flame, pairing: "stage", buttonStyle: "filled", buttonShape: "pill" } },
  "noel-amadi": { kind: "affiliate", category: "online", locale: "de", theme: { template: "nocturne", accent: SW.marigold, neutral: SW.pine, tint: 0.7, pairing: "modern", buttonShape: "pill" } },
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
  "nela-voss": { kind: "music", category: "music", locale: "de", theme: { template: "mono" } },
  // Film
  "karam-haddad": { kind: "other", category: "film", locale: "ar", theme: { template: "nocturne", accent: SW.ruby, buttonStyle: "minimal" } },
  "sofia-laurent": { kind: "other", category: "film", locale: "en", theme: { template: "atelier", accent: SW.mauve, pairing: "elegant", mode: "dark" } },
  // Creators
  "jonas-brenner": { kind: "youtube", category: "creators", locale: "de", theme: { template: "pulse", accent: SW.signal, pairing: "bold", buttonStyle: "soft" } },
  "matbakh-reem": { kind: "youtube", category: "creators", locale: "ar", theme: { template: "daylight", accent: SW.terracotta } },
  "coach-yara": { kind: "instagram", category: "creators", locale: "en", theme: { template: "pulse", accent: SW.mint, pairing: "bold", buttonShape: "pill" } },
  "lina-beauty": { kind: "instagram", category: "creators", locale: "ar", theme: { template: "daylight", accent: SW.rose, buttonStyle: "soft", buttonShape: "pill" } },
  "timo-lacht": { kind: "tiktok", category: "creators", locale: "de", theme: { template: "pulse", accent: SW.poppy, pairing: "bold", buttonStyle: "shadow" } },
  "novaplays": { kind: "streamer", category: "creators", locale: "en", theme: { template: "nocturne", accent: SW.aqua, pairing: "tech", buttonStyle: "outline", buttonShape: "square" } },
  "sami-travels": { kind: "instagram", category: "creators", locale: "ar", theme: { template: "pulse", accent: SW.apricot } },
  "nina-falk": { kind: "business", category: "creators", locale: "de", theme: { template: "nocturne", accent: SW.ink, pairing: "editorial", mode: "light", buttonStyle: "minimal" } },
  "omar-saleh": { kind: "other", category: "creators", locale: "ar", theme: { template: "atelier", accent: SW.clay, mode: "light" } },
  "clara-wendt": { kind: "writer", category: "creators", locale: "de", theme: { template: "atelier", accent: SW.wine, pairing: "elegant" } },
  // Online business: affiliate creators, online retailers, marketing, courses
  "felix-deals": { kind: "affiliate", category: "online", locale: "de", theme: { template: "daylight", accent: SW.signal, pairing: "modern", buttonStyle: "shadow", buttonShape: "pill" } },
  "maya-finds": { kind: "affiliate", category: "online", locale: "en", theme: { template: "atelier", accent: SW.rose, pairing: "elegant", mode: "light", buttonShape: "pill" } },
  "nordlicht-sneaker": { kind: "store", category: "online", locale: "de", theme: { template: "nocturne", accent: SW.lemon, pairing: "bold", buttonStyle: "filled", buttonShape: "square" } },
  "oud-boutique": { kind: "store", category: "online", locale: "ar", theme: { template: "atelier", accent: SW["gold-leaf"], mode: "dark", buttonShape: "pill" } },
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

/**
 * The gallery opens with these: the most vivid pages, one per template where possible (ADR 0054
 * and 0055 pages included), then every other look in the order above.
 */
export const GALLERY_LEAD: readonly LookId[] = [
  "lou-ferreira", "juno-kade", "salma-rahhal", "fenja-roth", "kai-moreno", "layal-mansour", "lenz", "nico-hale",
  "yazan-khoury", "tomas-reyes", "rina-vex", "dana-issa", "merve-aksoy", "arjun-mehta", "mira-sol", "jonas-ek",
  "ronja-feldkamp", "merle-kastorf", "rana-al-khatib", "ines-vasconcelos",
];

/** Pages of well-known people, those creators know best first. */
export const PEOPLE_ORDER: readonly string[] = [
  "taylor-swift", "mrbeast", "cristiano", "messi", "mo-salah", "nadine-njeim", "alshami", "taim-hassan", "nizar",
  "elon-musk", "jeff-bezos", "friedrich-merz", "donald-trump",
];

export const isLook = (value: unknown): value is LookId => typeof value === "string" && value in LOOKS;

/**
 * Pages of real people in the gallery ("Well-known people"): unofficial concept pages (ADR 0020) and
 * prepared previews. Only their look and kind, so "Use this template" starts with that design.
 */
export const PEOPLE_LOOKS: Record<string, { kind: CreatorKind; theme: CreatorThemeConfig }> = {
  ...STAR_LOOKS,
  nizar: { kind: "tiktok", theme: { template: "nocturne" } },
};

/**
 * The two numbers the website quotes, one vocabulary in every language: designs are the templates
 * in the tokens, example pages every page the gallery lists. Copy takes them as placeholders
 * ({designs}, {pages}), so a new template or example never touches a sentence.
 */
export const SITE_COUNTS = {
  designs: TEMPLATE_IDS.length,
  pages: Object.keys(LOOKS).length + Object.keys(PEOPLE_LOOKS).length,
} as const;

/** The look behind a gallery card: an example's, or a well-known person's page. */
export function findLook(value: string | null): { kind: CreatorKind; theme: CreatorThemeConfig } | null {
  if (!value) return null;
  if (isLook(value)) return LOOKS[value];
  return Object.hasOwn(PEOPLE_LOOKS, value) ? (PEOPLE_LOOKS[value] ?? null) : null;
}
