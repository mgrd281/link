/**
 * Minimal, dependency-free color math for the creator theme engine.
 *
 * - OKLab/OKLCH per Björn Ottosson (https://bottosson.github.io/posts/oklab/)
 * - WCAG 2.x relative luminance and contrast ratio
 * - sRGB gamut mapping by chroma reduction (hue and lightness preserved)
 *
 * Kept tiny on purpose: it runs in the dashboard on every keystroke (< 1 ms per palette)
 * and must be portable 1:1 to Swift (see `test/fixtures/palettes.json` for parity vectors).
 */

export interface Rgb {
  /** 0–1 */ r: number;
  /** 0–1 */ g: number;
  /** 0–1 */ b: number;
}

export interface Oklch {
  /** Lightness 0–1 */ l: number;
  /** Chroma ≥ 0 (sRGB max ≈ 0.37) */ c: number;
  /** Hue in degrees 0–360 */ h: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function parseHex(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, "");
  const full =
    value.length === 3 || value.length === 4
      ? value
          .slice(0, 3)
          .split("")
          .map((char) => char + char)
          .join("")
      : value.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Invalid hex color: ${hex}`);
  const int = Number.parseInt(full, 16);
  return { r: ((int >> 16) & 255) / 255, g: ((int >> 8) & 255) / 255, b: (int & 255) / 255 };
}

export function toHex({ r, g, b }: Rgb): string {
  const channel = (value: number): string =>
    Math.round(clamp01(value) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function rgbToOklch(rgb: Rgb): Oklch {
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const c = Math.sqrt(A * A + B * B);
  const h = c < 1e-6 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

/** Unclamped conversion — channels may fall outside 0–1 when the color is out of gamut. */
export function oklchToRgbUnclamped({ l: L, c, h }: Oklch): Rgb {
  const hr = (h * Math.PI) / 180;
  const A = c * Math.cos(hr);
  const B = c * Math.sin(hr);

  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;

  return {
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

const EPSILON = 1e-4;
const inGamut = ({ r, g, b }: Rgb): boolean =>
  r >= -EPSILON && r <= 1 + EPSILON && g >= -EPSILON && g <= 1 + EPSILON && b >= -EPSILON && b <= 1 + EPSILON;

/** Map an OKLCH color into sRGB by reducing chroma (binary search), keeping L and h. */
export function oklchToRgb(color: Oklch): Rgb {
  const l = clamp01(color.l);
  if (l >= 1) return { r: 1, g: 1, b: 1 };
  if (l <= 0) return { r: 0, g: 0, b: 0 };
  let candidate = oklchToRgbUnclamped({ ...color, l });
  if (inGamut(candidate)) return { r: clamp01(candidate.r), g: clamp01(candidate.g), b: clamp01(candidate.b) };

  let low = 0;
  let high = color.c;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    candidate = oklchToRgbUnclamped({ l, c: mid, h: color.h });
    if (inGamut(candidate)) low = mid;
    else high = mid;
  }
  candidate = oklchToRgbUnclamped({ l, c: low, h: color.h });
  return { r: clamp01(candidate.r), g: clamp01(candidate.g), b: clamp01(candidate.b) };
}

export const hexToOklch = (hex: string): Oklch => rgbToOklch(parseHex(hex));
export const oklchToHex = (color: Oklch): string => toHex(oklchToRgb(color));

/** WCAG 2.x relative luminance. */
export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

/** WCAG 2.x contrast ratio (1–21). Order of arguments does not matter. */
export function contrastRatio(a: string | Rgb, b: string | Rgb): number {
  const la = relativeLuminance(typeof a === "string" ? parseHex(a) : a);
  const lb = relativeLuminance(typeof b === "string" ? parseHex(b) : b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Alpha-composite `fg` (with alpha 0–1) over an opaque `bg`. */
export function composite(fg: string, alpha: number, bg: string): string {
  const f = parseHex(fg);
  const b = parseHex(bg);
  return toHex({
    r: f.r * alpha + b.r * (1 - alpha),
    g: f.g * alpha + b.g * (1 - alpha),
    b: f.b * alpha + b.b * (1 - alpha),
  });
}

/** Shortest signed hue distance in degrees. */
export function hueDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}
