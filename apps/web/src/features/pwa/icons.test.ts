import { readFileSync } from "node:fs";
import path from "node:path";

import { tokens } from "@linkyo/tokens";
import { describe, expect, it } from "vitest";

import { decodePng, pngSize, type Png } from "./png";

/**
 * The installed app's icons (scripts/generate-app-icons.mjs): each at the size the manifest names, the
 * "any" icons the symbol as it is (rounded tile, clear corners), the maskable icon teal to its edges
 * with the y inside the 80 % safe circle (measured on its pixels), and the monochrome icon the y alone.
 */
const PUBLIC = path.resolve(import.meta.dirname, "../../../public");
const read = (file: string) => readFileSync(path.join(PUBLIC, file));

const hex = (value: string) => [1, 3, 5].map((at) => Number.parseInt(value.slice(at, at + 2), 16));
const TEAL = hex(tokens.color.teal["700"]);

const pixel = (png: Png, x: number, y: number) => Array.from(png.pixels.subarray((y * png.width + x) * png.channels, (y * png.width + x + 1) * png.channels));
const alpha = (png: Png, x: number, y: number) => (png.channels === 4 ? (pixel(png, x, y)[3] ?? 0) : 255);
const near = (a: readonly number[], b: readonly number[], tolerance = 3) => b.every((value, at) => Math.abs((a[at] ?? 0) - value) <= tolerance);

/** The farthest pixel from the centre (in pixels) that passes `inShape`, and how many pass. */
function reach(png: Png, inShape: (x: number, y: number) => boolean): { radius: number; count: number } {
  const centre = (png.width - 1) / 2;
  let radius = 0;
  let count = 0;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (!inShape(x, y)) continue;
      count += 1;
      radius = Math.max(radius, Math.hypot(x - centre, y - centre));
    }
  }
  return { radius, count };
}

describe("app icons", () => {
  it.each([
    ["icons/icon-192.png", 192],
    ["icons/icon-512.png", 512],
    ["icons/maskable-512.png", 512],
    ["icons/monochrome-512.png", 512],
  ])("%s is %i × %i", (file, size) => {
    expect(pngSize(read(file))).toEqual({ width: size, height: size });
  });

  it.each(["icons/icon-192.png", "icons/icon-512.png"])("%s is the rounded tile: clear corners, teal inside", (file) => {
    const png = decodePng(read(file));
    const last = png.width - 1;
    for (const [x, y] of [[0, 0], [last, 0], [0, last], [last, last]] as const) expect(alpha(png, x, y)).toBe(0);
    // Just inside the tile's edge, half way along a side: teal, fully opaque.
    expect(near(pixel(png, Math.round(png.width / 2), Math.round(png.width * 0.03)), [...TEAL, 255])).toBe(true);
  });

  it("the maskable icon is teal to its edges and keeps the y inside the 80 % safe circle", () => {
    const png = decodePng(read("icons/maskable-512.png"));
    const last = png.width - 1;
    for (const [x, y] of [[0, 0], [last, 0], [0, last], [last, last], [256, 0], [0, 256]] as const) expect(near(pixel(png, x, y), [...TEAL, 255])).toBe(true);
    // Every pixel that is not the teal ground belongs to the y (its white and its anti-aliased edge).
    const glyph = reach(png, (x, y) => !near(pixel(png, x, y), [...TEAL, 255], 8));
    expect(glyph.count).toBeGreaterThan(png.width * png.height * 0.08);
    expect(glyph.radius).toBeLessThanOrEqual(png.width * 0.4);
  });

  it("the monochrome icon is the y alone, on a clear ground, inside the same safe circle", () => {
    const png = decodePng(read("icons/monochrome-512.png"));
    expect(png.channels).toBe(4);
    expect(alpha(png, 0, 0)).toBe(0);
    const shape = reach(png, (x, y) => alpha(png, x, y) > 0);
    expect(shape.count).toBeGreaterThan(png.width * png.height * 0.08);
    expect(shape.radius).toBeLessThanOrEqual(png.width * 0.4);
  });
});
