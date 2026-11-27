import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { tokens } from "../src/generated/tokens";

/**
 * The `print` group (the application's PDFs, apps/web/src/features/documents): lengths in
 * millimetres, type in points. TypeScript only: no CSS, Tailwind or Swift.
 */
describe("print tokens", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const read = (file: string): string => readFileSync(path.join(root, file), "utf8");
  const { print } = tokens;

  it("hold the A4 sheet, its type area and grid", () => {
    expect([print.page.width, print.page.height]).toEqual([210, 297]);
    expect(print.page.width - print.margin.start - print.margin.end).toBe(165);
    const column = (165 - (print.grid.columns - 1) * print.grid.gutter) / print.grid.columns;
    expect(column).toBeCloseTo(10.083, 3);
  });

  it("hold DIN 5008 Form B's measures", () => {
    expect([print.din.addressX, print.din.addressY, print.din.addressWidth, print.din.addressHeight]).toEqual([20, 45, 85, 45]);
    expect([print.din.infoX, print.din.infoTop]).toEqual([125, 50]);
    expect(print.din.infoX + print.din.infoWidth).toBe(print.page.width - print.margin.end);
    expect([print.din.foldTop, print.din.punch, print.din.foldBottom]).toEqual([105, 148.5, 210]);
    expect(print.din.subjectTop).toBe(98.46);
    expect(print.din.signature).toBeCloseTo(3 * print.din.line, 1);
  });

  it("give every type style a face, a size, a leading, a tracking and a tone", () => {
    const names = Object.keys(print.type);
    expect(names).toEqual(
      expect.arrayContaining(["name", "nameMin", "letterName", "role", "status", "contactLabel", "contactValue", "figure", "section", "body", "label", "value", "years", "entryTitle", "entry", "skill", "letterBody", "letterBodyMin", "letterSubject", "info", "enclosure", "footer"]),
    );
    for (const style of Object.values(print.type)) {
      expect(["regular", "semibold", "bold"]).toContain(style.face);
      expect(["ink", "muted", "accent"]).toContain(style.tone);
      expect(style.size).toBeGreaterThan(0);
      expect(style.leading).toBeGreaterThanOrEqual(style.size);
    }
  });

  it("stay out of CSS, Tailwind and Swift", () => {
    expect(read("dist/css/tokens.css")).not.toMatch(/--[a-z-]*print/u);
    expect(read("dist/tailwind/theme.css")).not.toMatch(/--[a-z-]*print/u);
    const swift = readFileSync(path.resolve(root, "../../apps/ios/Packages/LinkyoDesignSystem/Sources/LinkyoDesignSystem/Generated/DesignTokens.swift"), "utf8");
    expect(swift).not.toMatch(/print|letterBody|contactBar/u);
  });
});
