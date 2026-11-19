/**
 * Generates the Linkyo logo from geometry (brand §3) — reproducible, no hand-edited SVG.
 *
 * Symbol "the Loop": two rounded-rectangle chain links that interlock (over/under weave) and
 * together draw an abstract lowercase "y". Wordmark: "linkyo", Geist Bold, tracking −2 %.
 *
 * Outputs (committed):
 *   brand/svg/*.svg                       symbol, wordmark, lockups, app icons, favicon
 *   ../ui/src/brand/logo-geometry.ts      path data for the React components
 *
 * Run: pnpm --filter @linkyo/tokens brand
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import opentype from "opentype.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_SVG = path.join(HERE, "svg");
const OUT_TS = path.resolve(HERE, "../../ui/src/brand/logo-geometry.ts");
const tokens = JSON.parse((await import("node:fs")).readFileSync(path.join(HERE, "../tokens.json"), "utf8"));
const C = (p) => p.split(".").reduce((n, k) => n[k], tokens.color).$value;

// ── Symbol geometry (32 × 32 grid) ────────────────────────────────────────────────────────────
const STROKE = 4;
const GAP = 1.5; // weave gap on each side of the over-link
const LONG = { cx: 18.6, cy: 17.8, w: 26, h: 11.5, r: 5.75, rot: -66 };
const SHORT = { cx: 11.4, cy: 12.0, w: 14, h: 11.5, r: 5.75, rot: 66 };

const f = (n) => +n.toFixed(3);
function rotate([x, y], link) {
  const t = (link.rot * Math.PI) / 180;
  return [link.cx + x * Math.cos(t) - y * Math.sin(t), link.cy + x * Math.sin(t) + y * Math.cos(t)];
}

/** Rounded-rect outline of `link` offset by `o` (centerline ± o), as an SVG path (clockwise). */
function outline(link, o) {
  const hw = link.w / 2 + o;
  const hh = link.h / 2 + o;
  const r = Math.max(0.01, Math.min(link.r + o, hw, hh));
  const P = (x, y) => rotate([x, y], link).map(f).join(" ");
  return [
    `M${P(-hw + r, -hh)}`,
    `L${P(hw - r, -hh)}`,
    `A${f(r)} ${f(r)} 0 0 1 ${P(hw, -hh + r)}`,
    `L${P(hw, hh - r)}`,
    `A${f(r)} ${f(r)} 0 0 1 ${P(hw - r, hh)}`,
    `L${P(-hw + r, hh)}`,
    `A${f(r)} ${f(r)} 0 0 1 ${P(-hw, hh - r)}`,
    `L${P(-hw, -hh + r)}`,
    `A${f(r)} ${f(r)} 0 0 1 ${P(-hw + r, -hh)}`,
    "Z",
  ].join("");
}
/** A ring (filled, evenodd): band of width `width` around the centerline. */
const ring = (link, width) => outline(link, width / 2) + outline(link, -width / 2);
const circle = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;

function centerline(link, n = 30) {
  const hw = link.w / 2;
  const hh = link.h / 2;
  const r = link.r;
  const corners = [
    [hw - r, -hh + r, -90],
    [hw - r, hh - r, 0],
    [-hw + r, hh - r, 90],
    [-hw + r, -hh + r, 180],
  ];
  const pts = corners.flatMap(([x, y, a0]) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = ((a0 + (90 * i) / n) * Math.PI) / 180;
      return rotate([x + r * Math.cos(a), y + r * Math.sin(a)], link);
    }),
  );
  return [...pts, pts[0]];
}
function crossings(a, b) {
  const out = [];
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < b.length - 1; j++) {
      const [p1, p2, p3, p4] = [a[i], a[i + 1], b[j], b[j + 1]];
      const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
      if (Math.abs(d) < 1e-12) continue;
      const ua = ((p4[0] - p3[0]) * (p1[1] - p3[1]) - (p4[1] - p3[1]) * (p1[0] - p3[0])) / d;
      const ub = ((p2[0] - p1[0]) * (p1[1] - p3[1]) - (p2[1] - p1[1]) * (p1[0] - p3[0])) / d;
      if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) out.push({ x: p1[0] + ua * (p2[0] - p1[0]), y: p1[1] + ua * (p2[1] - p1[1]), i });
    }
  }
  return out.filter((p, k) => out.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.5) === k).sort((p, q) => p.i - q.i);
}

const xs = crossings(centerline(SHORT), centerline(LONG));
if (xs.length !== 2) throw new Error(`Expected 2 crossings, got ${xs.length}`);
// Crossing 0: short link over long link. Crossing 1: long link over short link.
const symbol = {
  viewBox: "0 0 32 32",
  long: ring(LONG, STROKE),
  short: ring(SHORT, STROKE),
  /** Cut from the long link where the short link passes over it. */
  longCut: { area: circle(xs[0].x, xs[0].y, STROKE * 1.25), band: ring(SHORT, STROKE + GAP * 2) },
  /** Cut from the short link where the long link passes over it. */
  shortCut: { area: circle(xs[1].x, xs[1].y, STROKE * 1.25), band: ring(LONG, STROKE + GAP * 2) },
};

// ── Wordmark ──────────────────────────────────────────────────────────────────────────────────
const fontFile = path.join(HERE, "../node_modules/geist/dist/fonts/geist-sans/Geist-Bold.ttf");
const font = opentype.loadSync(fontFile);
const SIZE = 100;
const TRACKING = -0.02 * SIZE;
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
function symbolMarkup(id, color = "currentColor") {
  return `<defs><mask id="${id}-l" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32"><path d="M0 0h32v32H0z" fill="#fff"/><clipPath id="${id}-la"><path d="${symbol.longCut.area}"/></clipPath><path d="${symbol.longCut.band}" fill-rule="evenodd" clip-path="url(#${id}-la)"/></mask><mask id="${id}-s" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32"><path d="M0 0h32v32H0z" fill="#fff"/><clipPath id="${id}-sa"><path d="${symbol.shortCut.area}"/></clipPath><path d="${symbol.shortCut.band}" fill-rule="evenodd" clip-path="url(#${id}-sa)"/></mask></defs><path d="${symbol.long}" fill="${color}" fill-rule="evenodd" mask="url(#${id}-l)"/><path d="${symbol.short}" fill="${color}" fill-rule="evenodd" mask="url(#${id}-s)"/>`;
}
const svg = (viewBox, body, extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${extra}>${body}</svg>\n`;

mkdirSync(OUT_SVG, { recursive: true });
const write = (name, content) => writeFileSync(path.join(OUT_SVG, name), content);
const ink = C("ink");
const paper = C("paper");
// Linkyo Teal: the deep background, its lighter band, and the light step for dark surfaces.
const teal700 = C("teal.700");
const teal600 = C("teal.600");
const teal350 = C("teal.350");

write("symbol.svg", svg(symbol.viewBox, symbolMarkup("ly", ink)));
write("wordmark.svg", svg(wordmark.viewBox, `<path d="${wordmark.d}" fill="${ink}"/>`));

// Horizontal lockup: symbol height = cap height of the wordmark × 1.32, gap = x-height.
const symbolH = wordmark.height * 1.0;
const gapH = wordmark.xHeight * 0.55;
const hW = symbolH + gapH + wordmark.width;
write(
  "lockup-horizontal.svg",
  svg(
    `0 0 ${f(hW)} ${f(symbolH)}`,
    `<svg x="0" y="0" width="${f(symbolH)}" height="${f(symbolH)}" viewBox="0 0 32 32">${symbolMarkup("lh", ink)}</svg><svg x="${f(symbolH + gapH)}" y="0" width="${wordmark.width}" height="${wordmark.height}" viewBox="${wordmark.viewBox}"><path d="${wordmark.d}" fill="${ink}"/></svg>`,
  ),
);
const sS = wordmark.width * 0.42;
write(
  "lockup-stacked.svg",
  svg(
    `0 0 ${f(wordmark.width)} ${f(sS + wordmark.xHeight * 0.6 + wordmark.height)}`,
    `<svg x="${f((wordmark.width - sS) / 2)}" y="0" width="${f(sS)}" height="${f(sS)}" viewBox="0 0 32 32">${symbolMarkup("ls", ink)}</svg><svg x="0" y="${f(sS + wordmark.xHeight * 0.6)}" width="${wordmark.width}" height="${wordmark.height}" viewBox="${wordmark.viewBox}"><path d="${wordmark.d}" fill="${ink}"/></svg>`,
  ),
);

// App icon (iOS 18 appearances): light, dark, tinted. 1024 grid, symbol at 62 %.
const icon = (id, background, color) =>
  svg(
    "0 0 1024 1024",
    `${background}<svg x="194" y="194" width="636" height="636" viewBox="0 0 32 32">${symbolMarkup(id, color)}</svg>`,
  );
write(
  "app-icon-light.svg",
  icon(
    "il",
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${teal700}"/><stop offset="1" stop-color="${teal600}"/></linearGradient></defs><path d="M0 0h1024v1024H0z" fill="url(#g)"/>`,
    paper,
  ),
);
write("app-icon-dark.svg", icon("id", `<path d="M0 0h1024v1024H0z" fill="${ink}"/>`, teal350));
write("app-icon-tinted.svg", icon("it", `<path d="M0 0h1024v1024H0z" fill="#000"/>`, "#fff"));
write(
  "favicon.svg",
  svg(
    "0 0 32 32",
    `<style>.m{fill:${teal700}}@media (prefers-color-scheme:dark){.m{fill:${teal350}}}</style>${symbolMarkup("fv", "currentColor").replaceAll('fill="currentColor"', 'class="m"')}`,
  ),
);

// Lockup geometry for single-SVG rendering (React): symbol scaled to the wordmark height.
const lockup = {
  viewBox: `0 0 ${f(hW)} ${f(symbolH)}`,
  symbolTransform: `scale(${f(symbolH / 32)})`,
  wordmarkTransform: `translate(${f(symbolH + gapH - bb.x1)} ${f(-bb.y1)})`,
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
const swLink = (l) => `Link(cx: ${sw(l.cx)}, cy: ${sw(l.cy)}, width: ${sw(l.w)}, height: ${sw(l.h)}, radius: ${sw(l.r)}, degrees: ${sw(l.rot)})`;
mkdirSync(IOS_GENERATED, { recursive: true });
writeFileSync(
  path.join(IOS_GENERATED, "LoopSymbol.swift"),
  `// Generated by packages/tokens/brand/logo.mjs — do not edit by hand.
// swiftlint:disable all

import SwiftUI

/// "The Loop": two interlocking links forming a lowercase y. Drawn natively, follows \`foregroundStyle\`.
public struct LoopSymbol: View {
    public init() {}

    struct Link {
        let cx: CGFloat, cy: CGFloat, width: CGFloat, height: CGFloat, radius: CGFloat, degrees: CGFloat

        /// Rounded-rect outline offset by \`inset\` (positive grows), rotated around its center.
        func outline(offset: CGFloat) -> Path {
            let rect = CGRect(x: cx - width / 2 - offset, y: cy - height / 2 - offset, width: width + offset * 2, height: height + offset * 2)
            let path = Path(roundedRect: rect, cornerRadius: max(0.01, radius + offset), style: .circular)
            let transform = CGAffineTransform(translationX: cx, y: cy)
                .rotated(by: degrees * .pi / 180)
                .translatedBy(x: -cx, y: -cy)
            return path.applying(transform)
        }

        func ring(width band: CGFloat) -> Path {
            var path = outline(offset: band / 2)
            path.addPath(outline(offset: -band / 2))
            return path
        }
    }

    static let long = ${swLink(LONG)}
    static let short = ${swLink(SHORT)}
    static let stroke: CGFloat = ${sw(STROKE)}
    static let gap: CGFloat = ${sw(GAP)}
    /// Crossing 0: short link over long. Crossing 1: long link over short.
    static let crossings: [CGPoint] = [${xs.map((p) => `CGPoint(x: ${sw(p.x)}, y: ${sw(p.y)})`).join(", ")}]

    public var body: some View {
        Canvas { context, size in
            let scale = min(size.width, size.height) / 32
            context.translateBy(x: (size.width - 32 * scale) / 2, y: (size.height - 32 * scale) / 2)
            context.scaleBy(x: scale, y: scale)
            draw(Self.long, cutBy: Self.short, at: Self.crossings[0], in: context)
            draw(Self.short, cutBy: Self.long, at: Self.crossings[1], in: context)
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityHidden(true)
    }

    private func draw(_ link: Link, cutBy over: Link, at crossing: CGPoint, in context: GraphicsContext) {
        context.drawLayer { layer in
            layer.fill(link.ring(width: Self.stroke), with: .foreground, style: FillStyle(eoFill: true))
            let radius = Self.stroke * 1.25
            layer.clip(to: Path(ellipseIn: CGRect(x: crossing.x - radius, y: crossing.y - radius, width: radius * 2, height: radius * 2)))
            layer.blendMode = .destinationOut
            layer.fill(over.ring(width: Self.stroke + Self.gap * 2), with: .color(.black), style: FillStyle(eoFill: true))
        }
    }
}
`,
);

console.warn(`✔ logo: symbol (2 links, ${xs.length} crossings), wordmark ${wordmark.width}×${wordmark.height}`);
