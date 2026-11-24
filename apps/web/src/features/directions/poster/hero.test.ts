import { describe, expect, it } from "vitest";

import { GLYPH_WIDTH, nameEms } from "./hero";

// Audit C-04: the name is sized from this estimate so that it fits on its line. Breaking the word
// (`overflow-wrap: anywhere`) is only the last resort, so the estimate itself must be right.
describe("nameEms", () => {
  it("counts a Latin name on an Arabic page by letter class, wide enough for wide letters", () => {
    // The old estimate (14 × the Arabic average, 6.58 em) set this name so large that it broke mid-word.
    expect(nameEms("Wenzeslawowicz", "arabic", true)).toBeGreaterThanOrEqual(9);
    expect(nameEms("Wenzeslawowicz", "arabic", true)).toBeGreaterThan(14 * (GLYPH_WIDTH.arabic ?? 0));
    // Wide letters weigh more than slim ones.
    expect(nameEms("mmmm", "arabic", true)).toBeGreaterThan(nameEms("iiii", "arabic", true));
    expect(nameEms("MW", "arabic", true)).toBeGreaterThan(nameEms("AB", "arabic", true));
  });

  it("keeps the Arabic average for Arabic letters and spaces", () => {
    const name = "عبدالكريم الزين";
    expect(nameEms(name, "arabic", true)).toBeCloseTo(Array.from(name).length * (GLYPH_WIDTH.arabic ?? 0), 6);
  });

  it("counts a mixed name per character", () => {
    expect(nameEms("Lio عبد", "arabic", true)).toBeCloseTo(nameEms("Lio", "arabic", true) + nameEms(" عبد", "arabic", true), 6);
  });

  it("leaves Latin pages as they were: the face's average per character", () => {
    expect(nameEms("Wenzeslawowicz", "classic", false)).toBeCloseTo(14 * (GLYPH_WIDTH.classic ?? 0), 6);
    expect(nameEms("Wenzeslawowicz", "stage", false)).toBeCloseTo(14 * (GLYPH_WIDTH.stage ?? 0), 6);
    expect(nameEms("Ana", "unknown-pairing", false)).toBeCloseTo(3 * (GLYPH_WIDTH.classic ?? 0), 6);
  });
});
