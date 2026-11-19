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
}

/** Section titles: the display face, the body face in title case, or the body face set in caps. */
export type HeadingStyle = "display" | "sans" | "sans-upper";
/**
 * Hero treatment: the portrait, a logo over a blurred photo, the portrait toned into the page color,
 * or the portrait in black and white.
 */
export type HeroStyle = "portrait" | "logo" | "duotone" | "mono";
/** Social profiles under the name: round tiles, or bare glyphs for quiet, editorial looks. */
export type SocialStyle = "tiles" | "plain";

export interface CreatorLayout {
  headings: HeadingStyle;
  hero: HeroStyle;
  socials: SocialStyle;
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
export const DEFAULT_LAYOUT: CreatorLayout = { headings: "display", hero: "portrait", socials: "tiles" };
export const PAIRING_IDS = Object.keys(creatorTokens.pairings) as CreatorPairingId[];
export const BUTTON_STYLES = creatorTokens.buttonStyles;
export const BUTTON_SHAPES = Object.keys(creatorTokens.buttonShapes) as CreatorButtonShape[];
export const DEFAULT_PRESET: CreatorPresetId = "paper";

const isPreset = (id: string | undefined): id is CreatorPresetId => !!id && id in creatorTokens.presets;
export const isTemplate = (id: string | undefined): id is CreatorTemplateId => !!id && id in creatorTokens.templates;

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
  };
  const background = config.background ?? preset.background;

  const display = pairing.display as {
    stack: string;
    weight: number;
    tracking: string;
    uppercase?: boolean;
  };

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
    "--creator-font-display": display.stack,
    "--creator-font-body": pairing.body.stack,
    "--creator-display-weight": String(display.weight),
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
