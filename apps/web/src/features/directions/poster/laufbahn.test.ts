import type { Block, BlockOf, Page } from "@linkyo/blocks";
import { creatorTokens } from "@linkyo/tokens";
import { resolveCreatorTheme, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PREVIEWS } from "@/features/previews/registry";
import { SEVAG_SLUG, sevagDe } from "@/features/previews/sevag";
import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { signpostLetter, signposts } from "./laufbahn";
import { PosterRenderer } from "./renderer";
import { portfolioSample } from "./sample";

// Laufbahn (ADR 0069) rendered to HTML in Node: Sevag's page keeps every fact of his letter, the
// signposts and the index agree, the page works with and without a contact block and without any
// picture, and Arabic pages are lettered and mirrored.

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: unknown }) => createElement("a", { href, ...rest }, children as never),
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  usePathname: () => "/",
}));

const MESSAGES = { de, en, ar };

const render = (page: Page, config: CreatorThemeConfig = { template: "laufbahn" }): string =>
  renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: page.profile.locale,
      messages: MESSAGES[page.profile.locale],
      timeZone: "Europe/Berlin",
      children: createElement(PosterRenderer, { page, theme: resolveCreatorTheme(config, { rtlScript: page.profile.locale === "ar" }) }),
    }),
  );

/** The text a visitor reads, without tags (entities decoded where the page has them). */
const text = (markup: string): string => markup.replace(/<[^>]+>/g, "").replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'");
const count = (markup: string, pattern: RegExp): number => markup.match(pattern)?.length ?? 0;

const sevagTheme = PREVIEWS[SEVAG_SLUG]?.theme ?? {};
const sevag = render(sevagDe, sevagTheme);
const base = { visible: true, highlight: false } as const;
/** A contact block for the fixture only: Sevag's real page has none (no phone number or e-mail is known). */
const contact: BlockOf<"contact"> = {
  ...base,
  id: "contact",
  type: "contact",
  title: "Lassen Sie uns sprechen",
  status: "Ab sofort verfügbar",
  primary: { label: "Gespräch vereinbaren", url: "mailto:bewerbung@example.com", icon: "mail" },
  links: [{ kind: "cv", url: "https://example.com/lebenslauf.pdf" }],
};

describe("signpost letters", () => {
  it("run A, B, C … on German and English pages and أ، ب، ج … (abjad order) on Arabic ones", () => {
    expect([0, 1, 2, 25].map((index) => signpostLetter(index, "de"))).toEqual(["A", "B", "C", "Z"]);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => signpostLetter(index, "ar")).join(" ")).toBe("أ ب ج د ه و ز ح ط ي");
    // Past the last letter a section keeps a sign: its number.
    expect(signpostLetter(26, "en")).toBe("27");
  });

  it("are given to titled sections only, each with its own anchor and view timeline", () => {
    const entries = signposts(
      [
        { id: "top", title: null },
        { id: "about", title: "Über mich" },
        { id: "a b", title: "Zwei" },
        { id: "a-b", title: "Drei" },
      ],
      "de",
    );
    expect(entries.map((entry) => [entry.letter, entry.title])).toEqual([
      ["A", "Über mich"],
      ["B", "Zwei"],
      ["C", "Drei"],
    ]);
    expect(entries.map((entry) => entry.anchor)).toEqual(["section-about", "section-a-b", "section-a-b-3"]);
    expect(new Set(entries.map((entry) => entry.timeline)).size).toBe(3);
  });
});

describe("Sevag's application page on Laufbahn", () => {
  it("uses the template in navy, the blue of the picture's racks", () => {
    expect(sevagTheme).toEqual({ template: "laufbahn", accent: creatorTokens.swatches.navy });
    expect(resolveCreatorTheme(sevagTheme).layout.hero).toBe("bleed");
  });

  it("keeps every fact of the page and adds none", () => {
    const words = text(sevag);
    const profile = sevagDe.profile;
    for (const fact of [profile.displayName.split(" ")[0], profile.tagline, profile.bio, ...(profile.stats ?? []).flatMap((stat) => [stat.value, stat.label])]) expect(words).toContain(fact);
    for (const block of sevagDe.blocks) {
      if (block.type === "about") {
        for (const part of block.text.split("\n\n")) expect(words).toContain(part);
        for (const fact of block.facts ?? []) expect(words).toContain(`${fact.label}${fact.value}`);
      }
      if (block.type === "tools") for (const item of block.items) expect(words).toContain(item);
      if (block.type === "timeline") for (const item of block.items) expect(words).toContain(`${item.role}${item.note ?? ""}`);
      if (block.type === "header") expect(words).toContain(block.title);
      if (block.type === "text") for (const part of block.text.split("\n\n")) expect(words).toContain(part);
    }
    // Both steps are still going on: "heute", in tabular figures, with the en dash every template uses.
    expect(count(sevag, /2021–heute|2018–heute/g)).toBe(2);
  });

  it("names him in one heading, on two lines, and shows his initials while there is no portrait", () => {
    expect(count(sevag, /<h1/g)).toBe(1);
    expect(sevag).toMatch(/<h1[^>]*><span class="block"><bdi dir="auto">Sevag<\/bdi><\/span> <span class="block"><bdi dir="auto">Ghazarian<\/bdi>/);
    // The initials beside the role line (no portrait yet) and in the compact bar.
    expect(count(sevag, />SG</g)).toBeGreaterThanOrEqual(2);
    // The forklift illustration is the large picture, with its description.
    expect(sevag).toContain('alt="Illustration: Ein Staplerfahrer hebt eine Palette mit Kartons in ein Hochregal"');
  });

  it("asks for the picture as wide as it is drawn: a 4:5 picture covers the tall plate", () => {
    // Phones: 4/5 of a plate 1.56 times as tall as the screen is wide (125 %); the wide canvas: the 560 px plate.
    expect(sevag).toContain('sizes="(max-width: 1119px) 125vw, 560px"');
  });

  it("sets the white words on a veil tied to them, and caps the name by the screen's height", () => {
    expect(sevag).toMatch(/class="relative [^"]*lb-veil text-white @work:text-creator-fg @work:before:hidden"/);
    expect(sevag).toMatch(/<h1 class="[^"]*\blb-name\b/);
    expect(sevag).not.toContain("lb-scrim");
  });

  it("letters its five sections A to E and lists them in an index that leads to them", () => {
    const titles = ["Über mich", "Was ich mitbringe", "Werdegang", "Neu für mich: das Tönen", "Anschreiben"];
    const nav = /<nav aria-label="Abschnitte"[\s\S]*?<\/nav>/.exec(sevag)?.[0] ?? "";
    expect(text(nav)).toBe(titles.map((title, index) => `${"ABCDE"[index] ?? ""}${title}`).join(""));
    const targets = [...nav.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
    expect(targets).toHaveLength(5);
    for (const target of targets) expect(sevag).toContain(`<section id="${target ?? ""}"`);
    // Each section's title is its h2, the letter beside it is decoration.
    const headings = [...sevag.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((match) => text(match[1] ?? ""));
    expect(headings).toEqual(titles);
    expect(count(sevag, /<span aria-hidden="true" class="grid size-control-lg/g)).toBe(5);
  });

  it("without a contact block: no promoted action, and 'Weiterlesen' leads to the first section", () => {
    expect(sevag).not.toContain("data-hero-actions");
    expect(sevag).not.toContain("data-bar-action");
    const jump = /<a href="#section-about"[^>]*>[\s\S]*?<\/a>/.exec(sevag)?.[0] ?? "";
    expect(text(jump)).toBe("Weiterlesen");
    expect(jump).toContain(`aria-label="Weiterlesen: Über mich"`);
    // Alone, it stays a secondary action: outlined, never filled with the accent.
    expect(jump).toContain("border-creator-line-strong");
    expect(jump).not.toContain("bg-creator-accent");
  });

  it("sets the letter as a reading column of paragraphs, with its reading time", () => {
    const letter = sevagDe.blocks.find((block): block is BlockOf<"text"> => block.type === "text" && block.id === "letter");
    const paragraphs = letter?.text.split("\n\n") ?? [];
    expect(paragraphs).toHaveLength(7);
    expect(sevag).toContain("1 Min. Lesezeit");
    // The signature keeps its line break.
    expect(sevag).toMatch(/whitespace-pre-line[^"]*">Mit freundlichen Grüßen\nSevag Ghazarian<\/p>/);
    // The short text about toning is a lead, not a tile.
    expect(count(sevag, /Lesezeit/g)).toBe(1);
  });

  it("is flat and unlined: no shadow, no underline", () => {
    expect(sevag).not.toMatch(/\b(?:shadow-(?!none)|drop-shadow|underline|decoration-)/);
  });
});

describe("the same page once a contact block is added (fixture only)", () => {
  const withContact: Page = { ...sevagDe, blocks: [...sevagDe.blocks, contact] };
  const markup = render(withContact, sevagTheme);

  it("puts the contact block's primary action first in the hero and 'Weiterlesen' beside its CV link, quietly", () => {
    const row = /<div data-hero-actions[\s\S]*?<\/div><\/div>/.exec(markup)?.[0] ?? "";
    expect(text(row)).toBe("Ab sofort verfügbarGespräch vereinbarenLebenslauf (PDF)Weiterlesen");
    expect(row).toContain('href="mailto:bewerbung@example.com"');
    // "Weiterlesen" is a text action in the CV link's row, not a second button.
    const jump = /<a href="#section-about"[^>]*>/.exec(row)?.[0] ?? "";
    expect(jump).toContain("min-h-touch-target");
    expect(jump).not.toMatch(/border-creator-line-strong|bg-creator-accent/);
    // Exactly one filled button in the hero.
    const hero = /<header[\s\S]*?<\/header>/.exec(markup)?.[0] ?? "";
    expect(count(hero, /<a [^>]*bg-creator-accent/g)).toBe(1);
    // The compact bar says the same words; the band closes the page under its own heading.
    expect(text(/<a [^>]*data-bar-action[\s\S]*?<\/a>/.exec(markup)?.[0] ?? "")).toBe("Gespräch vereinbaren");
    expect(markup).toMatch(/<h2[^>]*>Lassen Sie uns sprechen<\/h2>/);
    // The band is no signposted section: the index keeps its five letters.
    expect(count(/<nav aria-label="Abschnitte"[\s\S]*?<\/nav>/.exec(markup)?.[0] ?? "", /<li/g)).toBe(5);
  });
});

describe("without any picture", () => {
  const bare: Page = { ...sevagDe, profile: { ...sevagDe.profile, hero: undefined } };
  const markup = render(bare);

  it("fills the picture's place with the accent and the initials, never an empty box", () => {
    expect(markup).toMatch(/data-hero-plate="true" class="[^"]*bg-creator-accent[^"]*"><span aria-hidden="true"[^>]*>SG<\/span>/);
    expect(markup).not.toContain("lb-veil");
    expect(markup).not.toContain("<img");
    // The name reads in the accent's own text color over the field.
    expect(markup).toMatch(/text-creator-accent-fg @work:text-creator-fg/);
  });
});

describe("other blocks in the signposted frame", () => {
  it("keeps the content of every template: the same section titles as Tiefdruck on the portfolio sample", () => {
    const page = portfolioSample("de");
    const titles = (markup: string) => [...markup.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((match) => text(match[1] ?? "").replace(/^\d{2}/, ""));
    const laufbahn = render(page);
    expect(titles(laufbahn)).toEqual(titles(render(page, { template: "tiefdruck" })));
    // Projects keep their cards (each one the anchor the way back from its page lands on).
    for (const slug of ["hafenlicht", "stadtbad", "termine"]) expect(laufbahn).toContain(`id="${slug}"`);
  });

  it("changes nothing for any other template", () => {
    for (const template of ["nocturne", "werkbogen", "tiefdruck", "studio"] as const) {
      const markup = render(sevagDe, { template });
      expect(markup, template).not.toMatch(/lb-(?:plate|scrim|veil|name|ground|section|spy|step|reveal|zoom)/);
      expect(markup, template).not.toContain('aria-label="Abschnitte"');
    }
  });
});

describe("Arabic pages", () => {
  const page = portfolioSample("ar");
  const markup = render(page);

  it("are right to left, lettered in the abjad order, with the Arabic word for 'until now'", () => {
    expect(markup).toContain('<div lang="ar" dir="rtl"');
    const nav = /<nav aria-label="الأقسام"[\s\S]*?<\/nav>/.exec(markup)?.[0] ?? "";
    expect([...nav.matchAll(/class="lb-spy-sign[^"]*"[^>]*>([^<]+)</g)].map((match) => match[1])).toEqual(["أ", "ب", "ج", "د", "ه", "و"]);
    expect(markup).toContain("حتى الآن");
  });

  it("keep a figure such as 40+ left to right", () => {
    expect(markup).toMatch(/<dd dir="ltr"[^>]*>40\+<\/dd>/);
  });

  it("never track or capitalise Arabic display text", () => {
    expect(resolveCreatorTheme({ template: "laufbahn" }, { rtlScript: true }).cssVars["--creator-display-tracking"]).toBe("0em");
    expect(markup).not.toMatch(/class="[^"]*\buppercase\b[^"]*"[^>]*>[^<]*\p{Script=Arabic}/u);
  });
});

/** A block list with one of everything that is not signposted on its own, to check nothing breaks. */
const mixed: Block[] = [
  { ...base, id: "intro", type: "text", text: "Kurz und gut." },
  { ...base, id: "links", type: "header", title: "Links" },
  { ...base, id: "site", type: "link", title: "Website", url: "https://example.com" },
];

describe("a page whose first blocks have no title", () => {
  it("shows them before the first signpost, without a letter", () => {
    const markup = render({ ...sevagDe, blocks: mixed });
    expect(markup).toMatch(/Kurz und gut\.[\s\S]*<section id="section-links"/);
    // One titled section: no index for a single entry. "Weiterlesen" leads to the start of the
    // content, so the untitled text before the first signpost is not skipped.
    expect(markup).not.toContain('aria-label="Abschnitte"');
    expect(markup).toMatch(/<a href="#page-content"[^>]*>[\s\S]*?Weiterlesen/);
    expect(markup).toContain('<main id="page-content"');
    expect(markup).not.toContain("Weiterlesen: Links");
    // Without an index the sections stand in the first eight columns, under the hero's words.
    expect(markup).toContain("@work:col-start-1");
    expect(markup).not.toContain("@work:col-start-5");
  });

  it("a plain link page (no title at all) has no index and keeps its content under the hero's words", () => {
    const markup = render({ ...sevagDe, blocks: [{ ...base, id: "site", type: "link", title: "Website", url: "https://example.com" }] });
    expect(markup).not.toContain('aria-label="Abschnitte"');
    expect(markup).not.toContain("@work:col-start-5");
    // Nothing to read on to: no "Weiterlesen".
    expect(markup).not.toContain("Weiterlesen");
  });
});

describe("motion", () => {
  const tiles = (markup: string) => [.../<ol class="grid min-w-0 grid-cols-2[\s\S]*?<\/ol>/.exec(markup)?.[0].matchAll(/<li class="([^"]*)"/g) ?? []].map((match) => match[1] ?? "");

  it("skills in a section of their own rise in tile by tile", () => {
    expect(tiles(sevag).length).toBe(12);
    expect(tiles(sevag).every((tile) => tile.includes("lb-reveal"))).toBe(true);
  });

  it("skills sharing a section with other blocks rise once with the section, never twice", () => {
    const blocks: Block[] = [
      { ...base, id: "skills", type: "header", title: "Können" },
      { ...base, id: "note", type: "text", text: "Was ich am liebsten tue." },
      { ...base, id: "tools", type: "tools", items: ["Stapler", "SAP"] },
    ];
    const markup = render({ ...sevagDe, blocks });
    expect(tiles(markup)).toHaveLength(2);
    expect(tiles(markup).some((tile) => tile.includes("lb-reveal"))).toBe(false);
    expect(markup).toMatch(/<div class="grid min-w-0 grid-cols-1 gap-4 lb-reveal">/);
  });
});

describe("a portrait as the only picture (no separate hero picture)", () => {
  const markup = render(portfolioSample("en"));

  it("rides high in a square on phones and fades into an ink ground, so the words stand below the face", () => {
    expect(markup).toMatch(/data-hero-plate="true" class="[^"]*lb-ground @work:bg-creator-surface-2/);
    expect(markup).toContain("absolute inset-x-0 top-0 aspect-square mask-b-from-60% mask-b-to-100% @work:inset-0 @work:aspect-auto @work:mask-none");
    // Without a portrait beside it, the role line keeps the same room on both sides.
    expect(markup).toMatch(/<p class="inline-flex [^"]*ps-4 pe-4/);
  });
});
