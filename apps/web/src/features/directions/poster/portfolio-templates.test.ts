import type { Block, BlockOf, Page } from "@linkyo/blocks";
import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { balancedRow, socialsPerRow } from "./hero";
import { PHONE_ROW, WIDE_ROW } from "./justified";
import { PosterRenderer, stripProjects } from "./renderer";
import { portfolioSample } from "./sample";

// Stage 3's portfolio templates (Leuchttisch, Grundriss, Logbuch) and the social rows without an
// orphan, rendered to HTML in Node.

const MESSAGES = { de, en, ar };
type Locale = keyof typeof MESSAGES;
const html = (template: string, page: Page, locale: Locale = page.profile.locale) =>
  renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale,
      messages: MESSAGES[locale],
      timeZone: "Europe/Berlin",
      children: createElement(PosterRenderer, { page, theme: resolveCreatorTheme({ template: template as never }, { rtlScript: locale === "ar" }), projectBase: "/sample" }),
    }),
  );
const hero = (markup: string) => markup.split("data-poster-sentinel")[0] ?? "";
const body = (markup: string) => markup.split("data-poster-sentinel")[1] ?? "";
const ids = (fragment: string, tag: string) => [...fragment.matchAll(new RegExp(`<${tag} id="([^"]+)" data-block=`, "g"))].map((match) => match[1]);

const base = { visible: true, highlight: false } as const;
const shot = (id: string, w: number, h: number): BlockOf<"project"> => ({ ...base, id, type: "project", slug: id, title: id, summary: "One sentence.", cover: { src: `sample:ex-pf-ronja-0${String(2)}`, alt: "", w, h } });

describe("social rows on phones", () => {
  it("knows how many icons a row holds", () => {
    // Tiles of 56 px with 12 between; bare glyphs of 44 with 8, a row at the start reaching 12 further.
    expect(socialsPerRow(390, false, false)).toBe(5);
    expect(socialsPerRow(390, true, false)).toBe(6);
    expect(socialsPerRow(390, true, true)).toBe(7);
    expect(socialsPerRow(320, false, false)).toBe(4);
  });

  it.each([
    [6, 390, false, false, 3],
    [5, 390, false, false, null],
    [11, 390, false, false, 4],
    [10, 390, false, false, null],
    [7, 390, true, false, 4],
    [6, 390, true, false, null],
    [8, 390, true, true, 4],
    [5, 320, false, false, 3],
    [1, 320, false, false, null],
  ] as const)("%i icons at %i px (plain %s, start %s): %s per row", (count, width, plain, start, expected) => {
    const row = balancedRow(count, width, plain, start);
    expect(row).toBe(expected);
    if (row !== null) {
      // No row ends with one icon, and the balanced row fits the phone.
      expect(count % row === 0 || count % row > 1).toBe(true);
      expect(row).toBeLessThanOrEqual(socialsPerRow(width, plain, start));
    }
  });

  it("narrows the list where an icon would stand alone, and never on Laufbahn", () => {
    const socials: Block = {
      ...base,
      id: "s",
      type: "socials",
      items: (["instagram", "tiktok", "youtube", "spotify", "soundcloud", "email"] as const).map((platform) => ({ platform, url: `https://example.com/${platform}` })),
    };
    const page: Page = { profile: { username: "mila", displayName: "Mila", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale: "de" }, blocks: [socials] };
    // Six tiles: 3 + 3 on the phone instead of 5 + 1.
    expect(hero(html("nocturne", page))).toContain("--socials-row:calc(3 * var(--spacing-control-xl) + 2 * var(--spacing-3))");
    expect(hero(html("nocturne", page))).toContain("@preview:@max-prose:max-w-(--socials-row)");
    // Six bare glyphs fit one row at the reading start of a 390 phone: nothing changes there; a 320
    // phone holds five, so below 390 the row is narrowed to 3 + 3.
    expect(hero(html("werkbogen", page))).not.toContain("--socials-row:");
    expect(hero(html("werkbogen", page))).toContain("--socials-row-narrow:calc(3 * var(--spacing-touch-target) + 2 * var(--spacing-2))");
    expect(html("laufbahn", page)).not.toContain("--socials-row");
  });
});

describe("Leuchttisch", () => {
  it("opens with the run's first covers with a picture, three to five of them in a row of the canvas", () => {
    expect(PHONE_ROW).toBeCloseTo(1.25, 5);
    expect(WIDE_ROW).toBeCloseTo(4, 5);
    // The sample: the series and the bath have pictures, the booking project has none: the strip stops there.
    const sample = portfolioSample("de").blocks.filter((block): block is BlockOf<"project"> => block.type === "project");
    expect(stripProjects(sample).map((project) => project.id)).toEqual(["harbour", "bath"]);
    // Six landscapes (1.5): three come closest to a row of 4 (4.5 against 3.0 and 6.0).
    const six = Array.from({ length: 6 }, (_, index) => shot(`l${String(index)}`, 1500, 1000));
    expect(stripProjects(six)).toHaveLength(3);
    // Six upright pictures (0.67): five (3.33) come closest to 4.
    const upright = Array.from({ length: 6 }, (_, index) => shot(`p${String(index)}`, 1000, 1500));
    expect(stripProjects(upright)).toHaveLength(5);
    expect(stripProjects([])).toEqual([]);
  });

  it("shows the strip's projects in the hero, the rest of the run as justified rows, and keeps text in the column", () => {
    const markup = html("leuchttisch", portfolioSample("de"));
    expect(ids(hero(markup), "li")).toEqual(["hafenlicht", "stadtbad"]);
    expect(hero(markup)).toContain("01/06");
    // The run goes on with the third project, as rows that break per width (aria-hidden breaks and a filler).
    expect(ids(body(markup), "div")).toEqual(["termine", "rasterblick", "werkhalle", "schneiderinnen"]);
    expect(body(markup)).toContain('aria-hidden="true" class="h-0 basis-full @work:hidden"');
    expect(body(markup)).toContain("03/06");
    // The full canvas: up to layout.wall, the about section in the creator column (not the wide about).
    expect(markup).toContain("@work:max-w-wall");
    expect(body(markup)).not.toContain("@work:col-span-6 @work:col-start-6");
  });
});

describe("Grundriss", () => {
  it("draws the title block beside the lead sheet, column guides, and sheets whose facts are isolated", () => {
    const markup = html("grundriss", portfolioSample("ar"), "ar");
    // The title block: the discipline, the place and the status in a ruled list.
    for (const label of [ar.creator.titleblock.discipline, ar.creator.titleblock.place, ar.creator.titleblock.status]) expect(hero(markup)).toContain(label);
    // The lead project's cover with its drawing label; the run goes on with the second project.
    expect(hero(markup)).toContain('id="hafenlicht" data-block="harbour"');
    expect(ids(body(markup), "li")).toEqual(["stadtbad", "termine", "rasterblick", "werkhalle", "schneiderinnen"]);
    // Twelve guides, gone with more contrast.
    expect(markup.match(/<span class="border-s border-creator-line last:border-e"><\/span>/g)).toHaveLength(12);
    expect(markup).toContain("contrast-more:hidden");
    // Every fact value of a sheet is isolated, so "2024–2025" or "+38 %" keeps its order in Arabic.
    const facts = [...body(markup).matchAll(/<dd class="[^"]*">([\s\S]*?)<\/dd>/g)].map((match) => match[1] ?? "");
    expect(facts.length).toBeGreaterThan(5);
    for (const fact of facts) expect(fact.startsWith("<bdi>"), fact).toBe(true);
  });
});

describe("Logbuch", () => {
  it("reads like a README and a build log: the facts from the page, the work by year with its state in words", () => {
    const markup = html("logbuch", portfolioSample("en"));
    // The README's list: the first four skills, the place, the availability, the repository.
    expect(hero(markup)).toContain("Identities · Wayfinding · Reportage photography · UX design");
    expect(hero(markup)).toContain("Berlin");
    expect(hero(markup)).toContain("milaaurel/rasterblick");
    // The log: the latest year first, every project once, each list named by its year.
    const years = [...body(markup).matchAll(/<bdi class="tabular-nums">(\d{4})<\/bdi>/g)].map((match) => Number(match[1]));
    expect(years).toEqual([2025, 2024, 2023]);
    expect(ids(body(markup), "li").sort()).toEqual(["hafenlicht", "rasterblick", "schneiderinnen", "stadtbad", "termine", "werkhalle"]);
    expect(body(markup).match(/<ol aria-labelledby=/g)).toHaveLength(3);
    // rasterblick runs until now: "ongoing"; the others are "done". The dot is decoration.
    expect(body(markup).split(en.creator.portfolio.logRunning)).toHaveLength(2);
    expect(body(markup).split(en.creator.portfolio.logDone)).toHaveLength(6);
    // The year stays under the bar on the canvas.
    expect(body(markup)).toContain("@work:sticky @work:top-16");
  });
});
