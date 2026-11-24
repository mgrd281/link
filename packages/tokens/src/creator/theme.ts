import {
  tokens,
  creatorTokens,
  type CreatorButtonShape,
  type CreatorButtonStyle,
  type CreatorPairingId,
  type CreatorPresetId,
  type CreatorTemplateId,
} from "../generated/tokens";
import { generatePalette, type CreatorPalette, type ThemeMode } from "./palette";

export type BackgroundKind = "solid" | "gradient" | "image" | "video";

/** What a creator stores (profiles.theme jsonb). Everything is optional; presets fill the gaps. */
export interface CreatorThemeConfig {
  /** Poster template: a named look + layout. Sits between the preset and explicit choices. */
  template?: CreatorTemplateId | undefined;
  preset?: CreatorPresetId | undefined;
  accent?: string | undefined;
  neutral?: string | undefined;
  tint?: number | undefined;
  mode?: ThemeMode | undefined;
  pairing?: CreatorPairingId | undefined;
  buttonStyle?: CreatorButtonStyle | undefined;
  buttonShape?: CreatorButtonShape | undefined;
  background?: BackgroundKind | undefined;
  /** How a run of projects is laid out. The owner's choice; absent means the template decides. */
  projects?: ProjectsStyle | undefined;
}

/**
 * Section titles: the display face, the body face in title case, the body face set in caps, small
 * caps with the section's number ("01"), a title followed by a hairline rule, monospace caps, a small
 * numbered caption in the margin (marker), the display face set very large with its number (headline),
 * or a square signpost with the section's letter beside the title, the signposts also forming the
 * page's section index (signpost).
 */
export type HeadingStyle = "display" | "sans" | "sans-upper" | "numbered" | "rule" | "mono" | "marker" | "headline" | "signpost";
/**
 * Hero treatment: the portrait, a logo over a blurred photo, the portrait toned into the page color,
 * the portrait in black and white, a full-height cinema still with the name set low (cinema), a round
 * portrait with a halo (halo), a framed picture with the name on the left (inset), a square picture in
 * corner marks (frame), the portrait in an arch (arch), the first piece of work as a large plate under a
 * quiet name (plate), the name set as large as the screen allows (statement), or the picture from edge
 * to edge with the name set large on it, beside the words as a tall plate on the wide canvas (bleed).
 */
export type HeroStyle = "portrait" | "logo" | "duotone" | "mono" | "cinema" | "halo" | "inset" | "frame" | "arch" | "plate" | "statement" | "bleed";
/** Social profiles under the name: round tiles, or bare glyphs for quiet, editorial looks. */
export type SocialStyle = "tiles" | "plain";
/** Behind the page: nothing, the page's colors drifting slowly (aurora), or a fine grid. */
export type BackdropStyle = "none" | "aurora" | "grid";
/** Photo galleries: a sideways rail, or a two-column grid for portfolios. */
export type GalleryStyle = "rail" | "grid";
/** Sections stay put (calm) or rise in as they scroll into view (reveal); never with reduced motion. */
export type MotionStyle = "calm" | "reveal";
/**
 * A run of projects: a grid with one large tile (bento), a numbered list, a sideways row (rail), or
 * chosen from the content (auto). The first layout key an owner may set (`CreatorThemeConfig.projects`).
 */
export type ProjectsStyle = "auto" | "bento" | "list" | "rail";
export const PROJECTS_STYLES = ["auto", "bento", "list", "rail"] as const satisfies readonly ProjectsStyle[];
export const isProjectsStyle = (value: unknown): value is ProjectsStyle => typeof value === "string" && (PROJECTS_STYLES as readonly string[]).includes(value);
/** The page column: the narrow creator column, or the wide canvas from desktop widths (layout.work). */
export type CanvasStyle = "column" | "wide";

export interface CreatorLayout {
  headings: HeadingStyle;
  hero: HeroStyle;
  socials: SocialStyle;
  backdrop: BackdropStyle;
  gallery: GalleryStyle;
  motion: MotionStyle;
  projects: ProjectsStyle;
  canvas: CanvasStyle;
}

export interface ResolvedCreatorTheme {
  preset: CreatorPresetId;
  template: CreatorTemplateId | null;
  layout: CreatorLayout;
  palette: CreatorPalette;
  pairing: (typeof creatorTokens.pairings)[CreatorPairingId];
  buttonStyle: CreatorButtonStyle;
  buttonShape: CreatorButtonShape;
  background: BackgroundKind;
  /** CSS custom properties to put on the creator page root (`style` attribute). */
  cssVars: Record<`--creator-${string}`, string>;
}

export const PRESET_IDS = Object.keys(creatorTokens.presets) as CreatorPresetId[];
export const TEMPLATE_IDS = Object.keys(creatorTokens.templates) as CreatorTemplateId[];
export const DEFAULT_LAYOUT: CreatorLayout = {
  headings: "display",
  hero: "portrait",
  socials: "tiles",
  backdrop: "none",
  gallery: "rail",
  motion: "calm",
  projects: "auto",
  canvas: "column",
};
export const PAIRING_IDS = Object.keys(creatorTokens.pairings) as CreatorPairingId[];
export const BUTTON_STYLES = creatorTokens.buttonStyles;
export const BUTTON_SHAPES = Object.keys(creatorTokens.buttonShapes) as CreatorButtonShape[];
export const DEFAULT_PRESET: CreatorPresetId = "paper";

const isPreset = (id: string | undefined): id is CreatorPresetId => !!id && id in creatorTokens.presets;
export const isTemplate = (id: string | undefined): id is CreatorTemplateId => !!id && id in creatorTokens.templates;

/** What a template is made for (tokens: `use`). A template can serve both. */
export type TemplateUse = "portfolio" | "link-in-bio";

/** A template's uses, from its tokens. */
export const templateUses = (id: CreatorTemplateId): readonly TemplateUse[] => (creatorTokens.templates[id] as { use?: readonly TemplateUse[] }).use ?? ["link-in-bio"];

/** The templates made for a use, in token order (pickers' filters, the portfolio row). */
export const templatesFor = (use: TemplateUse): CreatorTemplateId[] => TEMPLATE_IDS.filter((id) => templateUses(id).includes(use));

/**
 * The templates suggested for a page kind (tokens: `suggestFor`), in token order. Data-driven, so a new
 * template that names a kind appears in that kind's suggestions without code. The kind is a plain string
 * here because the kinds live in @linkyo/blocks, which this package does not depend on.
 */
export const suggestedTemplates = (kind: string): CreatorTemplateId[] =>
  TEMPLATE_IDS.filter((id) => ((creatorTokens.templates[id] as { suggestFor?: readonly string[] }).suggestFor ?? []).includes(kind));

/**
 * `ids` in the given order first (unknown and repeated ids dropped), then every other template in token
 * order. For pickers that lead with a kind's default and suggestions without hiding any look.
 */
export const orderTemplates = (first: readonly string[]): CreatorTemplateId[] => {
  const lead = [...new Set(first)].filter(isTemplate);
  return [...lead, ...TEMPLATE_IDS.filter((id) => !lead.includes(id))];
};

interface TemplateDefaults {
  accent?: string | undefined;
  neutral?: string | undefined;
  tint?: number | undefined;
  mode?: ThemeMode | undefined;
  pairing?: CreatorPairingId | undefined;
  buttonStyle?: CreatorButtonStyle | undefined;
  buttonShape?: CreatorButtonShape | undefined;
  headings?: HeadingStyle | undefined;
  hero?: HeroStyle | undefined;
  socials?: SocialStyle | undefined;
  backdrop?: BackdropStyle | undefined;
  gallery?: GalleryStyle | undefined;
  motion?: MotionStyle | undefined;
  projects?: ProjectsStyle | undefined;
  canvas?: CanvasStyle | undefined;
  /** Weight of the display face on Arabic pages (the Arabic pairing has one family). Default 700. */
  arabicDisplayWeight?: 400 | 700 | undefined;
}

/** What a preset or template contributes before the creator's own choices. */
interface ThemeBase {
  accent: string;
  neutral?: string | undefined;
  tint: number;
  mode: ThemeMode;
  pairing: CreatorPairingId;
  buttonStyle: CreatorButtonStyle;
  buttonShape: CreatorButtonShape;
  background: BackgroundKind;
}

export function resolveCreatorTheme(config: CreatorThemeConfig = {}, options: { rtlScript?: boolean } = {}): ResolvedCreatorTheme {
  const presetId = isPreset(config.preset) ? config.preset : DEFAULT_PRESET;
  const templateId = isTemplate(config.template) ? config.template : null;
  // Explicit choices > template > preset: a template is a starting look, never a lock.
  const t: TemplateDefaults = templateId ? (creatorTokens.templates[templateId]) : {};
  const presetBase: ThemeBase = creatorTokens.presets[presetId];
  const preset: ThemeBase =
    templateId && !config.preset
      ? {
          ...presetBase,
          accent: t.accent ?? presetBase.accent,
          neutral: t.neutral,
          tint: t.tint ?? presetBase.tint,
          mode: t.mode ?? presetBase.mode,
          pairing: t.pairing ?? presetBase.pairing,
          buttonStyle: t.buttonStyle ?? presetBase.buttonStyle,
          buttonShape: t.buttonShape ?? presetBase.buttonShape,
          background: "solid",
        }
      : presetBase;

  const palette = generatePalette({
    accent: config.accent ?? preset.accent,
    neutral: config.neutral ?? (config.accent ? undefined : preset.neutral),
    tint: config.tint ?? preset.tint,
    mode: config.mode ?? preset.mode,
  });

  // Arabic content always uses the Arabic pairing (full RTL glyph support).
  const pairingId: CreatorPairingId = options.rtlScript ? "arabic" : (config.pairing ?? preset.pairing);
  const pairing = creatorTokens.pairings[pairingId];
  const buttonStyle: CreatorButtonStyle = config.buttonStyle ?? preset.buttonStyle;
  const buttonShape: CreatorButtonShape = config.buttonShape ?? preset.buttonShape;
  const layout: CreatorLayout = {
    headings: t.headings ?? DEFAULT_LAYOUT.headings,
    hero: t.hero ?? DEFAULT_LAYOUT.hero,
    socials: t.socials ?? DEFAULT_LAYOUT.socials,
    backdrop: t.backdrop ?? DEFAULT_LAYOUT.backdrop,
    gallery: t.gallery ?? DEFAULT_LAYOUT.gallery,
    motion: t.motion ?? DEFAULT_LAYOUT.motion,
    // The one layout key an owner may set; an unknown stored value falls back to the template.
    projects: (isProjectsStyle(config.projects) ? config.projects : undefined) ?? t.projects ?? DEFAULT_LAYOUT.projects,
    canvas: t.canvas ?? DEFAULT_LAYOUT.canvas,
  };
  const background = config.background ?? preset.background;

  const display = pairing.display as {
    stack: string;
    weight: number;
    tracking: string;
    uppercase?: boolean;
  };
  // Arabic pages share one pairing, so a template says how heavy its name is there: the calm and
  // the bold look stay different in Arabic too.
  const displayWeight = options.rtlScript ? (t.arabicDisplayWeight ?? display.weight) : display.weight;

  const cssVars: ResolvedCreatorTheme["cssVars"] = {
    "--creator-bg": palette.bg,
    "--creator-surface": palette.surface,
    "--creator-surface-2": palette.surface2,
    "--creator-fg": palette.fg,
    "--creator-fg-muted": palette.fgMuted,
    "--creator-accent": palette.accent,
    "--creator-accent-fg": palette.accentFg,
    "--creator-accent-text": palette.accentText,
    "--creator-line": palette.line,
    "--creator-line-strong": palette.lineStrong,
    "--creator-glass": `color-mix(in oklab, ${palette.surface} ${Math.round(tokens.opacity.glass * 100)}%, transparent)`,
    "--creator-gradient": `linear-gradient(160deg, ${palette.gradient[0]} 0%, ${palette.gradient[1]} 55%, ${palette.gradient[2]} 100%)`,
    // The gradient's two hue-shifted neighbours of the page color (safe under text): the aurora's colors.
    "--creator-glow-1": palette.gradient[1],
    "--creator-glow-2": palette.gradient[2],
    "--creator-font-display": display.stack,
    "--creator-font-body": pairing.body.stack,
    "--creator-display-weight": String(displayWeight),
    "--creator-display-tracking": display.tracking,
    "--creator-display-transform": display.uppercase ? "uppercase" : "none",
    "--creator-radius-button": `${creatorTokens.buttonShapes[buttonShape]}px`,
    "--creator-radius-card": `${creatorTokens.cardShapes[buttonShape]}px`,
  };

  return { preset: presetId, template: templateId, layout, palette, pairing, buttonStyle, buttonShape, background, cssVars };
}

/** "Shuffle": a safe random theme (any preset, any pairing/style/shape combination is valid). */
export function shuffleCreatorTheme(random: () => number = Math.random): CreatorThemeConfig {
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T;
  return {
    preset: pick(PRESET_IDS),
    pairing: pick(PAIRING_IDS.filter((id) => id !== "arabic")),
    buttonStyle: pick(BUTTON_STYLES),
    buttonShape: pick(BUTTON_SHAPES),
  };
}
