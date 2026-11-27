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
 * to edge with the name set large on it, beside the words as a tall plate on the wide canvas (bleed),
 * the first covers in one justified row at their own ratios, a snap strip on phones (strip), an
 * architect's title block beside the lead cover (titleblock), or a README: the name, a role line and a
 * monospace list of facts (readme).
 */
export type HeroStyle =
  | "portrait"
  | "logo"
  | "duotone"
  | "mono"
  | "cinema"
  | "halo"
  | "inset"
  | "frame"
  | "arch"
  | "plate"
  | "statement"
  | "bleed"
  | "strip"
  | "titleblock"
  | "readme";
/** Social profiles under the name: round tiles, or bare glyphs for quiet, editorial looks. */
export type SocialStyle = "tiles" | "plain";
/**
 * Behind the page: nothing, the page's colors drifting slowly (aurora), a fine grid, or hairline
 * column guides behind the wide canvas (columns; never on phones or with more contrast asked for).
 */
export type BackdropStyle = "none" | "aurora" | "grid" | "columns";
/**
 * Photo galleries: a sideways rail, a two-column grid for portfolios, or rows of equal height with
 * every picture uncropped (justified).
 */
export type GalleryStyle = "rail" | "grid" | "justified";
/** Sections stay put (calm) or rise in as they scroll into view (reveal); never with reduced motion. */
export type MotionStyle = "calm" | "reveal";
/**
 * A run of projects: a grid with one large tile (bento), a numbered list, a sideways row (rail), or
 * chosen from the content (auto). The first layout key an owner may set (`CreatorThemeConfig.projects`).
 */
export type ProjectsStyle = "auto" | "bento" | "list" | "rail";
/**
 * A run of projects as a template may lay it out: every owner choice, plus three that only a template
 * sets: uncropped rows of equal height (justified), one drawing sheet per project with its facts
 * (sheets), and a build log grouped by year (log).
 */
export type TemplateProjectsStyle = ProjectsStyle | "justified" | "sheets" | "log";
/** The work layouts an owner may choose (Arbeiten, the import); otherwise the template's own value. */
export const PROJECTS_STYLES = ["auto", "bento", "list", "rail"] as const satisfies readonly ProjectsStyle[];
export const isProjectsStyle = (value: unknown): value is ProjectsStyle => typeof value === "string" && (PROJECTS_STYLES as readonly string[]).includes(value);
/**
 * The page column: the narrow creator column, the wide canvas from desktop widths (layout.work), or
 * the full canvas whose pictures run to layout.wall while text keeps the creator column (full).
 */
export type CanvasStyle = "column" | "wide" | "full";

export interface CreatorLayout {
  headings: HeadingStyle;
  hero: HeroStyle;
  socials: SocialStyle;
  backdrop: BackdropStyle;
  gallery: GalleryStyle;
  motion: MotionStyle;
  projects: TemplateProjectsStyle;
  canvas: CanvasStyle;
}

/**
 * Layout values the tokens may already name but no renderer draws yet, each with the existing value it
 * is drawn as until then, so a template can be added before its renderer and still compile and render.
 * A value joins this table with the tokens that name it and leaves it in the change that draws it;
 * `resolveCreatorTheme` applies what is left. Empty: every value is drawn (Stage 3 drew strip,
 * titleblock and readme, justified, sheets and log, the justified gallery, columns and the full canvas).
 */
export const LAYOUT_FALLBACK = {} as const satisfies { [K in keyof CreatorLayout]?: Partial<Record<CreatorLayout[K], CreatorLayout[K]>> };

type Fallbacks = typeof LAYOUT_FALLBACK;
/**
 * A layout as the renderers draw it: `CreatorLayout` without the values that still fall back. When a
 * value leaves `LAYOUT_FALLBACK`, this type takes it in and the compiler names every place that has to
 * draw it.
 */
export type DrawnLayout = { [K in keyof CreatorLayout]: K extends keyof Fallbacks ? Exclude<CreatorLayout[K], keyof Fallbacks[K]> : CreatorLayout[K] };

/** A layout with every value that has no renderer yet replaced by its fallback (`LAYOUT_FALLBACK`). */
export function drawnLayout(layout: CreatorLayout): DrawnLayout {
  const drawn = <K extends keyof CreatorLayout>(key: K): DrawnLayout[K] => {
    const table = (LAYOUT_FALLBACK as { [Key in keyof CreatorLayout]?: Partial<Record<string, DrawnLayout[Key]>> })[key];
    // While the table is empty a value is drawn as itself; a value added to the table later needs the
    // value cast to `DrawnLayout[K]` here again (the compiler says so).
    return table?.[layout[key]] ?? layout[key];
  };
  return {
    headings: drawn("headings"),
    hero: drawn("hero"),
    socials: drawn("socials"),
    backdrop: drawn("backdrop"),
    gallery: drawn("gallery"),
    motion: drawn("motion"),
    projects: drawn("projects"),
    canvas: drawn("canvas"),
  };
}

export interface ResolvedCreatorTheme {
  preset: CreatorPresetId;
  template: CreatorTemplateId | null;
  /** The template's layout as it is drawn today (values without a renderer yet fall back). */
  layout: DrawnLayout;
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

/** The kinds a template names under `key` in its tokens (`suggestFor`, `leadFor`). */
const kindsOf = (id: CreatorTemplateId, key: "suggestFor" | "leadFor"): readonly string[] =>
  (creatorTokens.templates[id] as { suggestFor?: readonly string[]; leadFor?: readonly string[] })[key] ?? [];

/**
 * The templates suggested for a page kind (tokens: `suggestFor`): those that also name the kind in
 * `leadFor` first (a new look offered right after the kind's own starter, e.g. Leuchttisch to
 * photographers), then the others, each group in token order. Data-driven, so a new template that names
 * a kind appears in that kind's suggestions without code. The kind is a plain string here because the
 * kinds live in @linkyo/blocks, which this package does not depend on.
 */
export const suggestedTemplates = (kind: string): CreatorTemplateId[] => {
  const suggested = TEMPLATE_IDS.filter((id) => kindsOf(id, "suggestFor").includes(kind));
  const lead = suggested.filter((id) => kindsOf(id, "leadFor").includes(kind));
  return [...lead, ...suggested.filter((id) => !lead.includes(id))];
};

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
  projects?: TemplateProjectsStyle | undefined;
  canvas?: CanvasStyle | undefined;
  /** Weight of the display face on Arabic pages; wins over the Arabic companion's own weight. */
  arabicDisplayWeight?: 400 | 700 | undefined;
  /** This template's own Arabic faces (tokens: `arabic`), over its pairing's companions. */
  arabic?: ArabicFaces | undefined;
}

/** A face of an Arabic companion as the token build emits it. */
interface ArabicFace {
  family: readonly string[];
  /** The companion's own self-hosted face. */
  face: string;
  /**
   * Every self-hosted face in `family`, when the companion has a fuller Arabic face after it for the
   * letters it lacks (Readex Pro has no پ چ گ ک ی; IBM Plex Sans Arabic draws them).
   */
  faces?: Readonly<Record<string, string>> | undefined;
  weight: number;
  stack: string;
}

/**
 * The faces a pairing (or one template) uses for Arabic letters on Arabic pages (tokens: `arabic`).
 * `pairing: "arabic"` keeps the Arabic pairing exactly as it is, with no Latin faces. No template uses it
 * now: Laufbahn did until round 6, and its Latin runs ("SAP", "2017", an e-mail) fell to a system face.
 */
export interface ArabicFaces {
  pairing?: "arabic" | undefined;
  display?: ArabicFace | undefined;
  body?: ArabicFace | undefined;
}

/** The Arabic companions of a pairing (C-03); the Arabic pairing is its own companion. */
export const arabicFacesOf = (id: CreatorPairingId): ArabicFaces =>
  (creatorTokens.pairings[id] as { arabic?: ArabicFaces }).arabic ?? { pairing: "arabic" };

/**
 * The font stacks of a page in Arabic script: the Arabic companion first, then the template's own
 * Latin stack. Each companion face is declared with a `unicode-range` of Arabic letters and word spaces
 * (apps/web/src/fonts.ts), so Latin letters and digits skip it and keep the template's Latin face;
 * Arabic letters and the gaps between Arabic words get the companion instead of whatever a Latin face
 * (a monospace space) or its metric fallback (local Arial, which has Arabic glyphs on Windows) would
 * draw. `null` when the page uses the Arabic pairing as it is.
 */
export function arabicStacks(latinPairing: CreatorPairingId, override?: ArabicFaces): { display: string; body: string; weight: number; uppercase: boolean } | null {
  const own = arabicFacesOf(latinPairing);
  if (latinPairing === "arabic" || override?.pairing === "arabic" || own.pairing === "arabic") return null;
  const latin = creatorTokens.pairings[latinPairing];
  const display = override?.display ?? own.display;
  const body = override?.body ?? own.body;
  if (!display || !body) return null;
  return {
    display: `${display.stack}, ${latin.display.stack}`,
    body: `${body.stack}, ${latin.body.stack}`,
    weight: display.weight,
    uppercase: Boolean((latin.display as { uppercase?: boolean }).uppercase),
  };
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

  // The pairing the page chose (or its template's). Arabic content reports the Arabic pairing (its
  // metrics drive name fitting, link cards and share pictures) but is set in the chosen pairing's
  // Arabic companions with the Latin faces after them, so each template keeps its character (C-03).
  const latinPairingId: CreatorPairingId = config.pairing ?? preset.pairing;
  const pairingId: CreatorPairingId = options.rtlScript ? "arabic" : latinPairingId;
  const pairing = creatorTokens.pairings[pairingId];
  // A template's own Arabic faces belong to its own pairing: a creator who picks another pairing gets
  // that pairing's companions. A template's "the Arabic pairing as it is" would hold whatever the pairing.
  const ownArabic = t.arabic?.pairing === "arabic" || latinPairingId === t.pairing ? t.arabic : undefined;
  const arabic = options.rtlScript ? arabicStacks(latinPairingId, ownArabic) : null;
  const buttonStyle: CreatorButtonStyle = config.buttonStyle ?? preset.buttonStyle;
  const buttonShape: CreatorButtonShape = config.buttonShape ?? preset.buttonShape;
  // Values without a renderer yet are drawn as their fallback (LAYOUT_FALLBACK).
  const layout = drawnLayout({
    headings: t.headings ?? DEFAULT_LAYOUT.headings,
    hero: t.hero ?? DEFAULT_LAYOUT.hero,
    socials: t.socials ?? DEFAULT_LAYOUT.socials,
    backdrop: t.backdrop ?? DEFAULT_LAYOUT.backdrop,
    gallery: t.gallery ?? DEFAULT_LAYOUT.gallery,
    motion: t.motion ?? DEFAULT_LAYOUT.motion,
    // The one layout key an owner may set; an unknown stored value falls back to the template.
    projects: (isProjectsStyle(config.projects) ? config.projects : undefined) ?? t.projects ?? DEFAULT_LAYOUT.projects,
    canvas: t.canvas ?? DEFAULT_LAYOUT.canvas,
  });
  const background = config.background ?? preset.background;

  const display = pairing.display as {
    stack: string;
    weight: number;
    tracking: string;
    uppercase?: boolean;
  };
  // On Arabic pages the companion brings its weight, unless the template sets one (Werkbogen's light
  // serif, Laufbahn's bold sans). Letter spacing stays at the Arabic pairing's 0: spacing would pull
  // joined Arabic letters apart. Latin names keep their pairing's capitals; Arabic has no case.
  const displayWeight = options.rtlScript ? (t.arabicDisplayWeight ?? arabic?.weight ?? display.weight) : display.weight;
  const uppercase = arabic ? arabic.uppercase : Boolean(display.uppercase);

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
    "--creator-font-display": arabic?.display ?? display.stack,
    "--creator-font-body": arabic?.body ?? pairing.body.stack,
    "--creator-display-weight": String(displayWeight),
    "--creator-display-tracking": display.tracking,
    "--creator-display-transform": uppercase ? "uppercase" : "none",
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
