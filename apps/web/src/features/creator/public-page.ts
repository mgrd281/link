import { blockSchema, isBlockActive, profileSchema, type Block, type Page } from "@linkyo/blocks";
import { BUTTON_SHAPES, BUTTON_STYLES, isTemplate, PAIRING_IDS, PRESET_IDS, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { cache } from "react";

import type { Legal } from "@/features/account/types";
import { supabaseEnabled } from "@/lib/supabase/config";
import { anonServerSupabase } from "@/lib/supabase/server";

/**
 * A creator's public page, read the way a visitor may see it: `public_page()` (active, confirmed and
 * onboarded accounts only; hidden and out-of-schedule blocks already left out in SQL), parsed block by
 * block, then filtered again here. Server only: it never runs in a visitor's browser and sets no cookie.
 */

export interface PublicPage {
  page: Page;
  theme: CreatorThemeConfig;
  legal: Legal;
  updatedAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * What visitors see right now: switched-on blocks inside their schedule, without newsletter sign-ups
 * (real accounts have no newsletter backend yet, so the form would promise something it cannot keep).
 */
export function filterPublic(page: Page, now: Date = new Date()): Page {
  return { ...page, blocks: page.blocks.filter((block) => block.type !== "newsletter" && isBlockActive(block, now)) };
}

/** Each block on its own: one that does not parse is left out, the rest of the page still shows. */
export function parseBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const parsed = blockSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** The page, or null when its profile cannot be shown (no address or name). */
export function parsePage(raw: unknown): Page | null {
  if (!isRecord(raw) || !isRecord(raw.profile)) return null;
  const profile = profileSchema.safeParse(raw.profile);
  if (!profile.success) return null;
  return { profile: profile.data, blocks: parseBlocks(raw.blocks) };
}

const HEX = /^#[0-9a-f]{6}$/i;
const MODES = new Set(["light", "dark", "vivid"]);
const BACKGROUNDS = new Set(["solid", "gradient", "image", "video"]);
const known = <T extends string>(list: readonly T[], value: unknown): T | undefined =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : undefined;

/** Only the look choices the theme engine knows; anything else falls back to the template or preset. */
export function parseTheme(raw: unknown): CreatorThemeConfig {
  if (!isRecord(raw)) return {};
  const theme: CreatorThemeConfig = {};
  if (typeof raw.template === "string" && isTemplate(raw.template)) theme.template = raw.template;
  const preset = known(PRESET_IDS, raw.preset);
  if (preset) theme.preset = preset;
  if (typeof raw.accent === "string" && HEX.test(raw.accent)) theme.accent = raw.accent;
  if (typeof raw.neutral === "string" && HEX.test(raw.neutral)) theme.neutral = raw.neutral;
  if (typeof raw.tint === "number" && Number.isFinite(raw.tint) && raw.tint >= 0 && raw.tint <= 1) theme.tint = raw.tint;
  if (typeof raw.mode === "string" && MODES.has(raw.mode)) theme.mode = raw.mode as CreatorThemeConfig["mode"];
  const pairing = known(PAIRING_IDS, raw.pairing);
  if (pairing) theme.pairing = pairing;
  const buttonStyle = known(BUTTON_STYLES, raw.buttonStyle);
  if (buttonStyle) theme.buttonStyle = buttonStyle;
  const buttonShape = known(BUTTON_SHAPES, raw.buttonShape);
  if (buttonShape) theme.buttonShape = buttonShape;
  if (typeof raw.background === "string" && BACKGROUNDS.has(raw.background)) theme.background = raw.background as CreatorThemeConfig["background"];
  return theme;
}

export function parseLegal(raw: unknown): Legal {
  const legal = isRecord(raw) ? raw : {};
  return { name: text(legal.name), address: text(legal.address), email: text(legal.email), phone: text(legal.phone) };
}

/** The answer of `public_page()` as a page visitors may see, or null. */
export function toPublicPage(raw: unknown, now: Date = new Date()): PublicPage | null {
  if (!isRecord(raw)) return null;
  const page = parsePage(raw.page);
  if (!page) return null;
  return { page: filterPublic(page, now), theme: parseTheme(raw.theme), legal: parseLegal(raw.legal), updatedAt: text(raw.updatedAt) };
}

/**
 * One read per request (the layout, the page, its metadata and viewport share it). A demo build has no
 * database: every name is unknown, so `/u/<anything>` is the 404 page rather than an error.
 */
export const loadPublicPage = cache(async (username: string): Promise<PublicPage | null> => {
  if (!supabaseEnabled) return null;
  const { data, error } = await anonServerSupabase().rpc("public_page", { handle: username });
  if (error) throw new Error(`public_page failed: ${error.message}`);
  return toPublicPage(data);
});
