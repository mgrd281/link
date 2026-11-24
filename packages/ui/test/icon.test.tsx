import { readFileSync } from "node:fs";
import path from "node:path";

import { tokens } from "@linkyo/tokens";
import { ArrowLeft, ChevronLeft, ChevronRight, Link2, LogOut, Pause, Play, Plus, Send, Undo2 } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "../src/button";
import { Icon, iconStroke, MIRROR_IN_RTL } from "../src/icon";
import { IconButton } from "../src/icon-button";
import { DIRECTIONAL, MEDIA_TRANSPORT } from "../src/icons";
import { TooltipProvider } from "../src/tooltip";

// The class as it appears in markup (React escapes the ampersand).
const MIRROR = MIRROR_IN_RTL.replaceAll("&", "&amp;");
const svgOf = (html: string) => html.slice(html.indexOf("<svg"), html.indexOf(">", html.indexOf("<svg")) + 1);

describe("Icon: mirroring in right-to-left text (S-04)", () => {
  it("mirrors every DIRECTIONAL glyph by itself", () => {
    expect(DIRECTIONAL.size).toBeGreaterThan(40);
    for (const glyph of DIRECTIONAL) {
      const svg = svgOf(renderToStaticMarkup(<Icon icon={glyph} />));
      expect(svg, glyph.displayName).toContain(MIRROR);
      expect(svg, glyph.displayName).toContain("data-mirror");
      expect(svg, glyph.displayName).toContain('data-icon-dir="mirror"');
    }
  });

  it("covers the glyphs that were not mirrored before: sign out, send, undo, lists", () => {
    for (const glyph of [LogOut, Send, Undo2, ArrowLeft, ChevronRight]) expect(DIRECTIONAL.has(glyph), glyph.displayName).toBe(true);
  });

  it("leaves symmetric glyphs, logos' neighbours and media transport alone", () => {
    for (const glyph of [Plus, Link2, Play, Pause]) {
      const svg = svgOf(renderToStaticMarkup(<Icon icon={glyph} />));
      expect(svg, glyph.displayName).not.toContain("scale-x");
      expect(svg).not.toContain("data-mirror");
      expect(svg).not.toContain("data-icon-dir");
    }
    for (const glyph of MEDIA_TRANSPORT) expect(DIRECTIONAL.has(glyph), glyph.displayName).toBe(false);
  });

  it("can be told not to mirror, or to mirror a glyph the set does not know", () => {
    const fixed = svgOf(renderToStaticMarkup(<Icon icon={ChevronLeft} mirror={false} />));
    expect(fixed).not.toContain(MIRROR);
    // Still marked as a directional glyph, so the e2e check expects no flip for it.
    expect(fixed).toContain('data-icon-dir="fixed"');
    const forced = svgOf(renderToStaticMarkup(<Icon icon={Plus} mirror />));
    expect(forced).toContain(MIRROR);
    expect(forced).toContain("data-mirror");
    expect(forced).not.toContain("data-icon-dir");
  });

  it("mirrors once: the flip sits on the svg, never on the button around it", () => {
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <IconButton icon={ChevronLeft} label="Zurück" />
        <Button icon={ArrowLeft}>Zurück</Button>
      </TooltipProvider>,
    );
    expect(html.match(/scale-x-100/g)).toHaveLength(2);
    for (const button of html.match(/<button[^>]*>/g) ?? []) expect(button).not.toContain("scale-x");
  });
});

describe("Icon: strokes per size (S-06)", () => {
  it("draws the token's width in CSS pixels at every size", () => {
    const sizes = { xs: tokens.size.iconXs, sm: tokens.size.iconSm, md: tokens.size.iconMd, lg: tokens.size.iconLg } as const;
    const px = { xs: tokens.icon.strokeSm, sm: tokens.icon.strokeSm, md: tokens.icon.strokeMd, lg: tokens.icon.strokeLg } as const;
    for (const size of ["xs", "sm", "md", "lg"] as const) {
      // In the 24-unit grid, scaled to the icon's size, the stroke is the token's width.
      expect((iconStroke(size) * sizes[size]) / 24, size).toBeCloseTo(px[size], 2);
      expect(svgOf(renderToStaticMarkup(<Icon icon={Link2} size={size} />))).toContain(`stroke-width="${String(iconStroke(size))}"`);
    }
    expect([tokens.icon.strokeSm, tokens.icon.strokeMd, tokens.icon.strokeLg]).toEqual([1.5, 1.6, 1.75]);
    expect(iconStroke("sm")).toBe(2.25);
    expect(iconStroke("lg")).toBe(1.75);
  });

  it("has an xs step (12 px) for the places that forced size-3", () => {
    const svg = svgOf(renderToStaticMarkup(<Icon icon={Link2} size="xs" />));
    expect(svg).toContain("size-icon-xs");
    expect(tokens.size.iconXs).toBe(12);
  });

  it("strong: the selected tab's heavier stroke (icon.stroke-strong)", () => {
    expect(tokens.icon.strokeStrong).toBe(2.25);
    expect((iconStroke("md", true) * tokens.size.iconMd) / 24).toBeCloseTo(2.25, 2);
    expect(svgOf(renderToStaticMarkup(<Icon icon={Link2} strong />))).toContain(`stroke-width="${String(iconStroke("md", true))}"`);
  });

  it("solid: media transport is filled, everything else is drawn as a line", () => {
    expect(svgOf(renderToStaticMarkup(<Icon icon={Play} solid />))).toContain('fill="currentColor"');
    expect(svgOf(renderToStaticMarkup(<Icon icon={Play} />))).toContain('fill="none"');
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <IconButton icon={Pause} label="Pause" solid />
      </TooltipProvider>,
    );
    expect(svgOf(html)).toContain('fill="currentColor"');
  });

  it("is decorative unless it has a label", () => {
    expect(svgOf(renderToStaticMarkup(<Icon icon={Link2} />))).toContain('aria-hidden="true"');
    const labelled = svgOf(renderToStaticMarkup(<Icon icon={Link2} label="Link" />));
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain('aria-label="Link"');
  });
});

describe("packages/ui stays free of hand-written mirroring", () => {
  it("no component flips an icon or a button itself", () => {
    const dir = path.join(import.meta.dirname, "../src");
    for (const file of ["button.tsx", "icon-button.tsx", "menu.tsx", "segmented.tsx", "field.tsx", "select.tsx", "filter-sheet.tsx", "command-palette.tsx", "data-list.tsx", "chart-table.tsx"]) {
      // Code only: the docs may name the classes they forbid.
      const code = readFileSync(path.join(dir, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(code, file).not.toMatch(/rtl:\S*-scale-x-100/);
    }
  });
});
