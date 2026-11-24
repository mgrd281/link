import { PLATFORMS, type Platform } from "@linkyo/blocks";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GLOBE_GLYPH, LINKEDIN_GLYPH, linkGlyph, MAIL_GLYPH } from "./link-icons";
import { PlatformGlyph, platformName } from "./platforms";

describe("link icons", () => {
  it.each([
    ["mailto:hello@example.com", { kind: "icon", icon: "mail" }],
    ["tel:+49301234567", { kind: "icon", icon: "phone" }],
    ["https://wa.me/4915112345678", { kind: "platform", platform: "whatsapp" }],
    ["https://github.com/leonpark", { kind: "platform", platform: "github" }],
    ["https://www.linkedin.com/in/hanna", { kind: "platform", platform: "linkedin" }],
    ["https://example.com/menu.pdf", { kind: "icon", icon: "file" }],
    ["https://www.google.com/maps/search/?api=1&query=Kiel", { kind: "icon", icon: "map" }],
    ["https://calendly.com/hanna/erstgespraech", { kind: "icon", icon: "calendar" }],
    ["https://www.eventim.de/event/x-123", { kind: "icon", icon: "ticket" }],
    ["https://example.com/anything", { kind: "icon", icon: "link" }],
  ])("%s → %o", (url, expected) => {
    expect(linkGlyph(url)).toEqual(expected);
  });

  it("the creator's choice wins over the address", () => {
    expect(linkGlyph("https://wa.me/4915112345678", "chat")).toEqual({ kind: "icon", icon: "chat" });
  });
});

// Audit C-07: a row of social profiles mixed filled brand logos with an outline globe and envelope.
// Every glyph in the row is now one filled path on the 24 × 24 grid, drawn in the current colour.
describe("social glyphs are uniformly solid", () => {
  const markup = (platform: Platform) => renderToStaticMarkup(createElement(PlatformGlyph, { platform, size: "md" }));
  /** The `d` of each path in the markup. */
  const paths = (svg: string) => Array.from(svg.matchAll(/<path d="([^"]+)"/g), (match) => match[1]);

  it.each(PLATFORMS)("%s: one filled path, no stroke", (platform) => {
    const svg = markup(platform);
    expect(svg).toMatch(/^<svg viewBox="0 0 24 24"/);
    expect(svg).toContain("fill-current");
    // Lucide's outline icons are drawn with a stroke; a solid glyph has none.
    expect(svg).not.toMatch(/stroke|lucide/);
    expect(paths(svg)).toHaveLength(1);
  });

  it("a website and an email address use Linkyo's solid globe and envelope", () => {
    expect(paths(markup("website"))).toEqual([GLOBE_GLYPH.path]);
    expect(paths(markup("email"))).toEqual([MAIL_GLYPH.path]);
    expect(paths(markup("linkedin"))).toEqual([LINKEDIN_GLYPH.path]);
    // Their names stay as they were.
    expect(platformName("website")).toBe("Website");
    expect(platformName("email")).toBe("Email");
  });

  it("an unknown platform from older data falls back to the solid globe", () => {
    expect(paths(markup("myspace" as Platform))).toEqual([GLOBE_GLYPH.path]);
    expect(platformName("myspace" as Platform)).toBe("Website");
  });

  it("the drawn glyphs stay on the 24 × 24 grid", () => {
    for (const glyph of [GLOBE_GLYPH, MAIL_GLYPH]) {
      const numbers = (glyph.path.match(/-?\d*\.?\d+/g) ?? []).map(Number);
      expect(numbers.length).toBeGreaterThan(0);
      for (const value of numbers) expect(Math.abs(value)).toBeLessThanOrEqual(24);
    }
  });
});
