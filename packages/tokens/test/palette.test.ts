import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { contrastRatio, hexToOklch, oklchToHex, parseHex, toHex } from "../src/creator/color";
import { auditPalette, generatePalette, type ThemeMode } from "../src/creator/palette";
import { DEFAULT_LAYOUT, drawnLayout, LAYOUT_FALLBACK, PRESET_IDS, PROJECTS_STYLES, resolveCreatorTheme, shuffleCreatorTheme, TEMPLATE_IDS, type CreatorLayout } from "../src/creator/theme";
import { creatorTokens, tokens } from "../src/generated/tokens";

/** The two portfolio templates (v8); every other template is "old" and must keep its layout. */
const PORTFOLIO_TEMPLATES = ["werkbogen", "tiefdruck"] as const;
/** Templates added after the portfolio: Laufbahn, for applications and CVs (ADR 0069). */
const LATER_TEMPLATES = ["laufbahn"] as const;
/** Stage 3's portfolio templates: Leuchttisch (photographers), Grundriss (designers, architects), Logbuch (developers, makers). */
const STAGE3_TEMPLATES = ["leuchttisch", "grundriss", "logbuch"] as const;
const NEW_TEMPLATES = [...PORTFOLIO_TEMPLATES, ...LATER_TEMPLATES, ...STAGE3_TEMPLATES] as const;
const OLD_TEMPLATES = TEMPLATE_IDS.filter((id) => !(NEW_TEMPLATES as readonly string[]).includes(id));
/** An accent whose OKLCH hue lies in this range reads as orange (spec §0): no template may carry one. */
const ORANGE_HUES = [40, 75] as const;

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
    expect(resolveCreatorTheme({ preset: "midnight" }).layout).toEqual({ headings: "display", hero: "portrait", socials: "tiles", backdrop: "none", gallery: "rail", motion: "calm", projects: "auto", canvas: "column" });
    expect(resolveCreatorTheme({ template: "mono" }).layout).toEqual({ headings: "sans-upper", hero: "mono", socials: "plain", backdrop: "none", gallery: "rail", motion: "calm", projects: "auto", canvas: "column" });
    // The five newer looks bring their own layouts.
    expect(resolveCreatorTheme({ template: "studio" }).layout).toEqual({ headings: "numbered", hero: "cinema", socials: "plain", backdrop: "none", gallery: "rail", motion: "reveal", projects: "auto", canvas: "column" });
    expect(resolveCreatorTheme({ template: "aura" }).layout).toEqual({ headings: "display", hero: "halo", socials: "tiles", backdrop: "aurora", gallery: "rail", motion: "reveal", projects: "auto", canvas: "column" });
    // Folio moved onto the wide canvas (C-06); everything else about it stays.
    expect(resolveCreatorTheme({ template: "folio" }).layout).toEqual({ headings: "rule", hero: "inset", socials: "plain", backdrop: "none", gallery: "grid", motion: "reveal", projects: "auto", canvas: "wide" });
    expect(resolveCreatorTheme({ template: "signal" }).layout).toEqual({ headings: "mono", hero: "frame", socials: "tiles", backdrop: "grid", gallery: "rail", motion: "reveal", projects: "auto", canvas: "column" });
    expect(resolveCreatorTheme({ template: "bloom" }).layout).toEqual({ headings: "display", hero: "arch", socials: "tiles", backdrop: "none", gallery: "rail", motion: "reveal", projects: "auto", canvas: "column" });
    expect(resolveCreatorTheme({ template: "mono" }).palette.mode).toBe("light");
  });

  it("Werkbogen and Tiefdruck: the layouts, and palettes that pass the audit", () => {
    // Every template is old or new, so a template added later has to be placed in one group.
    expect(TEMPLATE_IDS).toHaveLength(OLD_TEMPLATES.length + NEW_TEMPLATES.length);
    expect(OLD_TEMPLATES).toHaveLength(11);
    expect(resolveCreatorTheme({ template: "werkbogen" }).layout).toEqual({ headings: "marker", hero: "plate", socials: "plain", backdrop: "none", gallery: "grid", motion: "calm", projects: "auto", canvas: "wide" });
    expect(resolveCreatorTheme({ template: "tiefdruck" }).layout).toEqual({ headings: "headline", hero: "statement", socials: "plain", backdrop: "none", gallery: "grid", motion: "reveal", projects: "list", canvas: "wide" });
    for (const template of PORTFOLIO_TEMPLATES) {
      for (const rtlScript of [false, true]) {
        const failed = auditPalette(resolveCreatorTheme({ template }, { rtlScript }).palette).filter((check) => !check.pass);
        expect(failed, `${template} ${rtlScript ? "rtl" : "ltr"}`).toEqual([]);
      }
    }
    // The palettes as designed: a change in the generator or in the seeds shows up here.
    const werkbogen = resolveCreatorTheme({ template: "werkbogen" }).palette;
    expect({ mode: werkbogen.mode, bg: werkbogen.bg, surface: werkbogen.surface, surface2: werkbogen.surface2, fg: werkbogen.fg, fgMuted: werkbogen.fgMuted, accent: werkbogen.accent, accentFg: werkbogen.accentFg, accentText: werkbogen.accentText, line: werkbogen.line, lineStrong: werkbogen.lineStrong }).toEqual({
      mode: "light",
      bg: "#F4F6F8",
      surface: "#FCFCFD",
      surface2: "#E8EAEB",
      fg: "#151617",
      fgMuted: "#595B5D",
      accent: "#C2361B",
      accentFg: "#FFFFFF",
      accentText: "#C2361B",
      line: "#D8D9DB",
      lineStrong: "#8D8E90",
    });
    const tiefdruck = resolveCreatorTheme({ template: "tiefdruck" }).palette;
    expect({ mode: tiefdruck.mode, bg: tiefdruck.bg, surface: tiefdruck.surface, surface2: tiefdruck.surface2, fg: tiefdruck.fg, fgMuted: tiefdruck.fgMuted, accent: tiefdruck.accent, accentFg: tiefdruck.accentFg, accentText: tiefdruck.accentText, line: tiefdruck.line, lineStrong: tiefdruck.lineStrong }).toEqual({
      mode: "dark",
      bg: "#12100E",
      surface: "#1B1917",
      surface2: "#262321",
      fg: "#F6F3F1",
      fgMuted: "#B4B0AD",
      accent: "#3D5AFE",
      accentFg: "#FFFFFF",
      accentText: "#5E81FF",
      line: "#32302E",
      lineStrong: "#676562",
    });
  });

  it("each portfolio template (and every later one) differs from every other template in at least three layout keys", () => {
    const keys = Object.keys(DEFAULT_LAYOUT) as (keyof CreatorLayout)[];
    // One known pair: Folio moved onto the wide canvas in Stage 3 (C-06), so Laufbahn and Folio now
    // share six keys; they still differ in the two that shape the page (signposted sections with a
    // contents menu and the bleed hero, against ruled titles and a framed picture), and Laufbahn may not change.
    const known = (a: string, b: string) => [a, b].sort().join("|") === "folio|laufbahn";
    for (const template of NEW_TEMPLATES) {
      const mine = resolveCreatorTheme({ template }).layout;
      for (const other of TEMPLATE_IDS.filter((id) => id !== template)) {
        const theirs = resolveCreatorTheme({ template: other }).layout;
        const different = keys.filter((key) => mine[key] !== theirs[key]);
        expect(different.length, `${template} vs ${other}: ${different.join(", ")}`).toBeGreaterThanOrEqual(known(template, other) ? 2 : 3);
      }
    }
    // Stage 3's looks are never a re-skin: at least three keys apart from every template, without exception.
    for (const template of STAGE3_TEMPLATES) {
      const mine = resolveCreatorTheme({ template }).layout;
      for (const other of TEMPLATE_IDS.filter((id) => id !== template)) {
        const theirs = resolveCreatorTheme({ template: other }).layout;
        expect(keys.filter((key) => mine[key] !== theirs[key]).length, `${template} vs ${other}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("the work layout is the owner's choice; the canvas is the template's", () => {
    expect(PROJECTS_STYLES).toEqual(["auto", "bento", "list", "rail"]);
    expect(resolveCreatorTheme({ template: "tiefdruck" }).layout.projects).toBe("list");
    expect(resolveCreatorTheme({ template: "tiefdruck", projects: "bento" }).layout.projects).toBe("bento");
    expect(resolveCreatorTheme({ template: "werkbogen", projects: "rail" }).layout.projects).toBe("rail");
    expect(resolveCreatorTheme({ template: "folio", projects: "list" }).layout.projects).toBe("list");
    expect(resolveCreatorTheme({ projects: "rail" }).layout.projects).toBe("rail");
    // A stored value this version does not know falls back to the template.
    expect(resolveCreatorTheme({ template: "tiefdruck", projects: "masonry" as never }).layout.projects).toBe("list");
    for (const template of OLD_TEMPLATES) {
      const layout = resolveCreatorTheme({ template, projects: "bento" }).layout;
      // The link-in-bio looks keep the column; Folio has the wide canvas since Stage 3 (C-06).
      expect(layout.canvas, template).toBe(template === "folio" ? "wide" : "column");
      expect(resolveCreatorTheme({ template }).layout.projects, template).toBe("auto");
    }
    expect(resolveCreatorTheme({ preset: "midnight" }).layout.canvas).toBe("column");
    // Leuchttisch's pictures run to layout.wall (full); every other portfolio template has the wide canvas.
    for (const template of NEW_TEMPLATES) expect(resolveCreatorTheme({ template }).layout.canvas, template).toBe(template === "leuchttisch" ? "full" : "wide");
    // The owner's work layout wins over a template's own (Leuchttisch's justified rows become a grid).
    expect(resolveCreatorTheme({ template: "leuchttisch", projects: "bento" }).layout.projects).toBe("bento");
    expect(resolveCreatorTheme({ template: "logbuch" }).layout.projects).toBe("log");
  });

  it("Stage 3's looks: their layouts, palettes that pass the audit in light and dark, in both scripts", () => {
    // After every earlier template, in this order (the pickers' and the gallery's order).
    expect(TEMPLATE_IDS.slice(-STAGE3_TEMPLATES.length)).toEqual([...STAGE3_TEMPLATES]);
    expect(resolveCreatorTheme({ template: "leuchttisch" }).layout).toEqual({ headings: "sans", hero: "strip", socials: "plain", backdrop: "none", gallery: "justified", motion: "calm", projects: "justified", canvas: "full" });
    expect(resolveCreatorTheme({ template: "grundriss" }).layout).toEqual({ headings: "numbered", hero: "titleblock", socials: "plain", backdrop: "columns", gallery: "grid", motion: "calm", projects: "sheets", canvas: "wide" });
    expect(resolveCreatorTheme({ template: "logbuch" }).layout).toEqual({ headings: "mono", hero: "readme", socials: "plain", backdrop: "none", gallery: "grid", motion: "calm", projects: "log", canvas: "wide" });
    // Plan 4.2: the pairing each look is drawn in, and its buttons.
    expect(STAGE3_TEMPLATES.map((template) => resolveCreatorTheme({ template }).pairing.id)).toEqual(["classic", "modern", "tech"]);
    expect(STAGE3_TEMPLATES.map((template) => [resolveCreatorTheme({ template }).buttonStyle, resolveCreatorTheme({ template }).buttonShape])).toEqual([
      ["minimal", "square"],
      ["outline", "square"],
      ["outline", "rounded"],
    ]);
    for (const template of STAGE3_TEMPLATES) {
      expect(creatorTokens.templates[template].use, template).toEqual(["portfolio"]);
      // Light as designed; dark when the owner switches the mode. Arabic pages resolve the same colours.
      for (const mode of ["light", "dark"] as const) {
        for (const rtlScript of [false, true]) {
          const failed = auditPalette(resolveCreatorTheme({ template, mode }, { rtlScript }).palette).filter((check) => !check.pass);
          expect(failed, `${template} ${mode} ${rtlScript ? "rtl" : "ltr"}`).toEqual([]);
        }
      }
    }
    expect(creatorTokens.templates.leuchttisch.label).toBe("Leuchttisch");
    expect(creatorTokens.templates.grundriss.label).toBe("Grundriss");
    expect(creatorTokens.templates.logbuch.label).toBe("Logbuch");
    // The palettes as designed: ink chrome on a light table, a drafting green on drawing paper, sage on an off-white document.
    const pick = (template: (typeof STAGE3_TEMPLATES)[number]) => {
      const palette = resolveCreatorTheme({ template }).palette;
      return { mode: palette.mode, bg: palette.bg, fg: palette.fg, fgMuted: palette.fgMuted, accent: palette.accent, accentFg: palette.accentFg, accentText: palette.accentText, line: palette.line };
    };
    expect(pick("leuchttisch")).toEqual({ mode: "light", bg: "#F6F6F5", fg: "#161616", fgMuted: "#5B5B5A", accent: "#111111", accentFg: "#FFFFFF", accentText: "#111111", line: "#D9D9D9" });
    expect(pick("grundriss")).toEqual({ mode: "light", bg: "#F5F6F6", fg: "#161616", fgMuted: "#5B5B5B", accent: "#1F7A6D", accentFg: "#FFFFFF", accentText: "#1A766A", line: "#D9D9D9" });
    expect(pick("logbuch")).toEqual({ mode: "light", bg: "#F6F6F4", fg: "#161615", fgMuted: "#5B5B59", accent: "#588057", accentFg: "#FFFFFF", accentText: "#4B724A", line: "#D9D9D8" });
    // Leuchttisch's chrome is ink: only the photographs carry colour.
    expect(hexToOklch(creatorTokens.templates.leuchttisch.accent).c).toBeLessThan(0.01);
  });

  it("no template carries an orange accent (OKLCH hue 40°–75° with visible chroma)", () => {
    for (const template of TEMPLATE_IDS) {
      const { h, c } = hexToOklch(creatorTokens.templates[template].accent);
      // Near-greys have no hue to speak of (Atelier's warm black measures 85° at a chroma of 0.004).
      if (c < 0.02) continue;
      expect(h >= ORANGE_HUES[0] && h <= ORANGE_HUES[1], `${template}: hue ${h.toFixed(1)}°`).toBe(false);
    }
    // Werkbogen's red measures 33° (pure red is 29°, orange 53°): red, kept (spec §0).
    expect(hexToOklch(creatorTokens.templates.werkbogen.accent).h).toBeLessThan(ORANGE_HUES[0]);
  });

  it("draws every layout value: nothing falls back any more", () => {
    // Stage 3 drew strip, titleblock, readme, justified, sheets, log, the justified gallery, columns and
    // the full canvas: the fallback table is empty, and a layout passes through unchanged.
    expect(LAYOUT_FALLBACK).toEqual({});
    const stage3 = { ...DEFAULT_LAYOUT, hero: "strip", projects: "log", gallery: "justified", backdrop: "columns", canvas: "full" } as const satisfies CreatorLayout;
    expect(drawnLayout(stage3)).toEqual(stage3);
    expect(drawnLayout(DEFAULT_LAYOUT)).toEqual(DEFAULT_LAYOUT);
    // Every value a template names is drawn as itself.
    for (const template of TEMPLATE_IDS) {
      const t = creatorTokens.templates[template] as Partial<Record<keyof CreatorLayout, string>>;
      const { layout } = resolveCreatorTheme({ template });
      for (const key of Object.keys(DEFAULT_LAYOUT) as (keyof CreatorLayout)[]) {
        if (t[key] !== undefined) expect(layout[key], `${template} ${key}`).toBe(t[key]);
      }
    }
    // Owners still choose only the four work layouts; justified, sheets and log come with a template.
    expect(PROJECTS_STYLES).not.toContain("justified");
    expect(PROJECTS_STYLES).not.toContain("log");
  });

  it("Laufbahn: signposts and the bleed hero, a light palette that passes the audit, and Sevag's navy", () => {
    // Laufbahn follows the two portfolio templates (Stage 3's templates come after it).
    expect(TEMPLATE_IDS.indexOf("laufbahn")).toBe(TEMPLATE_IDS.indexOf("tiefdruck") + 1);
    expect(resolveCreatorTheme({ template: "laufbahn" }).layout).toEqual({ headings: "signpost", hero: "bleed", socials: "plain", backdrop: "none", gallery: "grid", motion: "reveal", projects: "auto", canvas: "wide" });
    // The new layout values belong to Laufbahn alone: every other template renders as before.
    for (const template of TEMPLATE_IDS.filter((id) => id !== "laufbahn")) {
      const { layout } = resolveCreatorTheme({ template });
      expect(layout.headings, template).not.toBe("signpost");
      expect(layout.hero, template).not.toBe("bleed");
    }
    // Geist for both faces (grotesk, round 6), so the hierarchy is size and weight alone; 700 on Arabic pages too.
    expect(resolveCreatorTheme({ template: "laufbahn" }).pairing.id).toBe("grotesk");
    expect(resolveCreatorTheme({ template: "laufbahn" }, { rtlScript: true }).cssVars["--creator-display-weight"]).toBe("700");
    for (const accent of [undefined, creatorTokens.swatches.navy]) {
      for (const rtlScript of [false, true]) {
        const palette = resolveCreatorTheme({ template: "laufbahn", ...(accent ? { accent } : {}) }, { rtlScript }).palette;
        expect(auditPalette(palette).filter((check) => !check.pass), `${accent ?? "template"} ${rtlScript ? "rtl" : "ltr"}`).toEqual([]);
      }
    }
    const laufbahn = resolveCreatorTheme({ template: "laufbahn" }).palette;
    expect({ mode: laufbahn.mode, bg: laufbahn.bg, surface: laufbahn.surface, surface2: laufbahn.surface2, fg: laufbahn.fg, fgMuted: laufbahn.fgMuted, accent: laufbahn.accent, accentFg: laufbahn.accentFg, accentText: laufbahn.accentText, line: laufbahn.line, lineStrong: laufbahn.lineStrong }).toEqual({
      mode: "light",
      bg: "#F5F6F7",
      surface: "#FCFCFD",
      surface2: "#E8E9EB",
      fg: "#161617",
      fgMuted: "#5A5B5C",
      accent: "#1E50C8",
      accentFg: "#FFFFFF",
      accentText: "#1E50C8",
      line: "#D8D9DA",
      lineStrong: "#8E8E8F",
    });
  });

  // Stage 2 (C-03): Arabic pages set each pairing's Arabic companion at that companion's weight; the
  // template's own `arabicDisplayWeight` still wins (Werkbogen 400, Laufbahn 700, as before).
  it("Arabic pages: the display weight is the companion's, and a template's arabicDisplayWeight wins", () => {
    const weight = (template: (typeof TEMPLATE_IDS)[number] | undefined, rtlScript: boolean) => resolveCreatorTheme(template ? { template } : {}, { rtlScript }).cssVars["--creator-display-weight"];
    expect(weight("werkbogen", true)).toBe("400");
    expect(weight("laufbahn", true)).toBe("700");
    for (const template of TEMPLATE_IDS) {
      const t = creatorTokens.templates[template] as { pairing: keyof typeof creatorTokens.pairings; arabicDisplayWeight?: number; arabic?: { display?: { weight: number } } };
      const companion = (creatorTokens.pairings[t.pairing] as { arabic?: { display?: { weight: number } } }).arabic?.display?.weight;
      expect(weight(template, true), template).toBe(String(t.arabicDisplayWeight ?? t.arabic?.display?.weight ?? companion));
    }
    // Stage templates set Lalezar or Rakkas, which come in one heavy 400; Bricolage's companion is Changa 700.
    expect(weight("nocturne", true)).toBe("400");
    expect(weight("tiefdruck", true)).toBe("700");
    expect(weight("folio", true)).toBe("700");
    // Without a template the preset's pairing brings its companion.
    const presetPairing = creatorTokens.presets.paper.pairing;
    expect(weight(undefined, true)).toBe(String((creatorTokens.pairings[presetPairing] as { arabic?: { display?: { weight: number } } }).arabic?.display?.weight));
    // Left to right nothing changes: the weight is the pairing's.
    for (const template of TEMPLATE_IDS) {
      const theme = resolveCreatorTheme({ template });
      expect(theme.cssVars["--creator-display-weight"], template).toBe(String(theme.pairing.display.weight));
    }
    expect(resolveCreatorTheme({ template: "werkbogen" }, { rtlScript: true }).pairing.id).toBe("arabic");
  });

  it("the wide canvas and the photo ratio exist as tokens and as utilities", () => {
    expect(tokens.layout.work).toBe(tokens.layout.content);
    expect(tokens.layout.work).toBe(1120);
    expect(tokens.aspect.photo).toBe("3 / 2");
    // Tailwind turns --container-work into max-w-work and the @work: container variant, and
    // --aspect-photo into aspect-photo (the build writes the theme before the tests run).
    const theme = readFileSync(path.join(import.meta.dirname, "../dist/tailwind/theme.css"), "utf8");
    expect(theme).toContain("--container-work: 70rem;");
    // The full canvas (Stage 3): pictures up to layout.wall, as max-w-wall and the @wall: variant.
    expect(tokens.layout.wall).toBe(1680);
    expect(theme).toContain("--container-wall: 105rem;");
    expect(theme).toContain("--aspect-photo: 3 / 2;");
  });

  it("switches to the Arabic pairing for RTL scripts", () => {
    expect(resolveCreatorTheme({ preset: "midnight" }, { rtlScript: true }).pairing.id).toBe("arabic");
  });

  it("produces stable palettes (parity vectors for the Swift port)", async () => {
    const vectors = PRESET_IDS.map((preset) => ({ preset, palette: resolveCreatorTheme({ preset }).palette }));
    await expect(JSON.stringify(vectors, null, 2) + "\n").toMatchFileSnapshot("./fixtures/palettes.json");
  });
});
