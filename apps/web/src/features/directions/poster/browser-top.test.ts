import { NO_IMAGE } from "@linkyo/blocks";
import { tokens } from "@linkyo/tokens";
import { resolveCreatorTheme, TEMPLATE_IDS } from "@linkyo/tokens/creator";
import { describe, expect, it } from "vitest";

import { browserThemeColor, heroTop, rootBackground } from "./browser-top";

// The browser's top area over a creator page (fictional profiles only): Laufbahn's head is ink at every
// width (ADR 0069 round 6), so the top is ink there; every other template keeps the page's colour.

const picture = { hero: { src: "sample:mila-hero", alt: "Ein Beispielbild" }, avatar: { src: NO_IMAGE, alt: "" } };
const initials = { hero: undefined, avatar: { src: NO_IMAGE, alt: "" } };
const portraitOnly = { hero: undefined, avatar: { src: "sample:mila-hero", alt: "Ein Beispielporträt" } };

describe("the browser's top area over a Laufbahn page", () => {
  for (const mode of ["light", "dark"] as const) {
    const theme = resolveCreatorTheme({ template: "laufbahn", mode });

    it(`takes the head's ink at every width, with a picture or without one (${mode})`, () => {
      expect(theme.layout.hero).toBe("bleed");
      expect(theme.layout.headings).toBe("signpost");
      for (const profile of [picture, portraitOnly, initials]) {
        expect(heroTop(profile, theme)).toBe(tokens.color.ink);
        // No media query any more: the head is ink on phones and on the wide canvas alike.
        expect(browserThemeColor(profile, theme)).toBe(tokens.color.ink);
        // Safari 26 tints from the document's background: ink, as the head and the Kontakt band are.
        expect(rootBackground(profile, theme)).toBe(`html,body{background-color:${tokens.color.ink}}`);
      }
    });
  }

  it("keeps ink whatever accent the owner picked (Sevag's ink-black look, as a fictional theme)", () => {
    const theme = resolveCreatorTheme({ template: "laufbahn", mode: "light", accent: tokens.color.ink, tint: 0 });
    expect(heroTop(initials, theme)).toBe(tokens.color.ink);
    expect(heroTop(picture, theme)).toBe(tokens.color.ink);
  });
});

describe("every other template", () => {
  it("keeps the page's own colour at the top, exactly as before", () => {
    const others = TEMPLATE_IDS.filter((id) => resolveCreatorTheme({ template: id }).layout.hero !== "bleed");
    expect(others).toContain("werkbogen");
    expect(others).not.toContain("laufbahn");
    for (const template of others) {
      const theme = resolveCreatorTheme({ template });
      for (const profile of [picture, initials]) {
        expect(heroTop(profile, theme), template).toBeNull();
        expect(browserThemeColor(profile, theme), template).toBe(theme.palette.bg);
        expect(rootBackground(profile, theme), template).toBe(`html,body{background-color:${theme.palette.bg}}`);
      }
    }
  });
});
