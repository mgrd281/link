import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { composite, contrastRatio } from "../src/creator/color";
import { tokens } from "../src/generated/tokens";

const s = tokens.semantic;
type Mode = "light" | "dark";
const modes: Mode[] = ["light", "dark"];

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
    const backgrounds = [s.canvas[mode], s.canvasMuted[mode], s.surface[mode], s.surfaceElevated[mode]];

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

    it(`${mode}: focus ring and input boundaries reach 3:1 (WCAG 1.4.11)`, () => {
      for (const bg of backgrounds) {
        expect(ratio(s.focus[mode], bg), `focus on ${bg}`).toBeGreaterThanOrEqual(3);
        expect(ratio(s.lineInput[mode], bg), `line-input on ${bg}`).toBeGreaterThanOrEqual(3);
      }
    });
  }

  it("keeps the brand anchors exact", () => {
    expect(tokens.color.ink).toBe("#0A0A0B");
    expect(tokens.color.paper).toBe("#F7F6F2");
    expect(tokens.color.violet["500"]).toBe("#9500E9");
    expect(tokens.color.violet["600"]).toBe("#7E00C7");
    expect(tokens.color.violet["100"]).toBe("#F2E8FF");
    expect(tokens.color.violet["400"]).toBe("#B35EFF");
    expect(tokens.color.lime["400"]).toBe("#D4FF3A");
    expect(tokens.color.success["500"]).toBe("#12B76A");
    expect(tokens.color.warning["500"]).toBe("#F79009");
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

describe("generated outputs", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const read = (file: string): string => readFileSync(path.join(root, file), "utf8");

  it("Tailwind theme resets the default theme and defines dark + high-contrast overrides", () => {
    const css = read("dist/tailwind/theme.css");
    expect(css).toContain("--*: initial;");
    expect(css).toContain("--color-canvas: #f7f6f2;");
    expect(css).toMatch(/\[data-theme="dark"\] \{[^}]*--color-canvas: #0a0a0b;/);
    expect(css).toContain("@media (prefers-contrast: more)");
    expect(css).toContain("--spacing-0_5: 0.125rem;");
    expect(css).toContain("--container-creator: 35rem;");
  });

  it("CSS variables mirror the Tailwind theme", () => {
    const css = read("dist/css/tokens.css");
    expect(css).toContain("--color-primary: #9500e9;");
    expect(css).toContain("--font-sans: var(--font-face-geist, Geist), var(--font-face-plex-arabic, \"IBM Plex Sans Arabic\")");
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
