import { describe, expect, it } from "vitest";

import { hexToOklch, parseHex } from "../src/creator/color";
import { extractSeed } from "../src/creator/extract";

function image(parts: [hex: string, share: number][], size = 4096): Uint8ClampedArray {
  const data = new Uint8ClampedArray(size * 4);
  let offset = 0;
  for (const [hex, share] of parts) {
    const { r, g, b } = parseHex(hex);
    const count = Math.round(size * share);
    for (let i = 0; i < count && offset < data.length; i++, offset += 4) {
      data.set([r * 255, g * 255, b * 255, 255], offset);
    }
  }
  return data;
}

describe("extractSeed", () => {
  it("finds dominant and vibrant colors and suggests a mode", () => {
    const seed = extractSeed(image([["#14182B", 0.7], ["#F2542D", 0.2], ["#C9C2B8", 0.1]]));
    expect(hexToOklch(seed.dominant).l).toBeLessThan(0.3);
    expect(Math.abs(hexToOklch(seed.vibrant).h - hexToOklch("#F2542D").h)).toBeLessThan(10);
    expect(seed.mode).toBe("dark");
  });

  it("suggests light pages for bright photos", () => {
    expect(extractSeed(image([["#F4EFE6", 0.8], ["#3B7D5C", 0.2]])).mode).toBe("light");
  });

  it("ignores transparent pixels and survives empty input", () => {
    expect(extractSeed(new Uint8ClampedArray(16)).dominant).toBe("#808080");
  });
});
