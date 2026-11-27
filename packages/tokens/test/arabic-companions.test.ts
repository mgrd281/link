import { describe, expect, it } from "vitest";

import { arabicFacesOf, arabicStacks, PAIRING_IDS, resolveCreatorTheme, TEMPLATE_IDS } from "../src/creator/theme";
import { creatorTokens } from "../src/generated/tokens";

const vars = (template: (typeof TEMPLATE_IDS)[number], rtlScript = true) => resolveCreatorTheme({ template }, { rtlScript }).cssVars;
/** The Arabic pairing's own display stack, written out: a page that chooses it keeps it by the character. */
const ARABIC_PAIRING_DISPLAY = 'var(--font-face-plex-arabic, "IBM Plex Sans Arabic"), "Geeza Pro", sans-serif';

describe("Arabic companions (C-03)", () => {
  it("gives every pairing but the Arabic one a display and a body companion with a self-hosted face", () => {
    for (const id of PAIRING_IDS) {
      const faces = arabicFacesOf(id);
      if (id === "arabic") {
        expect(faces.pairing).toBe("arabic");
        continue;
      }
      expect(faces.display?.face, id).toMatch(/^arabic-/);
      expect(faces.body?.face, id).toMatch(/^arabic-/);
      expect(faces.display?.stack, id).toContain(`var(--font-face-${faces.display?.face ?? ""}, `);
    }
  });

  it("sets Arabic pages in the companion first, then the template's own Latin stack", () => {
    for (const template of TEMPLATE_IDS) {
      const t = creatorTokens.templates[template] as { pairing: (typeof PAIRING_IDS)[number] };
      const latin = creatorTokens.pairings[t.pairing];
      const css = vars(template);
      // The companion's unicode-range (apps/web/src/fonts.ts) lets Latin letters through to the Latin face.
      expect(css["--creator-font-display"], template).toMatch(/^var\(--font-face-arabic-[a-z]+, /);
      expect((css["--creator-font-display"] ?? "").endsWith(`, ${latin.display.stack}`), template).toBe(true);
      expect((css["--creator-font-body"] ?? "").endsWith(`, ${latin.body.stack}`), template).toBe(true);
    }
  });

  it("makes Nocturne, Marquee and Daylight three different faces in Arabic", () => {
    const faces = ["nocturne", "marquee", "daylight"].map((template) => vars(template as (typeof TEMPLATE_IDS)[number])["--creator-font-display"]);
    expect(new Set(faces).size).toBe(3);
    expect(faces[0]).toContain("arabic-rakkas");
    expect(faces[1]).toContain("arabic-plex");
    expect(faces[2]).toContain("arabic-lalezar");
  });

  it("sets Laufbahn's Arabic pages in its pairing's companion, IBM Plex Sans Arabic, then Geist: bold, no capitals, no spacing", () => {
    // Plex's unicode-range sends every Latin letter, digit and sign ("SAP", "2017", "(B1)", an e-mail)
    // on to Geist; with the Arabic pairing's stack alone they fell to a system face (round 6 review).
    const css = vars("laufbahn");
    const grotesk = arabicStacks("grotesk");
    expect(css["--creator-font-display"]).toBe(grotesk?.display);
    expect(css["--creator-font-body"]).toBe(grotesk?.body);
    expect(css["--creator-font-display"]).toBe(`var(--font-face-arabic-plex, "IBM Plex Sans Arabic"), ${creatorTokens.pairings.grotesk.display.stack}`);
    expect(css["--creator-font-body"]).toBe(`var(--font-face-arabic-plex, "IBM Plex Sans Arabic"), ${creatorTokens.pairings.grotesk.body.stack}`);
    expect(css["--creator-font-display"]).toContain("var(--font-face-geist, Geist)");
    expect(css["--creator-display-weight"]).toBe("700");
    expect(css["--creator-display-transform"]).toBe("none");
    expect(css["--creator-display-tracking"]).toBe("0em");
    expect(resolveCreatorTheme({ template: "laufbahn" }, { rtlScript: true }).pairing.id).toBe("arabic");
    // No template keeps the Arabic pairing as it is any more; a creator may still choose it.
    for (const template of TEMPLATE_IDS) expect((creatorTokens.templates[template] as { arabic?: { pairing?: string } }).arabic?.pairing, template).toBeUndefined();
  });

  it("keeps Werkbogen's light Arabic name (arabicDisplayWeight 400) on its serif companion", () => {
    const css = vars("werkbogen");
    expect(css["--creator-display-weight"]).toBe("400");
    expect(css["--creator-font-display"]).toContain("arabic-amiri");
  });

  it("never spaces Arabic letters apart, and keeps a pairing's capitals for Latin names", () => {
    for (const template of TEMPLATE_IDS) expect(vars(template)["--creator-display-tracking"], template).toBe("0em");
    expect(vars("nocturne")["--creator-display-transform"]).toBe("uppercase");
    expect(vars("atelier")["--creator-display-transform"]).toBe("none");
  });

  it("follows the creator's own pairing, and uses the Arabic pairing as it is when that is the choice", () => {
    const modern = resolveCreatorTheme({ template: "nocturne", pairing: "modern" }, { rtlScript: true }).cssVars;
    expect(modern["--creator-font-display"]).toContain("arabic-readex");
    expect(modern["--creator-font-body"]).toContain("arabic-readex");
    const arabic = resolveCreatorTheme({ pairing: "arabic" }, { rtlScript: true }).cssVars;
    expect(arabic["--creator-font-display"]).toBe(ARABIC_PAIRING_DISPLAY);
    expect(arabicStacks("arabic")).toBeNull();
  });

  it("changes nothing left to right", () => {
    for (const template of TEMPLATE_IDS) {
      const theme = resolveCreatorTheme({ template });
      expect(theme.cssVars["--creator-font-display"], template).toBe(theme.pairing.display.stack);
      expect(theme.cssVars["--creator-font-display"], template).not.toContain("arabic-");
    }
  });

  it("vendors at most two weights per family", () => {
    const weights = new Map<string, Set<number>>();
    const add = (face: { face: string; weight: number } | undefined) => {
      if (!face) return;
      weights.set(face.face, (weights.get(face.face) ?? new Set()).add(face.weight));
    };
    for (const id of PAIRING_IDS) {
      add(arabicFacesOf(id).display);
      add(arabicFacesOf(id).body);
    }
    for (const id of TEMPLATE_IDS) {
      const own = (creatorTokens.templates[id] as { arabic?: { display?: { face: string; weight: number }; body?: { face: string; weight: number } } }).arabic;
      add(own?.display);
      add(own?.body);
    }
    for (const [face, set] of weights) expect(set.size, face).toBeLessThanOrEqual(2);
  });
});
