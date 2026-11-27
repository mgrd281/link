import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { layoutKind } from "./build";
import { jonasDe, longEmail } from "./fixtures";
import { documentInput } from "./input";
import { paperLabels } from "./labels";
import { PaperMiniature } from "./miniature";
import { miniatureOf } from "./miniature-marks";
import type { MiniatureMark } from "./offer";
import { loadFonts } from "./pdf/fonts";

const NOW = new Date("2026-11-26T10:00:00Z");
const { metrics } = await loadFonts();
const marks = (page = jonasDe(), kind: "cv" | "letter" = "cv"): MiniatureMark[] => {
  const [document] = layoutKind(kind, documentInput(page, { now: NOW }), { metrics, labels: paperLabels("de"), now: NOW, asOf: null, photo: false });
  return document ? miniatureOf(document) : [];
};

describe("the paper miniature", () => {
  it("holds numbers and tones only, on the A4 sheet in tenths of a millimetre", () => {
    for (const kind of ["cv", "letter"] as const) {
      const all = marks(jonasDe(), kind);
      expect(all.length).toBeGreaterThan(20);
      for (const mark of all) {
        expect(Object.keys(mark).sort()).toEqual(["h", "tone", "w", "x", "y"]);
        expect(["ink", "accent", "strong", "muted"]).toContain(mark.tone);
        for (const value of [mark.x, mark.y, mark.w, mark.h]) {
          expect(typeof value).toBe("number");
          expect(Math.round(value * 10) / 10).toBe(value);
        }
        expect(mark.x).toBeGreaterThanOrEqual(0);
        expect(mark.x + mark.w).toBeLessThanOrEqual(210);
        expect(mark.y + mark.h).toBeLessThanOrEqual(297);
      }
    }
  });

  it("draws contact values at one fixed width, one bar a row, whatever their length", () => {
    const short = marks(jonasDe());
    const longer = marks(longEmail());
    // An address never wraps, so each contact row is one bar of the same width: neither their width
    // nor their number reveals how long an address is.
    const bars = (all: MiniatureMark[]) => all.filter((mark) => mark.w === 28);
    expect(new Set(bars(short).map((mark) => mark.w))).toEqual(new Set([28]));
    expect(new Set(bars(longer).map((mark) => mark.w))).toEqual(new Set([28]));
    // The sample's phone and e-mail: two rows, two bars, for the short address and the 50-character one.
    expect(bars(short)).toHaveLength(2);
    expect(bars(longer)).toHaveLength(2);
    // In the letter's information block too.
    expect(bars(marks(jonasDe(), "letter"))).toHaveLength(2);
    expect(bars(marks(longEmail(), "letter"))).toHaveLength(2);
  });

  it("puts the accent rule and the title marks in the accent", () => {
    expect(marks().filter((mark) => mark.tone === "accent").length).toBeGreaterThan(10);
  });

  it("renders as a small decorative SVG", () => {
    const html = renderToStaticMarkup(createElement(PaperMiniature, { marks: marks() }));
    expect(html.startsWith('<svg viewBox="0 0 210 297" aria-hidden="true"')).toBe(true);
    expect(html).not.toMatch(/Jonas|example\.com|\+49/u);
    expect(html.length).toBeLessThanOrEqual(4 * 1024);
    expect(renderToStaticMarkup(createElement(PaperMiniature, { marks: null }))).toBe(
      '<svg viewBox="0 0 210 297" aria-hidden="true" focusable="false" class="block"><rect width="210" height="297" class="fill-white"></rect></svg>',
    );
  });
});
