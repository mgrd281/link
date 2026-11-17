import {
  tokens,
  creatorTokens,
  type CreatorButtonShape,
  type CreatorButtonStyle,
  type CreatorPairingId,
  type CreatorPresetId,
} from "../generated/tokens";
import { generatePalette, type CreatorPalette, type ThemeMode } from "./palette";

export type BackgroundKind = "solid" | "gradient" | "image" | "video";

/** What a creator stores (profiles.theme jsonb). Everything is optional; presets fill the gaps. */
export interface CreatorThemeConfig {
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

export interface ResolvedCreatorTheme {
  preset: CreatorPresetId;
  palette: CreatorPalette;
  pairing: (typeof creatorTokens.pairings)[CreatorPairingId];
  buttonStyle: CreatorButtonStyle;
  buttonShape: CreatorButtonShape;
  background: BackgroundKind;
  /** CSS custom properties to put on the creator page root (`style` attribute). */
  cssVars: Record<`--creator-${string}`, string>;
}

export const PRESET_IDS = Object.keys(creatorTokens.presets) as CreatorPresetId[];
export const PAIRING_IDS = Object.keys(creatorTokens.pairings) as CreatorPairingId[];
export const BUTTON_STYLES = creatorTokens.buttonStyles;
export const BUTTON_SHAPES = Object.keys(creatorTokens.buttonShapes) as CreatorButtonShape[];
export const DEFAULT_PRESET: CreatorPresetId = "paper";

const isPreset = (id: string | undefined): id is CreatorPresetId => !!id && id in creatorTokens.presets;

export function resolveCreatorTheme(config: CreatorThemeConfig = {}, options: { rtlScript?: boolean } = {}): ResolvedCreatorTheme {
  const presetId = isPreset(config.preset) ? config.preset : DEFAULT_PRESET;
  const preset = creatorTokens.presets[presetId];

  const palette = generatePalette({
    accent: config.accent ?? preset.accent,
    neutral: config.neutral ?? (config.accent ? undefined : preset.neutral),
    tint: config.tint ?? preset.tint,
    mode: config.mode ?? (preset.mode),
  });

  // Arabic content always uses the Arabic pairing (full RTL glyph support).
  const pairingId: CreatorPairingId = options.rtlScript ? "arabic" : (config.pairing ?? (preset.pairing));
  const pairing = creatorTokens.pairings[pairingId];
  const buttonStyle = config.buttonStyle ?? (preset.buttonStyle);
  const buttonShape = config.buttonShape ?? (preset.buttonShape);
  const background = config.background ?? (preset.background);

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
  };

  return { preset: presetId, palette, pairing, buttonStyle, buttonShape, background, cssVars };
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
