import { describe, expect, it } from "vitest";

import { drawnUnicode } from "../layout/measure";
import { loadFonts } from "../pdf/fonts";

import { FIRST_CODE, LAST_CODE, SOFT_HYPHEN_CODE, unicodeOf, winAnsiCode } from "./winansi";

const DIGITS = "0123456789";

describe("Geist as the documents read it", async () => {
  const { fonts, metrics } = await loadFonts();

  it("has 1000 units to the em, allows embedding and names itself", () => {
    for (const face of ["regular", "semibold", "bold"] as const) {
      expect(fonts[face].unitsPerEm, face).toBe(1000);
      expect(fonts[face].fsType, face).toBe(0);
      expect(fonts[face].capHeight, face).toBeGreaterThan(600);
      expect(metrics[face].capHeight, face).toBeCloseTo(fonts[face].capHeight / 1000, 6);
    }
    expect([fonts.regular.postScriptName, fonts.semibold.postScriptName, fonts.bold.postScriptName]).toEqual(["Geist-Regular", "Geist-SemiBold", "Geist-Bold"]);
    expect([fonts.regular.weightClass, fonts.semibold.weightClass, fonts.bold.weightClass]).toEqual([400, 600, 700]);
  });

  it("reads the advances from cmap and hmtx: digits, space and en dash", () => {
    const advances = (face: "regular" | "semibold" | "bold") => Array.from(DIGITS, (digit) => metrics[face].widths[digit.charCodeAt(0)]);
    expect(advances("regular")).toEqual([663, 384, 619, 613, 615, 626, 593, 524, 604, 593]);
    expect(advances("semibold")).toEqual([683, 427, 642, 637, 643, 656, 615, 538, 644, 618]);
    expect(advances("bold")).toEqual([693, 449, 653, 650, 656, 671, 627, 544, 664, 631]);
    expect([metrics.regular.widths[0x20], metrics.semibold.widths[0x20], metrics.bold.widths[0x20]]).toEqual([250, 236, 228]);
    expect([metrics.regular.widths[0x96], metrics.semibold.widths[0x96], metrics.bold.widths[0x96]]).toEqual([591, 594, 595]);
  });

  it("covers every WinAnsi character but the soft hyphen", () => {
    for (const face of ["regular", "semibold", "bold"] as const) {
      for (let code = FIRST_CODE; code <= LAST_CODE; code += 1) {
        const unicode = unicodeOf(code);
        if (unicode === null || code === SOFT_HYPHEN_CODE) continue;
        expect(fonts[face].glyphOf(unicode), `${face} ${code.toString(16)}`).toBeGreaterThan(0);
      }
    }
    // The no-break space is drawn as the space glyph (PDF's WinAnsi), so it measures like one.
    expect(drawnUnicode(0xa0)).toBe(0x20);
    expect(metrics.regular.widths[0xa0]).toBe(metrics.regular.widths[0x20]);
  });
});

describe("WinAnsi", () => {
  it("maps the typographer's characters to their codes and back", () => {
    const pairs: [string, number][] = [
      ["€", 0x80],
      ["„", 0x84],
      ["“", 0x93],
      ["”", 0x94],
      ["–", 0x96],
      ["—", 0x97],
      ["ä", 0xe4],
      ["Ö", 0xd6],
      ["ß", 0xdf],
    ];
    for (const [char, code] of pairs) {
      expect(winAnsiCode(char), char).toBe(code);
      expect(unicodeOf(code), char).toBe(char.codePointAt(0));
    }
    expect(winAnsiCode("Ł")).toBeNull();
    expect([0x81, 0x8d, 0x8f, 0x90, 0x9d, 0x7f].map(unicodeOf)).toEqual([null, null, null, null, null, null]);
  });
});
