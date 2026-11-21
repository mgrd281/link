import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { composite, contrastRatio, hexToOklch } from "../src/creator/color";
import { tokens } from "../src/generated/tokens";

const s = tokens.semantic;
type Mode = "light" | "dark";
const modes: Mode[] = ["light", "dark"];

type ConsolePalette = (roles: { name: string; console?: string; consoleDark?: string; highContrast?: string; highContrastDark?: string }[]) => {
  light: [string, string][];
  dark: [string, string][];
};
/** The token build's console model (scripts/build.mjs builds only when run as a script). */
const BUILD_SCRIPT = "../scripts/build.mjs";
const loadConsolePalette = async (): Promise<ConsolePalette> => ((await import(BUILD_SCRIPT)) as { consolePalette: ConsolePalette }).consolePalette;

/** Resolve a (possibly translucent) token color over an opaque background. */
function over(color: string, background: string): string {
  if (color.length === 9) {
    const alpha = Number.parseInt(color.slice(7, 9), 16) / 255;
    return composite(color.slice(0, 7), alpha, background);
  }
  return color;
}

function ratio(fg: string, bg: string): number {
  return contrastRatio(over(fg, bg), bg);
}

describe("product UI semantic colors (brand §4, WCAG 2.2 AA)", () => {
  for (const mode of modes) {
    const backgrounds = [s.canvas[mode], s.canvasMuted[mode], s.surface[mode], s.surfaceElevated[mode], s.group[mode]];

    it(`${mode}: text roles reach 4.5:1 on every surface`, () => {
      for (const bg of backgrounds) {
        for (const role of ["fg", "fgSecondary", "fgTertiary", "successStrong", "warningStrong", "dangerStrong"] as const) {
          expect(ratio(s[role][mode], bg), `${role} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`${mode}: links reach 4.5:1 on canvas and surfaces`, () => {
      for (const bg of backgrounds) expect(ratio(s.link[mode], bg), `link on ${bg}`).toBeGreaterThanOrEqual(4.5);
    });

    it(`${mode}: labels on fills reach 4.5:1`, () => {
      for (const fill of [s.primary[mode], s.primaryHover[mode], s.primaryPressed[mode]]) {
        expect(ratio(s.primaryFg[mode], fill)).toBeGreaterThanOrEqual(4.5);
      }
      expect(ratio(s.dangerFillFg[mode], s.dangerFill[mode])).toBeGreaterThanOrEqual(4.5);
      expect(ratio(s.sparkFg[mode], s.spark[mode])).toBeGreaterThanOrEqual(4.5);
      const selected = over(s.selected[mode], s.canvas[mode]);
      expect(contrastRatio(s.selectedFg[mode], selected)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${mode}: text on the tinted panels reaches 4.5:1`, () => {
      for (const tint of [s.tintRose[mode], s.tintLavender[mode], s.tintMint[mode], s.tintLime[mode], s.tintTeal[mode]]) {
        for (const role of ["fg", "fgSecondary"] as const) {
          expect(ratio(s[role][mode], tint), `${role} on ${tint}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`${mode}: focus ring and input boundaries reach 3:1 (WCAG 1.4.11)`, () => {
      for (const bg of backgrounds) {
        expect(ratio(s.focus[mode], bg), `focus on ${bg}`).toBeGreaterThanOrEqual(3);
        expect(ratio(s.lineInput[mode], bg), `line-input on ${bg}`).toBeGreaterThanOrEqual(3);
      }
    });
  }

  it("keeps the brand anchors exact", () => {
    expect(tokens.color.teal["700"]).toBe("#00454C");
    expect(tokens.color.teal["600"]).toBe("#00565F");
    expect(s.primary.light).toBe("#00454C");
    expect(s.primaryHover.light).toBe("#00565F");
    expect(s.primaryFg.light).toBe("#FFFFFF");
    expect(s.canvas.light).toBe("#FFFFFF");
    expect(s.canvasMuted.light).toBe("#EFF8F8");
    expect(tokens.color.ink).toBe("#0A0A0B");
    expect(tokens.color.paper).toBe("#F7F6F2");
    expect(tokens.color.violet["500"]).toBe("#9500E9");
    expect(tokens.color.violet["600"]).toBe("#7E00C7");
    expect(tokens.color.violet["100"]).toBe("#F2E8FF");
    expect(tokens.color.violet["400"]).toBe("#B35EFF");
    expect(tokens.color.lime["400"]).toBe("#D4FF3A");
    expect(tokens.color.success["500"]).toBe("#12B76A");
    expect(tokens.color.warning["500"]).toBe("#E0A800");
    expect(tokens.color.danger["500"]).toBe("#F04438");
    expect(s.canvas.dark).toBe("#0A0A0B");
    expect(s.surface.dark).toBe("#141416");
    expect(s.surfaceElevated.dark).toBe("#1C1C1F");
  });

  it("follows the brand spacing, radius, type and motion scales", () => {
    expect(Object.values(tokens.spacing).filter((v) => typeof v === "number")).toEqual(
      expect.arrayContaining([0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128]),
    );
    expect(tokens.radius).toMatchObject({ xs: 6, sm: 10, md: 14, lg: 20, xl: 28, full: 9999 });
    expect(tokens.text.h1).toMatchObject({ fontSize: 36, lineHeight: 1.15, fontWeight: 700 });
    expect(tokens.motion.duration).toMatchObject({ micro: 120, standard: 200, slow: 320 });
    expect(tokens.motion.easing.standard).toEqual([0.2, 0.8, 0.2, 1]);
    expect(tokens.size.touchTarget).toBe(44);
  });
});

describe("dashboard palette: black and grey (ADR 0062)", () => {
  interface Role {
    console: Record<Mode, string>;
  }
  const c = (role: Role, mode: Mode) => role.console[mode];

  for (const mode of modes) {
    const grounds = [s.canvas, s.canvasMuted, s.surface, s.surfaceElevated, s.group].map((role) => c(role, mode));

    it(`${mode}: text, links and link hover reach 4.5:1 on every dashboard surface`, () => {
      for (const bg of grounds) {
        for (const role of ["fg", "fgSecondary", "fgTertiary", "successStrong", "warningStrong", "dangerStrong", "link", "linkHover"] as const) {
          expect(ratio(c(s[role], mode), bg), `${role} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`${mode}: labels on fills reach 4.5:1 wherever the fill sits`, () => {
      for (const fill of [s.primary, s.primaryHover, s.primaryPressed]) {
        expect(ratio(c(s.primaryFg, mode), c(fill, mode)), `primary-fg on ${c(fill, mode)}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const bg of grounds) {
        const selected = over(c(s.selected, mode), bg);
        for (const role of ["selectedFg", "fgSecondary", "fgTertiary"] as const) {
          expect(ratio(c(s[role], mode), selected), `${role} on selected over ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
        for (const tint of [s.tinted, s.tintedHover]) {
          expect(ratio(c(s.tintedFg, mode), over(c(tint, mode), bg)), `tinted-fg on ${c(tint, mode)} over ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`${mode}: focus, field edges, filled controls and data marks reach 3:1 (WCAG 1.4.11)`, () => {
      for (const bg of grounds) {
        expect(ratio(c(s.focus, mode), bg), `focus on ${bg}`).toBeGreaterThanOrEqual(3);
        expect(ratio(c(s.focus, mode), over(c(s.selected, mode), bg)), `focus on selected over ${bg}`).toBeGreaterThanOrEqual(3);
        expect(ratio(c(s.lineInput, mode), bg), `line-input on ${bg}`).toBeGreaterThanOrEqual(3);
        // Switch track, the active rail tile, chart bars.
        expect(ratio(c(s.primary, mode), bg), `primary on ${bg}`).toBeGreaterThanOrEqual(3);
        // Dimmed chart bars.
        expect(contrastRatio(composite(c(s.primary, mode), tokens.opacity.secondary, bg), bg), `dimmed primary on ${bg}`).toBeGreaterThanOrEqual(3);
        // A progress fill on its track.
        expect(ratio(c(s.link, mode), over(c(s.tinted, mode), bg)), `link on tinted over ${bg}`).toBeGreaterThanOrEqual(3);
      }
      // The switch knob when on (switch.tsx: data-[state=checked]:bg-primary-fg).
      expect(ratio(c(s.primaryFg, mode), c(s.primary, mode))).toBeGreaterThanOrEqual(3);
    });

    it(`${mode}: selected and tinted fills stand off their ground as much as teal did`, () => {
      const step = (fill: string, bg: string) => contrastRatio(over(fill, bg), bg);
      expect(step(c(s.selected, mode), c(s.surface, mode))).toBeGreaterThanOrEqual(mode === "light" ? 1.2 : 1.25);
      expect(step(c(s.tinted, mode), c(s.canvasMuted, mode))).toBeGreaterThanOrEqual(1.1);
    });

    it(`${mode}: a link visibly changes on hover`, () => {
      expect(contrastRatio(c(s.link, mode), c(s.linkHover, mode))).toBeGreaterThanOrEqual(2);
    });
  }

  it("graphite is cool and neutral: never warm, never orange", () => {
    const steps = Object.values(tokens.color.graphite);
    expect(steps).toHaveLength(8);
    for (const hex of steps) {
      const { c: chroma, h } = hexToOklch(hex);
      expect(chroma, hex).toBeLessThan(0.01);
      expect(Math.abs(h - 286), hex).toBeLessThan(3);
    }
  });

  it("every role the dashboard changes has no hue", () => {
    for (const [name, role] of Object.entries(s)) {
      for (const mode of modes) {
        const value = (role as Role).console[mode];
        if (value === (role as Record<Mode, string>)[mode]) continue;
        // Body text (ink / paper) is the dashboard's text colour already, warm paper included.
        if (value === s.fg[mode]) continue;
        const { c: chroma, h } = hexToOklch(value.slice(0, 7));
        expect(chroma, `${name} (${mode})`).toBeLessThan(0.01);
        if (chroma > 0.002) expect(Math.abs(h - 286), `${name} (${mode})`).toBeLessThan(6);
      }
    }
  });

  it("changes exactly the 12 roles plus link-hover, and nothing else", () => {
    const changed = Object.entries(s)
      .filter(([, role]) => modes.some((mode) => (role as Role).console[mode] !== (role as Record<Mode, string>)[mode]))
      .map(([name]) => name)
      .sort();
    expect(changed).toEqual(
      ["canvasMuted", "focus", "link", "linkHover", "primary", "primaryFg", "primaryHover", "primaryPressed", "selected", "selectedFg", "tinted", "tintedFg", "tintedHover"].sort(),
    );
  });

  it("outside the dashboard nothing changes: link-hover is body text", () => {
    expect(s.linkHover.light).toBe(s.fg.light);
    expect(s.linkHover.dark).toBe(s.fg.dark);
    expect(s.primary.light).toBe("#00454C"); // the brand anchors test pins the rest
    expect(s.primary.console).toEqual({ light: "#1C1C1F", dark: "#F5F5F7" });
    expect(s.canvasMuted.console).toEqual({ light: "#F5F5F7", dark: s.canvasMuted.dark });
  });

  it("the nav layout adds up to the former sidebar", () => {
    expect(tokens.layout.navRail).toBe(64);
    expect(tokens.layout.navPanel).toBe(184);
    expect(tokens.layout.navRail + tokens.layout.navPanel).toBe(tokens.layout.sidebar);
  });

  it("the build refuses a console value without its pair, or next to high-contrast values", async () => {
    const consolePalette = await loadConsolePalette();
    expect(() => consolePalette([{ name: "--color-x", console: "#000000" }])).toThrow(/come in pairs/);
    expect(() => consolePalette([{ name: "--color-x", consoleDark: "#FFFFFF" }])).toThrow(/come in pairs/);
    expect(() => consolePalette([{ name: "--color-x", console: "#000000", consoleDark: "#FFFFFF", highContrast: "#111111" }])).toThrow(/never both/);
    expect(consolePalette([{ name: "--color-x", console: "#0A0A0B", consoleDark: "#F5F5F71A" }, { name: "--color-y" }])).toEqual({
      light: [["--color-x", "#0a0a0b"]],
      dark: [["--color-x", "#f5f5f71a"]],
    });
  });
});

describe("generated outputs", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const read = (file: string): string => readFileSync(path.join(root, file), "utf8");

  it("Tailwind theme resets the default theme and defines dark + high-contrast overrides", () => {
    const css = read("dist/tailwind/theme.css");
    expect(css).toContain("--*: initial;");
    expect(css).toContain("--color-canvas: #ffffff;");
    expect(css).toMatch(/\[data-theme="dark"\] \{[^}]*--color-canvas: #0a0a0b;/);
    expect(css).toContain("@media (prefers-contrast: more)");
    expect(css).toContain("--spacing-0_5: 0.125rem;");
    expect(css).toContain("--container-creator: 35rem;");
  });

  it("CSS variables mirror the Tailwind theme", () => {
    const css = read("dist/css/tokens.css");
    expect(css).toContain("--color-primary: #00454c;");
    expect(css).toContain("--font-sans: var(--font-face-geist, Geist), var(--font-face-plex-arabic, \"IBM Plex Sans Arabic\")");
  });

  /** The three console blocks: light, chosen dark, system dark (ADR 0062). */
  const consoleBlocks = [
    /:root:has\(\[data-console="frame"\]\),\s*\[data-console\] \{[^}]*--color-primary: #1c1c1f;[^}]*--color-link-hover: #606065;/,
    /:root\[data-theme="dark"\]:has\(\[data-console="frame"\]\),\s*\[data-theme="dark"\] \[data-console\] \{[^}]*--color-primary: #f5f5f7;[^}]*--color-primary-fg: #0a0a0b;/,
    /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\):has\(\[data-console="frame"\]\),\s*:root:not\(\[data-theme="light"\]\) \[data-console\] \{[^}]*--color-canvas-muted: #0f0f11;[^}]*--color-primary: #f5f5f7;/,
  ];

  it("Tailwind theme scopes the dashboard palette to data-console in both modes", () => {
    const css = read("dist/tailwind/theme.css");
    for (const block of consoleBlocks) expect(css).toMatch(block);
    // In the base layer, after the light opt-in block and before high contrast.
    const at = (text: string) => css.indexOf(text);
    expect(at(':root:has([data-console="frame"])')).toBeGreaterThan(at(':root [data-theme="light"] {'));
    expect(at(':root:has([data-console="frame"])')).toBeLessThan(at("@media (prefers-contrast: more)"));
    expect(css.match(/\[data-console/g)).toHaveLength(6);
  });

  it("CSS variables carry the same console blocks", () => {
    const css = read("dist/css/tokens.css");
    for (const block of consoleBlocks) expect(css).toMatch(block);
  });

  it("iOS stays teal: the console palette is web only", () => {
    const ios = path.resolve(root, "../../apps/ios/Packages/LinkyoDesignSystem/Sources/LinkyoDesignSystem/Generated");
    const colorset = (name: string) =>
      JSON.parse(readFileSync(path.join(ios, `Colors.xcassets/${name}.colorset/Contents.json`), "utf8")) as {
        colors: { appearances?: unknown[]; color: { components: Record<string, string> } }[];
      };
    const primary = colorset("Semantic/Primary");
    expect(primary.colors).toHaveLength(2); // light + dark, nothing else
    expect(primary.colors[0]?.color.components).toEqual({ alpha: "1.000", blue: "0.298", green: "0.271", red: "0.000" }); // teal 700
    expect(colorset("Semantic/LinkHover").colors).toHaveLength(2);
    expect(colorset("Palette/Graphite50").colors).toHaveLength(1);
    const swift = readFileSync(path.join(ios, "DesignTokens.swift"), "utf8");
    expect(swift).not.toMatch(/console/i);
  });

  it("iOS: Swift tokens and asset catalog are generated", () => {
    const ios = path.resolve(root, "../../apps/ios/Packages/LinkyoDesignSystem/Sources/LinkyoDesignSystem/Generated");
    const swift = readFileSync(path.join(ios, "DesignTokens.swift"), "utf8");
    expect(swift).toContain("public static let s0_5: CGFloat = 2");
    expect(swift).toContain("public static let touchTarget: CGFloat = 44");
    expect(swift).toContain("public static let springResponse: Double = 0.35");
    expect(swift).toContain('Color("Semantic/Canvas", bundle: .module)');
    const canvas = JSON.parse(
      readFileSync(path.join(ios, "Colors.xcassets/Semantic/Canvas.colorset/Contents.json"), "utf8"),
    ) as { colors: { appearances?: unknown[] }[] };
    expect(canvas.colors).toHaveLength(2);
    expect(existsSync(path.join(ios, "Colors.xcassets/Semantic/LineInput.colorset/Contents.json"))).toBe(true);
    const lineInput = JSON.parse(
      readFileSync(path.join(ios, "Colors.xcassets/Semantic/LineInput.colorset/Contents.json"), "utf8"),
    ) as { colors: unknown[] };
    expect(lineInput.colors).toHaveLength(4); // light, dark, high contrast, high contrast dark
  });
});
