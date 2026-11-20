import { describe, expect, it } from "vitest";

import { contrastRatio, hexToOklch, oklchToHex, parseHex, toHex } from "../src/creator/color";
import { auditPalette, generatePalette, type ThemeMode } from "../src/creator/palette";
import { PRESET_IDS, resolveCreatorTheme, shuffleCreatorTheme, TEMPLATE_IDS } from "../src/creator/theme";

/** Deterministic PRNG (mulberry32) so failures are reproducible. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randomHex = (random: () => number): string =>
  toHex({ r: random(), g: random(), b: random() });

describe("color math", () => {
  it("round-trips sRGB ↔ OKLCH", () => {
    for (const hex of ["#3355FF", "#0A0A0B", "#F7F6F2", "#D4FF3A", "#FFFFFF", "#000000", "#12B76A"]) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex);
    }
  });

  it("matches WCAG reference contrast values", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#3355FF", "#FFFFFF")).toBeCloseTo(5.41, 2);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });

  it("maps out-of-gamut colors into sRGB keeping hue", () => {
    const vivid = { l: 0.7, c: 0.4, h: 145 };
    const rgb = parseHex(oklchToHex(vivid));
    for (const channel of [rgb.r, rgb.g, rgb.b]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
    expect(Math.abs(hexToOklch(oklchToHex(vivid)).h - 145)).toBeLessThan(2);
  });
});

describe("creator palette contrast guard (brand §4.3)", () => {
  it("passes WCAG AA for 6,000 random seeds in all three modes", () => {
    const random = rng(20261117);
    const failures: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const accent = randomHex(random);
      const neutral = random() > 0.5 ? randomHex(random) : undefined;
      const tint = random();
      for (const mode of ["light", "dark", "vivid"] as ThemeMode[]) {
        const palette = generatePalette({ accent, neutral, tint, mode });
        for (const check of auditPalette(palette)) {
          if (!check.pass) failures.push(`${mode} accent=${accent} neutral=${neutral ?? "-"} tint=${tint.toFixed(2)} ${check.pair}=${check.ratio}`);
        }
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
    // ~2 s alone; generous limit so it stays green when every package tests in parallel.
  }, 30_000);

  it("handles extreme seeds", () => {
    for (const accent of ["#FFFFFF", "#000000", "#D4FF3A", "#FFFF00", "#0000FF", "#808080", "#FF00FF", "#00FFFF"]) {
      for (const mode of ["light", "dark", "vivid"] as ThemeMode[]) {
        expect(auditPalette(generatePalette({ accent, mode })).every((c) => c.pass), `${accent} ${mode}`).toBe(true);
      }
    }
  });

  it("keeps a usable seed unchanged", () => {
    expect(generatePalette({ accent: "#E0201B", mode: "light" }).accent).toBe("#E0201B");
    expect(generatePalette({ accent: "#8EA2FF", mode: "dark" }).accent).toBe("#8EA2FF");
  });

  it("is fast enough for live preview (< 50 ms budget)", () => {
    const random = rng(7);
    const start = performance.now();
    for (let i = 0; i < 500; i++) generatePalette({ accent: randomHex(random), tint: random(), mode: i % 2 ? "dark" : "light" });
    const perPalette = (performance.now() - start) / 500;
    expect(perPalette).toBeLessThan(5);
  });
});

describe("presets", () => {
  it("defines the 12 brand presets", () => {
    expect(PRESET_IDS).toEqual([
      "midnight",
      "paper",
      "studio",
      "neon-night",
      "sunset",
      "forest",
      "mono",
      "bold-red",
      "ocean",
      "pastel",
      "concrete",
      "gold",
    ]);
  });

  it("every preset × pairing × style × shape resolves to an AA palette and complete CSS vars", () => {
    for (const preset of PRESET_IDS) {
      const theme = resolveCreatorTheme({ preset });
      expect(auditPalette(theme.palette).every((c) => c.pass), preset).toBe(true);
      expect(Object.keys(theme.cssVars)).toHaveLength(21);
    }
    const random = rng(42);
    for (let i = 0; i < 200; i++) {
      const theme = resolveCreatorTheme(shuffleCreatorTheme(random));
      expect(auditPalette(theme.palette).every((c) => c.pass)).toBe(true);
    }
  });

  it("caps card radius below the button radius for pill shapes (large cards never become stadiums)", () => {
    const pill = resolveCreatorTheme({ preset: "mono", buttonShape: "pill" }).cssVars;
    expect(pill["--creator-radius-button"]).toBe("9999px");
    expect(Number.parseInt(pill["--creator-radius-card"] ?? "", 10)).toBeLessThanOrEqual(28);
    const rounded = resolveCreatorTheme({ preset: "mono", buttonShape: "rounded" }).cssVars;
    expect(rounded["--creator-radius-card"]).toBe(rounded["--creator-radius-button"]);
  });

  it("flips monochrome accents between modes instead of settling on mid-grey", () => {
    const light = resolveCreatorTheme({ preset: "mono" }).palette;
    const dark = resolveCreatorTheme({ preset: "mono", mode: "dark" }).palette;
    expect(hexToOklch(light.accent).l).toBeLessThan(0.3);
    expect(hexToOklch(dark.accent).l).toBeGreaterThan(0.85);
    expect(auditPalette(dark).every((c) => c.pass)).toBe(true);
  });

  it("vivid mode makes the page the creator's color with white text at 7:1", () => {
    const red = generatePalette({ accent: "#D7192B", mode: "vivid" });
    const bg = hexToOklch(red.bg);
    expect(bg.c).toBeGreaterThan(0.1);
    expect(Math.abs(bg.h - hexToOklch("#D7192B").h)).toBeLessThan(8);
    expect(contrastRatio(red.fg, red.surface2)).toBeGreaterThanOrEqual(7);
    expect(auditPalette(red).every((c) => c.pass)).toBe(true);
  });

  it("resolves every template with its layout, and explicit choices beat the template", () => {
    for (const template of TEMPLATE_IDS) {
      const theme = resolveCreatorTheme({ template });
      expect(theme.template).toBe(template);
      expect(auditPalette(theme.palette).every((c) => c.pass), template).toBe(true);
    }
    expect(resolveCreatorTheme({ template: "pulse" }).palette.mode).toBe("vivid");
    expect(resolveCreatorTheme({ template: "marquee" }).layout.hero).toBe("logo");
    expect(resolveCreatorTheme({ template: "atelier" }).layout.headings).toBe("sans-upper");
    expect(resolveCreatorTheme({ template: "nocturne", mode: "light" }).palette.mode).toBe("light");
    expect(resolveCreatorTheme({ preset: "midnight" }).layout).toEqual({ headings: "display", hero: "portrait", socials: "tiles", backdrop: "none", gallery: "rail", motion: "calm" });
    expect(resolveCreatorTheme({ template: "mono" }).layout).toEqual({ headings: "sans-upper", hero: "mono", socials: "plain", backdrop: "none", gallery: "rail", motion: "calm" });
    // The five newer looks bring their own layouts.
    expect(resolveCreatorTheme({ template: "studio" }).layout).toEqual({ headings: "numbered", hero: "cinema", socials: "plain", backdrop: "none", gallery: "rail", motion: "reveal" });
    expect(resolveCreatorTheme({ template: "aura" }).layout).toEqual({ headings: "display", hero: "halo", socials: "tiles", backdrop: "aurora", gallery: "rail", motion: "reveal" });
    expect(resolveCreatorTheme({ template: "folio" }).layout).toEqual({ headings: "rule", hero: "inset", socials: "plain", backdrop: "none", gallery: "grid", motion: "reveal" });
    expect(resolveCreatorTheme({ template: "signal" }).layout).toEqual({ headings: "mono", hero: "frame", socials: "tiles", backdrop: "grid", gallery: "rail", motion: "reveal" });
    expect(resolveCreatorTheme({ template: "bloom" }).layout).toEqual({ headings: "display", hero: "arch", socials: "tiles", backdrop: "none", gallery: "rail", motion: "reveal" });
    expect(resolveCreatorTheme({ template: "mono" }).palette.mode).toBe("light");
  });

  it("switches to the Arabic pairing for RTL scripts", () => {
    expect(resolveCreatorTheme({ preset: "midnight" }, { rtlScript: true }).pairing.id).toBe("arabic");
  });

  it("produces stable palettes (parity vectors for the Swift port)", async () => {
    const vectors = PRESET_IDS.map((preset) => ({ preset, palette: resolveCreatorTheme({ preset }).palette }));
    await expect(JSON.stringify(vectors, null, 2) + "\n").toMatchFileSnapshot("./fixtures/palettes.json");
  });
});
