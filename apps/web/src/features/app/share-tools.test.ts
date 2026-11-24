import { contrastRatio, PRESET_IDS, TEMPLATE_IDS, toHex } from "@linkyo/tokens/creator";
import { describe, expect, it } from "vitest";

import { pageAddress, pageUrl, qrPageUrl } from "@/lib/page-url";

import { qrInk, qrModules, qrSvg } from "./share-tools";

/**
 * D-16: the QR code downloads as a vector file in the page's accent colour, and that colour still
 * scans on white paper.
 */

const WHITE = toHex({ r: 255, g: 255, b: 255 });

describe("what a page's QR code holds", () => {
  it("the page's address marked as a scan, so the statistics count it as 'QR-Code'; people read the plain address", () => {
    const code = qrPageUrl("mila");
    expect(code).toBe(`${pageUrl("mila")}?src=qr`);
    // The beacon reads exactly this marker (beacon-script.ts: `get("src") === "qr"`).
    expect(new URL(code).searchParams.get("src")).toBe("qr");
    expect(pageAddress("mila")).not.toContain("src=");
    expect(qrModules(code).size).toBeGreaterThan(0);
  });
});

describe("the QR code as SVG", () => {
  const value = "https://linkyo.app/mila";

  it("draws the same modules as the code on screen, in the colours it is given", () => {
    const { size, path } = qrModules(value);
    const svg = qrSvg({ value, title: "QR-Code für linkyo.app/mila", color: "rgb(1, 2, 3)", background: "rgb(255, 255, 255)" });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain(`viewBox="0 0 ${String(size)} ${String(size)}"`);
    expect(svg).toContain(`<path d="${path}" fill="rgb(1, 2, 3)"/>`);
    expect(svg).toContain('fill="rgb(255, 255, 255)"');
    expect(svg).toContain("<title>QR-Code für linkyo.app/mila</title>");
    // Printed about 1024 px wide when placed without a size.
    const width = Number(/width="(\d+)"/.exec(svg)?.[1]);
    expect(width).toBeGreaterThan(900);
    expect(width).toBeLessThanOrEqual(1024);
  });

  it("keeps the quiet zone of four modules around the code (ISO/IEC 18004)", () => {
    const { size, path } = qrModules(value);
    const cells = [...path.matchAll(/M(\d+) (\d+)/g)].map(([, x, y]) => [Number(x), Number(y)] as const);
    expect(cells.length).toBeGreaterThan(0);
    for (const [x, y] of cells) {
      expect(x).toBeGreaterThanOrEqual(4);
      expect(y).toBeGreaterThanOrEqual(4);
      expect(x).toBeLessThan(size - 4);
      expect(y).toBeLessThan(size - 4);
    }
  });

  it("escapes what it writes into the file", () => {
    const svg = qrSvg({ value, title: 'a "b" <c> & d', color: "red", background: "white" });
    expect(svg).toContain("<title>a &#34;b&#34; &#60;c&#62; &#38; d</title>");
  });
});

describe("the colour a page's QR code is printed in", () => {
  it("keeps at least 4.5:1 against white for every template and preset, light, dark and vivid", () => {
    const looks = [
      ...TEMPLATE_IDS.map((template) => ({ template })),
      ...PRESET_IDS.flatMap((preset) => (["light", "dark", "vivid"] as const).map((mode) => ({ preset, mode }))),
    ];
    for (const look of looks) expect(contrastRatio(qrInk(look), WHITE), JSON.stringify(look)).toBeGreaterThanOrEqual(4.5);
  });

  it("darkens a pale accent instead of printing a code that does not scan", () => {
    const pale = toHex({ r: 255, g: 230, b: 120 });
    expect(contrastRatio(pale, WHITE)).toBeLessThan(2);
    expect(contrastRatio(qrInk({ accent: pale, mode: "light" }), WHITE)).toBeGreaterThanOrEqual(4.5);
  });
});
