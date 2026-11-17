import { oklchToHex, rgbToOklch } from "./color";
import type { ThemeMode } from "./palette";

export interface ExtractedSeed {
  /** Most common color (area-weighted). */
  dominant: string;
  /** Most vivid color with enough presence — used as accent. */
  vibrant: string;
  /** Suggested page mode: dark photos get dark pages. */
  mode: ThemeMode;
}

/**
 * Extract dominant + vibrant colors from RGBA pixels (e.g. a 64×64 canvas downscale of the
 * profile/hero photo). Pure and deterministic, so it runs in the browser, an Edge Function or a test.
 */
export function extractSeed(rgba: ArrayLike<number>, options: { step?: number } = {}): ExtractedSeed {
  const step = Math.max(1, options.step ?? 1);
  const buckets = new Map<string, { count: number; l: number; c: number; a: number; b: number }>();
  let lightnessSum = 0;
  let samples = 0;

  for (let i = 0; i + 3 < rgba.length; i += 4 * step) {
    const alpha = (rgba[i + 3] ?? 0) / 255;
    if (alpha < 0.5) continue;
    const color = rgbToOklch({ r: (rgba[i] ?? 0) / 255, g: (rgba[i + 1] ?? 0) / 255, b: (rgba[i + 2] ?? 0) / 255 });
    lightnessSum += color.l;
    samples++;
    // Hue bins of 15°, 6 lightness bins, 4 chroma bins.
    const hueBin = color.c < 0.03 ? "n" : String(Math.floor(color.h / 15));
    const key = `${hueBin}:${Math.floor(color.l * 6)}:${Math.min(3, Math.floor(color.c / 0.06))}`;
    const hr = (color.h * Math.PI) / 180;
    const bucket = buckets.get(key) ?? { count: 0, l: 0, c: 0, a: 0, b: 0 };
    bucket.count++;
    bucket.l += color.l;
    bucket.c += color.c;
    bucket.a += color.c * Math.cos(hr);
    bucket.b += color.c * Math.sin(hr);
    buckets.set(key, bucket);
  }

  if (samples === 0) return { dominant: "#808080", vibrant: "#808080", mode: "light" };

  const averaged = [...buckets.values()].map((bucket) => {
    const a = bucket.a / bucket.count;
    const b = bucket.b / bucket.count;
    return {
      share: bucket.count / samples,
      l: bucket.l / bucket.count,
      c: Math.sqrt(a * a + b * b),
      h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
    };
  });

  const dominant = averaged.reduce((best, item) => (item.share > best.share ? item : best));
  const vibrantCandidates = averaged.filter((item) => item.share >= 0.01 && item.l > 0.25 && item.l < 0.9);
  const vibrant = (vibrantCandidates.length > 0 ? vibrantCandidates : averaged).reduce((best, item) => {
    const score = item.c * Math.sqrt(item.share);
    const bestScore = best.c * Math.sqrt(best.share);
    return score > bestScore ? item : best;
  });

  return {
    dominant: oklchToHex(dominant),
    vibrant: oklchToHex(vibrant),
    mode: lightnessSum / samples < 0.5 ? "dark" : "light",
  };
}
