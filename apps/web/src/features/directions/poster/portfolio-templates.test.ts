import type { Block, BlockOf, Page } from "@linkyo/blocks";
import { tokens } from "@linkyo/tokens";
import { resolveCreatorTheme, TEMPLATE_IDS } from "@linkyo/tokens/creator";
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

/** Every phone width from layout.preview-compact (320) up to layout.prose (640), and the reference phone. */
const PHONE_WIDTHS: readonly number[] = Array.from({ length: tokens.layout.prose - tokens.layout.previewCompact }, (_, index) => tokens.layout.previewCompact + index);
const PREVIEW: number = tokens.layout.preview;

describe("social rows on phones", () => {
  it("knows how many icons a row holds", () => {
    // Tiles of 56 px with 12 between; bare glyphs of 44 with 8, a row at the start reaching 12 further.
    expect(socialsPerRow(390, false, false)).toBe(5);
    expect(socialsPerRow(390, true, false)).toBe(6);
    expect(socialsPerRow(390, true, true)).toBe(7);
    expect(socialsPerRow(320, false, false)).toBe(4);
  });

  it.each([
    // From 390 to 639 px.
    [6, 390, 640, false, false, 3],
    [5, 390, 640, false, false, null],
    [11, 390, 640, false, false, 4],
    [10, 390, 640, false, false, null],
    [7, 390, 640, true, false, 4],
    [6, 390, 640, true, false, null],
    [8, 390, 640, true, true, 4],
    // 9 tiles hold 5 + 4 at 390 but 8 + 1 at 600: 5 a row on every phone of the range.
    [9, 390, 640, false, false, 5],
    // From 320 to 389 px: 6 tiles are 4 + 2 at 320 but 5 + 1 at 375.
    [6, 320, 390, false, false, 3],
    [5, 320, 390, false, false, 3],
    [7, 320, 390, true, true, 4],
    [1, 320, 390, false, false, null],
  ] as const)("%i icons from %i to %i px (plain %s, start %s): %s per row", (count, from, to, plain, start, expected) => {
    const row = balancedRow(count, from, to, plain, start);
    expect(row).toBe(expected);
    if (row !== null) {
      // No row ends with one icon, and the balanced row fits the narrowest phone.
      expect(count % row === 0 || count % row > 1).toBe(true);
      expect(row).toBeLessThanOrEqual(socialsPerRow(from, plain, start));
    }
  });

  it("leaves no icon alone at any phone width from 320 to 639 px, for every count and every hero", () => {
    const platforms = ["instagram", "tiktok", "youtube", "spotify", "soundcloud", "email", "website", "x", "facebook", "linkedin", "github", "twitch"] as const;
    const clamp = (markup: string, name: string) => {
      const match = new RegExp(`--${name}:calc\\((\\d+) \\* var`).exec(markup);
      return match ? Number(match[1]) : Infinity;
    };
    const alone: string[] = [];
    for (const template of TEMPLATE_IDS.filter((id) => id !== "laufbahn")) {
      for (let count = 2; count <= platforms.length; count++) {
        const socials: Block = { ...base, id: "s", type: "socials", items: platforms.slice(0, count).map((platform) => ({ platform, url: `https://example.com/${platform}` })) };
        const page: Page = { profile: { username: "mila", displayName: "Mila", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale: "de" }, blocks: [socials] };
        const list = /<ul data-block="s"[^>]*>/.exec(hero(html(template, page)))?.[0];
        if (!list) continue;
        // Bare glyphs sit 8 px apart (gap-2), tiles 12 (gap-3); a row at the reading start is pulled out.
        const plain = /\bgap-2\b/.test(list);
        const start = list.includes("justify-start");
        for (const width of PHONE_WIDTHS) {
          // The page's CSS: below layout.preview the narrow count, from there to layout.prose the phone's.
          const limit = width < PREVIEW ? clamp(list, "socials-row-narrow") : clamp(list, "socials-row");
          const perRow = Math.min(limit, socialsPerRow(width, plain, start));
          if (count > perRow && count % perRow === 1) alone.push(`${template}: ${String(count)} at ${String(width)} px`);
        }
      }
    }
    expect(alone).toEqual([]);
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

  it("stands every picture of the strip at one height on phones: the track holds the widest ratio, each picture its own", () => {
    const { profile } = portfolioSample("de");
    // Two landscapes (1.5) and a portrait (0.8): the real case of Merle Kastorf, whose strip was as tall as her portraits.
    const blocks = [shot("a", 1500, 1000), shot("b", 1500, 1000), shot("c", 1000, 1250)];
    expect(stripProjects(blocks).map((project) => project.id)).toEqual(["a", "b", "c"]);
    const strip = hero(html("leuchttisch", { profile, blocks }));
    // The widest picture's ratio is on the track; every picture carries its own.
    expect(strip).toContain("--widest:1.5");
    expect([...strip.matchAll(/--ratio:([\d.]+)/g)].map((match) => match[1])).toEqual(["1.5", "1.5", "0.8"]);
    // A picture's width is the one height (the widest picture whole in the column less a peek, at most 70svh) times its ratio.
    expect(strip).toContain("w-[calc(min(70svh,(100%_-_var(--spacing-8))_/_var(--widest))_*_var(--ratio))]");
    // Not the old rule, which made every picture as wide as the column and so a portrait 1.9 times as tall as a landscape.
    expect(strip).not.toContain("w-[min(calc(100%-var(--spacing-8)),calc(70svh*var(--ratio)))]");
    // The canvas keeps its justified row (flex by ratio).
    expect(strip).toContain("@work:flex-[var(--ratio)_1_0%]");
  });

  it("keeps words in the creator column inside a section of work too: an intro, the list fallback, the projects after the sixth", () => {
    const { profile } = portfolioSample("de");
    const header: Block = { ...base, id: "work", type: "header", title: "Arbeiten" };
    const intro: Block = { ...base, id: "intro", type: "text", text: "Serien aus dem Hafen, aus Bädern und Werkhallen, jede Aufnahme unbeschnitten." };
    const plain = (id: string): BlockOf<"project"> => ({ ...base, id, type: "project", slug: id, title: id, summary: "One sentence." });
    // Eight pictures: the strip takes three, the rows the next three, the last two open in place.
    const pictures = Array.from({ length: 8 }, (_, index) => shot(`w${String(index)}`, 1500, 1000));
    const markup = body(html("leuchttisch", { profile, blocks: [header, intro, ...pictures] }));
    expect(markup).toMatch(/<div data-column-item="true" class="min-w-0 @work:max-w-creator"><div class="contents" data-block="intro"><p /);
    expect(markup).toContain('<details class="group/more @work:max-w-creator">');
    // The rows drawn as in a column: no twelve-column row on the wall.
    expect(markup).not.toContain("@work:grid-cols-12 @work:items-center");
    // Mostly words: the run falls back to a list, which keeps the column as well.
    const words = body(html("leuchttisch", { profile, blocks: [header, plain("a"), plain("b"), plain("c"), shot("d", 1500, 1000)] }));
    expect(words).toContain('<ol start="1" class="border-t border-creator-line @work:max-w-creator">');
    // The work itself still runs across the wall.
    expect(markup).not.toMatch(/data-column-item[^>]*><ul/);
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

describe("the statement hero on the canvas (P-08)", () => {
  it("keeps the role line and the sentence together in one box, so a taller box beside them grows their row, not the gap", () => {
    const sample = portfolioSample("en");
    expect(sample.profile.tagline && sample.profile.bio).toBeTruthy();
    const header = hero(html("tiefdruck", sample));
    // The words: one box in columns 1–7 on the canvas (no box below it), the role line first.
    expect(header).toMatch(/<div class="contents @work:col-span-7 @work:grid @work:content-start @work:gap-5"><p dir="auto"[^>]*>[^<]*<\/p><p dir="auto"/);
    // The numbers, the action and the profiles beside them span that one row only.
    expect(header).not.toContain("@work:row-span-2");
  });
});

describe("section titles beside their content on the canvas", () => {
  it.each(["grundriss", "logbuch", "folio", "werkbogen", "tiefdruck"])("%s: every title beside its content stands at the top of its section", (template) => {
    const markup = body(html(template, portfolioSample("de")));
    // The numbered, rule and mono titles centre their parts (items-center); in a stretched grid cell
    // that put the title halfway down a long list.
    const beside = [...markup.matchAll(/<h2 [^>]*class="[^"]*@work:col-span-4[^"]*"|<div class="flex min-w-0 items-baseline justify-between gap-4 @work:col-span-4[^"]*"/g)].map((match) => match[0]);
    expect(beside.length, template).toBeGreaterThan(0);
    for (const title of beside) expect(title, template).toContain("@work:self-start");
  });
});
