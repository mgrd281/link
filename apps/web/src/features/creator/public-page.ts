import { blockSchema, isBlockActive, NO_IMAGE, profileSchema, type Block, type Page } from "@linkyo/blocks";
import { BUTTON_SHAPES, BUTTON_STYLES, isTemplate, PAIRING_IDS, PRESET_IDS, PROJECTS_STYLES, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { cache } from "react";

import type { Legal } from "@/features/account/types";
import { isProxiedImage } from "@/features/directions/shared/remote-images";
import { supabaseEnabled } from "@/lib/supabase/config";
import { anonServerSupabase } from "@/lib/supabase/server";

import { pausedPage } from "./visibility";

// The visibility helpers are pure (the dashboard's previews use them too); the routes read them here.
export { cardPage, indexable, pausedPage, searchTexts } from "./visibility";

/**
 * A creator's public page, read the way a visitor may see it: `public_page()` (active, confirmed and
 * onboarded accounts only; hidden and out-of-schedule blocks already left out in SQL), parsed block by
 * block, then filtered again here, and with nothing left that a visitor's browser would fetch from
 * another host. Server only: it never runs in a visitor's browser and sets no cookie.
 */

export interface PublicPage {
  page: Page;
  theme: CreatorThemeConfig;
  legal: Legal;
  updatedAt: string;
  /**
   * The owner paused the page (Settings › Sichtbarkeit): `page` then holds only the name and photo and
   * no block, so every route that reads it (the page, its project pages, the documents, the link
   * preview) shows nothing of the content. The page itself shows the calm offline page. Absent (a page
   * built elsewhere, as in tests) means not paused.
   */
  paused?: boolean | undefined;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** A project marked confidential never carries its client's name to a visitor. */
function withoutConfidentialClient(block: Block): Block {
  if (block.type !== "project" || block.confidential !== true || block.client === undefined) return block;
  const { client: _client, ...rest } = block;
  return rest;
}

/**
 * What visitors see right now: switched-on blocks inside their schedule, without newsletter sign-ups
 * (real accounts have no newsletter backend yet, so the form would promise something it cannot keep).
 * A confidential project loses its `client`: the schema already refuses such a block and the editor
 * clears the field, so this only matters for a page that reached this function unparsed.
 */
export function filterPublic(page: Page, now: Date = new Date()): Page {
  return { ...page, blocks: page.blocks.filter((block) => block.type !== "newsletter" && isBlockActive(block, now)).map(withoutConfidentialClient) };
}

/**
 * A picture a visitor's browser may load: none, a bundled sample, one kept inside the page (a data
 * URL), or one our image optimizer re-serves (this deployment's Storage and the listed platform
 * hosts, https only). An allowlist: every other address, whatever its scheme, is somebody else's.
 */
export function isOwnPicture(src: string): boolean {
  return src === NO_IMAGE || src.startsWith("sample:") || src.startsWith("data:image/") || isProxiedImage(src);
}

/** One of our sample clips ("sample:motion-<key>", served from /media/motion): the only clips we host. */
const OWN_MOTION = /^sample:motion-[a-z0-9-]+$/;

/** Every `{ src }` picture below `value` that is not ours loses its address (the page shows its calm placeholder). */
function ownPicturesOnly<T>(value: T): T {
  if (Array.isArray(value)) return value.map(ownPicturesOnly) as T;
  if (!isRecord(value)) return value;
  const entries = Object.entries(value).map(([key, inner]) => [key, key === "src" && typeof inner === "string" && !isOwnPicture(inner) ? NO_IMAGE : ownPicturesOnly(inner)]);
  return Object.fromEntries(entries) as T;
}

/**
 * Creator pages load nothing from third parties (GDPR): the page's content is the creator's own
 * JSON, saved from their browser, so it can name any address. Pictures on a foreign host become "no
 * picture", and a hero clip that is not one of ours is left out (it would start by itself and tell
 * its host about every visitor). Players stay: they load only after the visitor's tap.
 */
export function withoutThirdParties(page: Page): Page {
  const { motion, ...profile } = page.profile;
  const ownMotion = motion && OWN_MOTION.test(motion.src) ? { motion } : {};
  return { profile: ownPicturesOnly({ ...profile, ...ownMotion }), blocks: ownPicturesOnly(page.blocks) };
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
  // The one layout choice an owner makes: how a run of projects is shown.
  const projects = known(PROJECTS_STYLES, raw.projects);
  if (projects) theme.projects = projects;
  return theme;
}

export function parseLegal(raw: unknown): Legal {
  const legal = isRecord(raw) ? raw : {};
  return { name: text(legal.name), address: text(legal.address), email: text(legal.email), phone: text(legal.phone) };
}

/** The answer of `public_page()` as a page visitors may see, or null. A paused page keeps only its name and photo (`pausedPage`). */
export function toPublicPage(raw: unknown, now: Date = new Date()): PublicPage | null {
  if (!isRecord(raw)) return null;
  const page = parsePage(raw.page);
  if (!page) return null;
  const paused = page.profile.visibility?.paused === true;
  const shown = paused ? pausedPage(page) : filterPublic(page, now);
  return { page: withoutThirdParties(shown), theme: parseTheme(raw.theme), legal: parseLegal(raw.legal), updatedAt: text(raw.updatedAt), paused };
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
