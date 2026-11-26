import { NO_IMAGE } from "@linkyo/blocks";
import { tokens } from "@linkyo/tokens";
import { resolveCreatorTheme, TEMPLATE_IDS } from "@linkyo/tokens/creator";
import { describe, expect, it } from "vitest";

import { BELOW_WORK, browserThemeColor, heroTop, rootBackground } from "./browser-top";

// The browser's top area over a creator page (fictional profiles only): Laufbahn's bleed hero gives it
// the hero's dark colour on phones and tablets; every other template keeps the page's colour.

const picture = { hero: { src: "sample:mila-hero", alt: "Ein Beispielbild" }, avatar: { src: NO_IMAGE, alt: "" } };
const initials = { hero: undefined, avatar: { src: NO_IMAGE, alt: "" } };
const portraitOnly = { hero: undefined, avatar: { src: "sample:mila-hero", alt: "Ein Beispielporträt" } };

describe("the browser's top area over a Laufbahn page", () => {
  for (const mode of ["light", "dark"] as const) {
    const theme = resolveCreatorTheme({ template: "laufbahn", mode });

    it(`takes the hero's ink over a picture on phones and tablets, the page's colour on the wide canvas (${mode})`, () => {
      expect(theme.layout.hero).toBe("bleed");
      for (const profile of [picture, portraitOnly]) {
        expect(heroTop(profile, theme)).toBe(tokens.color.ink);
        expect(browserThemeColor(profile, theme)).toEqual([
          { media: BELOW_WORK, color: tokens.color.ink },
          { color: theme.palette.bg },
        ]);
        // Safari 26 tints from the document's background: dark below the wide canvas, the page's own above it.
        expect(rootBackground(profile, theme)).toBe(`html,body{background-color:${theme.palette.bg}}@media ${BELOW_WORK}{html,body{background-color:${tokens.color.ink}}}`);
      }
    });

    it(`takes the accent field's colour when there is no picture (${mode})`, () => {
      expect(heroTop(initials, theme)).toBe(theme.palette.accent);
      expect(browserThemeColor(initials, theme)).toEqual([
        { media: BELOW_WORK, color: theme.palette.accent },
        { color: theme.palette.bg },
      ]);
    });
  }

  it("switches where the hero stops running to the top edge: the wide canvas's own width", () => {
    expect(BELOW_WORK).toBe(`(width < ${String(tokens.layout.work)}px)`);
  });

  it("follows the accent the owner picked (Sevag's ink-black look, as a fictional theme)", () => {
    const theme = resolveCreatorTheme({ template: "laufbahn", mode: "light", accent: tokens.color.ink, tint: 0 });
    expect(heroTop(initials, theme)).toBe(theme.palette.accent);
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
