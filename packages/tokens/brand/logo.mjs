/**
 * Generates the Linkyo logo from geometry (brand §3): reproducible, no hand-edited SVG.
 *
 * Symbol "the Linkyo y" (ADR 0039): a Linkyo Teal tile (squircle) with a y cut out of it. The long
 * arm ends in a soft hook; the short arm stops just short of it, the link point where two paths
 * meet. Wordmark: "linkyo", Geist SemiBold, tracking +0.5 %.
 *
 * Outputs (committed):
 *   brand/svg/*.svg                       symbol, wordmark, lockups, app icons, favicon
 *   ../../apps/web/public/favicon.svg     the browser icon (also drawn on link preview cards)
 *   ../../apps/web/public/logo-on-teal.svg  white tile, teal y: for teal surfaces in pictures
 *   ../ui/src/brand/logo-geometry.ts      path data for the React components
 *   apps/ios/.../Generated/LinkyoSymbol.swift  the native SwiftUI symbol
 * The iOS app icon PNGs are rendered from brand/svg/app-icon-*.svg (brand/render-icons.mjs).
 *
 * Run: pnpm --filter @linkyo/tokens brand
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import opentype from "opentype.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_SVG = path.join(HERE, "svg");
const OUT_TS = path.resolve(HERE, "../../ui/src/brand/logo-geometry.ts");
const WEB_PUBLIC = path.resolve(HERE, "../../../apps/web/public");
const tokens = JSON.parse((await import("node:fs")).readFileSync(path.join(HERE, "../tokens.json"), "utf8"));
const C = (p) => p.split(".").reduce((n, k) => n[k], tokens.color).$value;

// ── Symbol geometry (32 × 32 grid) ────────────────────────────────────────────────────────────
/** The tile: a squircle (continuous corners, like an app icon). */
const TILE = "M16 0C27.6 0 32 4.4 32 16S27.6 32 16 32 0 27.6 0 16 4.4 0 16 0Z";
const STROKE = 3.9;
/** Space kept clear around the short arm where it meets the long one (the link point). */
const GAP = 1.2;
/** The long arm: down from the top right, ending in a soft hook. */
const LONG = { start: [22.6, 8.2], line: [16.6, 20], curve: [[15, 23.2], [13, 25], [10.2, 25]] };
/** The short arm: down from the top left, stopping just before the long arm. */
const SHORT = { start: [9.4, 8.2], end: [15.3, 16.9] };
const pt = ([x, y]) => `${x} ${y}`;
const longD = `M${pt(LONG.start)}L${pt(LONG.line)}C${LONG.curve.map(pt).join(" ")}`;
const shortD = `M${pt(SHORT.start)}L${pt(SHORT.end)}`;

const f = (n) => +n.toFixed(3);
const symbol = { viewBox: "0 0 32 32", tile: TILE, long: longD, short: shortD, stroke: STROKE, gap: GAP };

/** The y as strokes on a transparent ground (for app icons and the white-tile variant). */
const glyph = (color, under) =>
  `<path d="${longD}" fill="none" stroke="${color}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${shortD}" fill="none" stroke="${under}" stroke-width="${STROKE + GAP * 2}" stroke-linecap="round"/>` +
  `<path d="${shortD}" fill="none" stroke="${color}" stroke-width="${STROKE}" stroke-linecap="round"/>`;
/** The full symbol in two colors: the tile and the y on it. */
const tileMarkup = (tileColor, glyphColor) => `<path d="${TILE}" fill="${tileColor}"/>${glyph(glyphColor, tileColor)}`;

// ── Wordmark ──────────────────────────────────────────────────────────────────────────────────
const fontFile = path.join(HERE, "../node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf");
const font = opentype.loadSync(fontFile);
const SIZE = 100;
const TRACKING = 0.005 * SIZE;
let x = 0;
const glyphs = font.stringToGlyphs("linkyo");
const wordPath = new opentype.Path();
glyphs.forEach((glyph, i) => {
  wordPath.extend(glyph.getPath(x, 0, SIZE));
  const kern = i < glyphs.length - 1 ? font.getKerningValue(glyph, glyphs[i + 1]) : 0;
  x += ((glyph.advanceWidth + kern) / font.unitsPerEm) * SIZE + TRACKING;
});
const bb = wordPath.getBoundingBox();
const xHeight = (font.tables.os2.sxHeight / font.unitsPerEm) * SIZE;
const wordmark = {
  viewBox: `${f(bb.x1)} ${f(bb.y1)} ${f(bb.x2 - bb.x1)} ${f(bb.y2 - bb.y1)}`,
  d: wordPath.toPathData(2),
  width: f(bb.x2 - bb.x1),
  height: f(bb.y2 - bb.y1),
  /** Height of the "o" (x-height) — the clear-space unit. */
  xHeight: f(xHeight),
  baseline: f(-bb.y1),
};

// ── SVG files ─────────────────────────────────────────────────────────────────────────────────
const svg = (viewBox, body, extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${extra}>${body}</svg>\n`;

mkdirSync(OUT_SVG, { recursive: true });
const write = (name, content) => writeFileSync(path.join(OUT_SVG, name), content);
const ink = C("ink");
const paper = C("paper");
const white = C("white");
// Linkyo Teal: the tile, and the light step that stays readable on dark surfaces.
const teal700 = C("teal.700");
const teal350 = C("teal.350");

write("symbol.svg", svg(symbol.viewBox, tileMarkup(teal700, white)));
write("wordmark.svg", svg(wordmark.viewBox, `<path d="${wordmark.d}" fill="${ink}"/>`));

// Horizontal lockup: the tile a little taller than the word (ascender to descender), centred on it.
const tileH = wordmark.height * 1.18;
const gapH = tileH * 0.26;
const hW = tileH + gapH + wordmark.width;
const wordY = (tileH - wordmark.height) / 2;
write(
  "lockup-horizontal.svg",
  svg(
    `0 0 ${f(hW)} ${f(tileH)}`,
    `<svg x="0" y="0" width="${f(tileH)}" height="${f(tileH)}" viewBox="0 0 32 32">${tileMarkup(teal700, white)}</svg><svg x="${f(tileH + gapH)}" y="${f(wordY)}" width="${wordmark.width}" height="${wordmark.height}" viewBox="${wordmark.viewBox}"><path d="${wordmark.d}" fill="${ink}"/></svg>`,
  ),
);
const sS = wordmark.width * 0.42;
write(
  "lockup-stacked.svg",
  svg(
    `0 0 ${f(wordmark.width)} ${f(sS + wordmark.xHeight * 0.6 + wordmark.height)}`,
    `<svg x="${f((wordmark.width - sS) / 2)}" y="0" width="${f(sS)}" height="${f(sS)}" viewBox="0 0 32 32">${tileMarkup(teal700, white)}</svg><svg x="0" y="${f(sS + wordmark.xHeight * 0.6)}" width="${wordmark.width}" height="${wordmark.height}" viewBox="${wordmark.viewBox}"><path d="${wordmark.d}" fill="${ink}"/></svg>`,
  ),
);

// App icons (iOS appearances: light, dark, tinted). Full-bleed: the system rounds the corners. The y
// takes 56 % of the height, centred on its own box.
const GLYPH_BOX = { cx: 16, cy: 16.6, h: 20.7 };
const iconScale = (1024 * 0.56) / GLYPH_BOX.h;
const iconGlyph = (color, ground) =>
  `<g transform="translate(512 512) scale(${f(iconScale)}) translate(${-GLYPH_BOX.cx} ${-GLYPH_BOX.cy})">${glyph(color, ground)}</g>`;
const icon = (ground, color) => svg("0 0 1024 1024", `<path d="M0 0h1024v1024H0z" fill="${ground}"/>${iconGlyph(color, ground)}`);
write("app-icon-light.svg", icon(teal700, white));
write("app-icon-dark.svg", icon(ink, teal350));
write("app-icon-tinted.svg", icon("#000", "#fff"));

// Browser icon: the tile as it is. Also the picture used on link preview cards.
const favicon = svg("0 0 32 32", tileMarkup(teal700, white));
write("favicon.svg", favicon);
writeFileSync(path.join(WEB_PUBLIC, "favicon.svg"), favicon);
// White tile with a teal y, for teal surfaces in generated pictures (share cards).
writeFileSync(path.join(WEB_PUBLIC, "logo-on-teal.svg"), svg("0 0 32 32", tileMarkup(white, teal700)));
void paper;

// Lockup geometry for single-SVG rendering (React): tile scaled to tileH, the word beside it.
const lockup = {
  viewBox: `0 0 ${f(hW)} ${f(tileH)}`,
  symbolTransform: `scale(${f(tileH / 32)})`,
  wordmarkTransform: `translate(${f(tileH + gapH - bb.x1)} ${f(wordY - bb.y1)})`,
};

// ── TS geometry for React ─────────────────────────────────────────────────────────────────────
mkdirSync(path.dirname(OUT_TS), { recursive: true });
writeFileSync(
  OUT_TS,
  `// Generated by packages/tokens/brand/logo.mjs — do not edit by hand.
export const symbolGeometry = ${JSON.stringify(symbol, null, 2)} as const;

export const wordmarkGeometry = ${JSON.stringify(wordmark, null, 2)} as const;

export const lockupGeometry = ${JSON.stringify(lockup, null, 2)} as const;
`,
);

// ── Swift (native SwiftUI symbol) ─────────────────────────────────────────────────────────────
const IOS_GENERATED = path.resolve(HERE, "../../../apps/ios/Packages/LinkyoDesignSystem/Sources/LinkyoDesignSystem/Generated");
const sw = (n) => (Number.isInteger(n) ? `${n}.0` : `${+n.toFixed(4)}`);
const P = ([x, y]) => `CGPoint(x: ${sw(x)}, y: ${sw(y)})`;
mkdirSync(IOS_GENERATED, { recursive: true });
rmSync(path.join(IOS_GENERATED, "LoopSymbol.swift"), { force: true });
writeFileSync(
  path.join(IOS_GENERATED, "LinkyoSymbol.swift"),
  `// Generated by packages/tokens/brand/logo.mjs — do not edit by hand.
// swiftlint:disable all

import SwiftUI

/// "The Linkyo y": a tile in the foreground style with a y cut out of it. The long arm ends in a soft
/// hook; the short arm stops just short of it (the link point). Drawn natively, follows \`foregroundStyle\`.
public struct LinkyoSymbol: View {
    public init() {}

    static let stroke: CGFloat = ${sw(STROKE)}
    static let gap: CGFloat = ${sw(GAP)}

    /// The squircle tile on a 32 × 32 grid.
    static let tile: Path = Path { path in
        path.move(to: ${P([16, 0])})
        path.addCurve(to: ${P([32, 16])}, control1: ${P([27.6, 0])}, control2: ${P([32, 4.4])})
        path.addCurve(to: ${P([16, 32])}, control1: ${P([32, 27.6])}, control2: ${P([27.6, 32])})
        path.addCurve(to: ${P([0, 16])}, control1: ${P([4.4, 32])}, control2: ${P([0, 27.6])})
        path.addCurve(to: ${P([16, 0])}, control1: ${P([0, 4.4])}, control2: ${P([4.4, 0])})
        path.closeSubpath()
    }

    static let long: Path = Path { path in
        path.move(to: ${P(LONG.start)})
        path.addLine(to: ${P(LONG.line)})
        path.addCurve(to: ${P(LONG.curve[2])}, control1: ${P(LONG.curve[0])}, control2: ${P(LONG.curve[1])})
    }

    static let short: Path = Path { path in
        path.move(to: ${P(SHORT.start)})
        path.addLine(to: ${P(SHORT.end)})
    }

    public var body: some View {
        Canvas { context, size in
            let scale = min(size.width, size.height) / 32
            context.translateBy(x: (size.width - 32 * scale) / 2, y: (size.height - 32 * scale) / 2)
            context.scaleBy(x: scale, y: scale)
            context.drawLayer { layer in
                let line = StrokeStyle(lineWidth: Self.stroke, lineCap: .round, lineJoin: .round)
                layer.fill(Self.tile, with: .foreground)
                layer.blendMode = .destinationOut
                layer.stroke(Self.long, with: .color(.black), style: line)
                // Keep the tile around the short arm: the link point between the two arms.
                layer.blendMode = .normal
                layer.stroke(Self.short, with: .foreground, style: StrokeStyle(lineWidth: Self.stroke + Self.gap * 2, lineCap: .round))
                layer.blendMode = .destinationOut
                layer.stroke(Self.short, with: .color(.black), style: line)
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityHidden(true)
    }
}
`,
);

console.warn(`✔ logo: symbol (tile + y), wordmark ${wordmark.width}×${wordmark.height}`);
