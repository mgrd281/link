import { contrastRatio, hexToOklch, oklchToHex, type Oklch } from "./color";

/**
 * Creator palette generator (brand §4.3).
 *
 * seed (accent) + optional neutral hue source → 8 required roles (+ 3 derived) for light or dark.
 * Every text/background pair is guaranteed to pass WCAG 2.x AA by construction:
 *   - fg, fgMuted, accentText on bg/surface/surface2 ≥ 4.5:1
 *   - accentFg on accent ≥ 4.5:1
 *   - accent vs bg and lineStrong vs bg ≥ 3:1 (non-text UI, large text, icons)
 * If a seed cannot satisfy a rule, lightness is adjusted (never hue): the creator never sees a
 * broken combination.
 */

/**
 * light / dark: neutral (optionally tinted) surfaces.
 * vivid: the page itself is the creator's color (a saturated background with white text), still AA.
 */
export type ThemeMode = "light" | "dark" | "vivid";

/** The color scheme browsers should use for a mode (form controls, scrollbars, status bar). */
export const colorSchemeOf = (mode: ThemeMode): "light" | "dark" => (mode === "light" ? "light" : "dark");

export interface PaletteInput {
  /** Seed color (hex). Chosen by the creator or extracted from a photo. */
  accent: string;
  /** Hue source for neutral surfaces. Defaults to the accent. */
  neutral?: string | undefined;
  /** 0 = neutral gray surfaces … 1 = strongly tinted. Default 0.35. */
  tint?: number | undefined;
  mode: ThemeMode;
}

export interface CreatorPalette {
  mode: ThemeMode;
  bg: string;
  surface: string;
  surface2: string;
  fg: string;
  fgMuted: string;
  accent: string;
  accentFg: string;
  /** Accent used as text/icons on bg & surfaces (≥ 4.5:1). */
  accentText: string;
  line: string;
  /** Boundaries that identify controls (≥ 3:1 vs bg). */
  lineStrong: string;
  /** Soft background gradient (3 stops), all safe for fg/fgMuted. */
  gradient: readonly [string, string, string];
}

export const AA_TEXT = 4.5;
export const AA_UI = 3;

/** Engine constants (designer-tunable). Lightness in OKLab L. */
/** Below this OKLCH chroma an accent reads as black/white/grey. */
const MONOCHROME_CHROMA = 0.02;
/** Where a monochrome accent lands when it has to flip: near-white on dark pages, near-black on light. */
const MONOCHROME_L = { light: 0.22, dark: 0.93 } as const;

const SURFACES = {
  light: { bg: 0.972, surface: 0.992, surface2: 0.935, line: 0.885, fg: 0.2, fgMuted: 0.47 },
  dark: { bg: 0.175, surface: 0.215, surface2: 0.26, line: 0.31, fg: 0.965, fgMuted: 0.76 },
} as const;
const MAX_NEUTRAL_CHROMA = 0.032;

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/**
 * Move `color`'s lightness in `direction` until `passes` (or the end of the range).
 * Hue and chroma are kept; chroma is reduced only by gamut mapping.
 */
function adjustLightness(
  color: Oklch,
  direction: "darker" | "lighter",
  passes: (hex: string) => boolean,
): string {
  const start = oklchToHex(color);
  if (passes(start)) return start;
  const end = direction === "darker" ? 0 : 1;
  // Binary search for the closest lightness to the original that passes.
  let near = color.l;
  let far = end;
  if (!passes(oklchToHex({ ...color, l: far }))) return oklchToHex({ ...color, l: far });
  for (let i = 0; i < 28; i++) {
    const mid = (near + far) / 2;
    if (passes(oklchToHex({ ...color, l: mid }))) far = mid;
    else near = mid;
  }
  return oklchToHex({ ...color, l: far });
}

const passesAll =
  (backgrounds: readonly string[], ratio: number) =>
  (hex: string): boolean =>
    backgrounds.every((bg) => contrastRatio(hex, bg) >= ratio);

export function generatePalette(input: PaletteInput): CreatorPalette {
  if (input.mode === "vivid") return generateVividPalette(input);
  const mode = input.mode;
  const tint = clamp(input.tint ?? 0.35, 0, 1);
  const accentSeed = hexToOklch(input.accent);
  const neutralSeed = input.neutral ? hexToOklch(input.neutral) : accentSeed;
  const L = SURFACES[mode];
  const away = mode === "light" ? "darker" : "lighter";

  // Neutral surfaces: hue from the neutral seed, chroma limited and scaled by tint.
  const h = neutralSeed.h;
  const nc = tint * Math.min(MAX_NEUTRAL_CHROMA, neutralSeed.c * 0.6 + (neutralSeed.c > 0.01 ? 0.004 : 0));
  const bg = oklchToHex({ l: L.bg, c: nc, h });
  const surface = oklchToHex({ l: L.surface, c: nc * (mode === "dark" ? 1 : 0.6), h });
  const surface2 = oklchToHex({ l: L.surface2, c: nc * 1.15, h });
  const textSurfaces = [bg, surface, surface2] as const;

  const fg = adjustLightness({ l: L.fg, c: Math.min(nc * 0.8, 0.02), h }, away, passesAll(textSurfaces, 7));
  const fgMuted = adjustLightness({ l: L.fgMuted, c: Math.min(nc * 1.2, 0.03), h }, away, passesAll(textSurfaces, AA_TEXT));
  const line = oklchToHex({ l: L.line, c: nc * 0.9, h });
  const lineStrong = adjustLightness({ l: L.line, c: nc * 0.9, h }, away, passesAll([bg, surface], AA_UI));

  // Accent: keep the seed when possible, otherwise move away from the background.
  // Monochrome seeds (black/white/grey) that sit too close to the background flip to the opposite
  // extreme instead of settling on a dull mid-grey: black buttons on a light page become white
  // buttons on a dark page.
  const monochrome = accentSeed.c < MONOCHROME_CHROMA && contrastRatio(oklchToHex(accentSeed), bg) < AA_UI;
  const seed = monochrome ? { ...accentSeed, l: mode === "dark" ? MONOCHROME_L.dark : MONOCHROME_L.light } : accentSeed;
  let accent = adjustLightness(seed, away, passesAll([bg], AA_UI));
  const white = "#FFFFFF";
  const nearBlack = oklchToHex({ l: 0.17, c: Math.min(nc, 0.02), h });
  const pickText = (fill: string): string =>
    contrastRatio(white, fill) >= contrastRatio(nearBlack, fill) ? white : nearBlack;
  let accentFg = pickText(accent);
  if (contrastRatio(accentFg, accent) < AA_TEXT) {
    // Moving away from the background always helps the label on the "far side":
    // white on a darker accent (light mode), near-black on a lighter accent (dark mode).
    accentFg = mode === "light" ? white : nearBlack;
    accent = adjustLightness(hexToOklch(accent), away, (hex) => contrastRatio(accentFg, hex) >= AA_TEXT);
  }
  const accentText = adjustLightness(hexToOklch(accent), away, passesAll(textSurfaces, AA_TEXT));

  // Soft gradient: hue-shifted neighbours of bg, verified against text colors.
  const gc = Math.min(nc + 0.018 * tint + 0.006, 0.045);
  const shift = mode === "light" ? -0.012 : 0.018;
  const textSafe = (hex: string): boolean =>
    contrastRatio(fg, hex) >= 7 && contrastRatio(fgMuted, hex) >= AA_TEXT && contrastRatio(accentText, hex) >= AA_TEXT;
  const stop = (dh: number): string => {
    const candidate = oklchToHex({ l: L.bg + shift, c: gc, h: (h + dh + 360) % 360 });
    return textSafe(candidate) ? candidate : bg;
  };
  const gradient = [bg, stop(28), stop(-32)] as const;

  return { mode, bg, surface, surface2, fg, fgMuted, accent, accentFg, accentText, line, lineStrong, gradient };
}

/** Vivid mode constants: surfaces step up in lightness from the background; fg must reach 7:1 on all of them. */
const VIVID = { surfaceStep: 0.04, surface2Step: 0.08, lineStep: 0.13, minChroma: 0.12, maxChroma: 0.2, fgMutedL: 0.9 } as const;

/**
 * The page is the creator's color. Finds the lightest background in the seed's hue where white text
 * still reaches 7:1 on every surface, then derives light buttons with a dark label in the same hue.
 */
function generateVividPalette(input: PaletteInput): CreatorPalette {
  const seed = hexToOklch(input.accent);
  const h = seed.h;
  const c = seed.c < MONOCHROME_CHROMA ? seed.c : clamp(seed.c, VIVID.minChroma, VIVID.maxChroma);
  const white = "#FFFFFF";
  const at = (l: number, chroma = c): string => oklchToHex({ l: clamp(l, 0, 1), c: chroma, h });
  const passes = (l: number): boolean => contrastRatio(white, at(l + VIVID.surface2Step, c * 0.95)) >= 7;
  let lo = 0.1;
  let hi = 0.8;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (passes(mid)) lo = mid;
    else hi = mid;
  }
  const L = lo;
  const bg = at(L);
  const surface = at(L + VIVID.surfaceStep);
  const surface2 = at(L + VIVID.surface2Step, c * 0.95);
  const textSurfaces = [bg, surface, surface2] as const;

  const fg = white;
  const fgMuted = adjustLightness({ l: VIVID.fgMutedL, c: Math.min(c * 0.35, 0.05), h }, "lighter", passesAll(textSurfaces, AA_TEXT));
  const accent = adjustLightness({ l: 0.97, c: Math.min(c * 0.15, 0.025), h }, "lighter", passesAll([bg], AA_UI));
  const accentFg = adjustLightness({ l: Math.max(L - 0.05, 0.05), c, h }, "darker", (hex) => contrastRatio(hex, accent) >= AA_TEXT);
  const accentText = adjustLightness(hexToOklch(accent), "lighter", passesAll(textSurfaces, AA_TEXT));
  const line = at(L + VIVID.lineStep, c * 0.9);
  const lineStrong = adjustLightness({ l: L + VIVID.lineStep, c: c * 0.6, h }, "lighter", passesAll([bg, surface], AA_UI));

  const textSafe = (hex: string): boolean =>
    contrastRatio(fg, hex) >= 7 && contrastRatio(fgMuted, hex) >= AA_TEXT && contrastRatio(accentText, hex) >= AA_TEXT;
  const stop = (dl: number, dh: number): string => {
    const candidate = oklchToHex({ l: L + dl, c, h: (h + dh + 360) % 360 });
    return textSafe(candidate) ? candidate : bg;
  };
  const gradient = [bg, stop(-0.03, 18), stop(-0.06, -22)] as const;

  return { mode: "vivid", bg, surface, surface2, fg, fgMuted, accent, accentFg, accentText, line, lineStrong, gradient };
}

export interface ContrastCheck {
  pair: string;
  ratio: number;
  min: number;
  pass: boolean;
}

/** Audit every relevant pair. Used by tests, the dashboard (badge) and the /design page. */
export function auditPalette(p: CreatorPalette): ContrastCheck[] {
  const checks: [string, string, string, number][] = [];
  for (const [name, bg] of [
    ["bg", p.bg],
    ["surface", p.surface],
    ["surface2", p.surface2],
  ] as const) {
    checks.push([`fg/${name}`, p.fg, bg, AA_TEXT]);
    checks.push([`fgMuted/${name}`, p.fgMuted, bg, AA_TEXT]);
    checks.push([`accentText/${name}`, p.accentText, bg, AA_TEXT]);
  }
  p.gradient.forEach((stop, i) => {
    checks.push([`fg/gradient${i}`, p.fg, stop, AA_TEXT]);
    checks.push([`fgMuted/gradient${i}`, p.fgMuted, stop, AA_TEXT]);
  });
  checks.push(["accentFg/accent", p.accentFg, p.accent, AA_TEXT]);
  checks.push(["accent/bg", p.accent, p.bg, AA_UI]);
  checks.push(["lineStrong/bg", p.lineStrong, p.bg, AA_UI]);
  checks.push(["lineStrong/surface", p.lineStrong, p.surface, AA_UI]);
  return checks.map(([pair, a, b, min]) => {
    const ratio = contrastRatio(a, b);
    return { pair, ratio: Math.round(ratio * 100) / 100, min, pass: ratio >= min };
  });
}
