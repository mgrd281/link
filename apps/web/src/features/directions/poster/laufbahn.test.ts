import type { Block, BlockOf, Page } from "@linkyo/blocks";
import { creatorTokens } from "@linkyo/tokens";
import { resolveCreatorTheme, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { MOTION_LIBRARY } from "@/features/creator/motion-library";
import { PREVIEWS } from "@/features/previews/registry";
import { SEVAG_SLUG, sevagDe } from "@/features/previews/sevag";
import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { LaufbahnAbout, signposts } from "./laufbahn";
import { splitLead } from "./laufbahn-content";
import { PosterRenderer } from "./renderer";
import { portfolioSample } from "./sample";

// Laufbahn (ADR 0069) rendered to HTML in Node: Sevag's page keeps every fact of his letter, the
// headings, the index and the app bar's contents sheet agree, facts and skills are grouped lists with
// whole words, the page works with and without a contact block and without any picture, and Arabic
// pages are mirrored.

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
const text = (markup: string): string =>
  markup.replace(/<[^>]+>/g, "").replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("­", "");
const count = (markup: string, pattern: RegExp): number => markup.match(pattern)?.length ?? 0;
/** The page without its closed contents sheet (a dialog), as the document reads before it opens. */
const page = (markup: string): string => markup.replace(/<dialog[\s\S]*?<\/dialog>/g, "");
/** The section titles a visitor reads on the page (the h2 headings outside the sheet). */
const headingsOf = (markup: string): string[] => [...page(markup).matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((match) => text(match[1] ?? ""));

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

describe("the page's contents", () => {
  it("list the titled sections only, each with its own anchor, and no letters", () => {
    const entries = signposts([
      { id: "top", title: null },
      { id: "about", title: "Über mich" },
      { id: "a b", title: "Zwei" },
      { id: "a-b", title: "Drei" },
    ]);
    expect(entries.map((entry) => entry.title)).toEqual(["Über mich", "Zwei", "Drei"]);
    expect(entries.every((entry) => !("letter" in entry))).toBe(true);
    expect(entries.map((entry) => entry.anchor)).toEqual(["section-about", "section-a-b", "section-a-b-3"]);
    expect(new Set(entries.map((entry) => entry.anchor)).size).toBe(3);
  });
});

describe("Sevag's application page on Laufbahn", () => {
  it("uses the template in black and grey, easy on the eyes: a soft light grey ground and black buttons", () => {
    expect(sevagTheme).toEqual({ template: "laufbahn", mode: "light", accent: creatorTokens.swatches.ink, tint: 0 });
    const theme = resolveCreatorTheme(sevagTheme);
    expect(theme.layout.hero).toBe("bleed");
    expect({ mode: theme.palette.mode, bg: theme.palette.bg, accent: theme.palette.accent, accentFg: theme.palette.accentFg }).toEqual({ mode: "light", bg: "#F6F6F6", accent: "#111111", accentFg: "#FFFFFF" });
  });

  it("keeps every fact of the page and adds none", () => {
    const words = text(sevag);
    const profile = sevagDe.profile;
    for (const fact of [profile.displayName.split(" ")[0], profile.tagline, profile.bio, ...(profile.stats ?? []).flatMap((stat) => [stat.value, stat.label])]) expect(words).toContain(fact);
    for (const block of sevagDe.blocks) {
      if (block.type === "about") {
        // A long first paragraph leads with its first sentence; the rest of it follows the facts (splitLead drops nothing).
        for (const part of block.text.split("\n\n").flatMap((paragraph) => splitLead(paragraph))) if (part) expect(words).toContain(part);
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

  it("names him in one heading, on one line, with his role right under it and no initials in the hero", () => {
    expect(count(sevag, /<h1/g)).toBe(1);
    expect(sevag).toMatch(/<h1[^>]*><bdi dir="auto">Sevag Ghazarian<\/bdi><\/h1>/);
    // The role follows the name as a plain line (no chip); the initials only in the compact bar.
    expect(sevag).toMatch(/<\/h1><\/div><p class="[^"]*text-body[^"]*"[^>]*><span dir="auto"[^>]*>Lagerist · Staplerfahrer mit Flurförderzeugschein<\/span><\/p>/);
    expect(sevag).not.toContain("lb-chip");
    // The reach-truck illustration is the large picture, with its description.
    expect(sevag).toContain('alt="Illustration: Ein Lagerist scannt jeden Karton mit dem Handscanner, die EAN erscheint; er packt die Palette und sichert sie mit Stretchfolie"');
  });

  it("asks for the picture as wide as it is drawn: a 4:5 picture covers the tall plate", () => {
    // Phones: 4/5 of a plate 1.56 times as tall as the screen is wide (125 %); the wide canvas: the 560 px plate.
    expect(sevag).toContain('sizes="(max-width: 1119px) 125vw, 560px"');
  });

  it("sets the white words on a veil tied to them, and caps the name by the screen's height", () => {
    expect(sevag).toMatch(/class="relative [^"]*lb-veil text-white @work:text-creator-fg @work:before:hidden"/);
    expect(sevag).toMatch(/<h1 [^>]*class="[^"]*\blb-name\b/);
    expect(sevag).not.toContain("lb-scrim");
  });

  it("titles its five sections plainly (no letters) and lists them as contents: the app bar's sheet and an index", () => {
    const titles = ["Über mich", "Was ich mitbringe", "Werdegang", "Neu für mich: das Tönen", "Anschreiben"];
    // The index beside the sections (tablets and wider): words only.
    const nav = /<nav aria-label="Abschnitte" class="([^"]*)"[\s\S]*?<\/nav>/.exec(sevag);
    expect(text(nav?.[0] ?? "")).toBe(titles.join(""));
    // Phones have no row of chips: the index is hidden there, the app bar carries the contents.
    expect(nav?.[1]).toMatch(/^hidden\b[^"]*@prose:block/);
    const targets = [...(nav?.[0] ?? "").matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
    expect(targets).toHaveLength(5);
    for (const target of targets) expect(sevag).toContain(`<section id="${target ?? ""}"`);
    // Each section's title is its h2, nothing beside it.
    expect(headingsOf(sevag)).toEqual(titles);
    expect(sevag).not.toMatch(/>[A-E]<\/span><h2|bg-creator-accent[^"]*">[A-E]</);
    // The app bar's title opens the contents as a modal sheet that lists the same sections, in order.
    const bar = /<div class="poster-bar[^"]*"[\s\S]*?<\/dialog>/.exec(sevag)?.[0] ?? "";
    expect(bar).toMatch(/<button type="button" aria-haspopup="dialog"[^>]*>[\s\S]*?Sevag Ghazarian[\s\S]*?Inhalt öffnen<\/span><\/button>/);
    const sheet = /<dialog[^>]*class="lb-sheet"[\s\S]*?<\/dialog>/.exec(bar)?.[0] ?? "";
    expect(sheet).toMatch(/aria-labelledby="([^"]+)"[\s\S]*<h2 id="\1"[^>]*>Inhalt<\/h2>/);
    expect([...sheet.matchAll(/<a href="#([^"]+)"/g)].map((match) => match[1])).toEqual(targets);
    expect(sheet).toContain('aria-label="Schließen"');
    // The bar is solid, shows once the large name has passed under it (BarReveal watches the name),
    // has no reading line and a soft round share button.
    expect(bar).toMatch(/class="poster-bar [^"]*lb-bar bg-creator-bg"/);
    expect(sevag).not.toContain("lb-progress");
    expect(sevag).toMatch(/<h1 data-lb-name="true"/);
    expect(sevag).toMatch(/<\/dialog><button type="button" aria-label="Seite teilen" class="[^"]*rounded-full[^"]*bg-creator-surface-2/);
  });

  it("without a contact block: the hero leads to his cover letter, with 'Teilen' beside it", () => {
    // Nothing is promoted in the compact bar (it has no contact action to repeat).
    expect(sevag).not.toContain("data-bar-action");
    const actions = /<div data-hero-actions[\s\S]*?<\/button>/.exec(sevag)?.[0] ?? "";
    const lead = /<a href="#section-letter-title"[^>]*>[\s\S]*?<\/a>/.exec(actions)?.[0] ?? "";
    expect(text(lead)).toBe("Anschreiben lesen");
    // One filled button (the first action) and the share button in a soft grey fill (no outline), both 48 px pills.
    expect(lead).toMatch(/bg-creator-accent[^"]*text-creator-accent-fg/);
    const share = /<button[^>]*>[\s\S]*?<\/button>/.exec(actions)?.[0] ?? "";
    // Its visible label is its name, and stays "Teilen" while the address is copied (WCAG 2.5.3).
    expect(share).not.toContain("aria-label");
    expect(text(share)).toBe("Teilen");
    expect(share).toContain("bg-creator-surface-2");
    expect(share).not.toMatch(/\bborder\b/);
    for (const control of [lead, share]) expect(control).toMatch(/min-h-control-lg[^"]*rounded-creator-button|rounded-creator-button[^"]*min-h-control-lg/);
    expect(count(/<header[\s\S]*?<\/header>/.exec(sevag)?.[0] ?? "", /<a [^>]*bg-creator-accent/g)).toBe(1);
    // A polite live region announces the copied link where the page has no share sheet.
    expect(sevag).toMatch(/<span role="status" class="sr-only"><\/span>/);
  });

  it("sets the letter as a reading tile with its reading time: two paragraphs, then the rest behind a native disclosure", () => {
    const letter = sevagDe.blocks.find((block): block is BlockOf<"text"> => block.type === "text" && block.id === "letter");
    const paragraphs = letter?.text.split("\n\n") ?? [];
    expect(paragraphs).toHaveLength(7);
    expect(sevag).toContain("1 Min. Lesezeit");
    // The signature keeps its line break.
    expect(sevag).toMatch(/whitespace-pre-line[^"]*">Mit freundlichen Grüßen\nSevag Ghazarian<\/p>/);
    const section = /<section id="section-letter-title"[\s\S]*?<\/section>/.exec(sevag)?.[0] ?? "";
    const [before, details] = section.split("<details");
    expect(count(before ?? "", /<p dir="auto"/g)).toBe(2);
    expect(details).toMatch(/^ class="lb-more /);
    // Its label says what opens ("Weniger anzeigen" shows once it is open).
    expect(text(/<summary[\s\S]*?<\/summary>/.exec(details ?? "")?.[0] ?? "")).toBe("Ganzes Anschreiben lesenWeniger anzeigen");
    expect(count(details ?? "", /<p dir="auto"/g)).toBe(5);
    // The short text about toning is a note (a callout with its icon), not a reading tile.
    expect(count(sevag, /Lesezeit/g)).toBe(1);
    const toning = /<section id="section-toning-title"[\s\S]*?<\/section>/.exec(sevag)?.[0] ?? "";
    expect(toning).toContain("lb-soft");
    expect(toning).toContain("lucide-paint-bucket");
    expect(toning).not.toContain("<details");
  });

  it("lists the skills on one soft sheet without lines: one a row on phones, an icon and the whole label, nothing that looks pressable", () => {
    const skills = /<section id="section-skills"[\s\S]*?<\/section>/.exec(sevag)?.[0] ?? "";
    const list = /<ul class="([^"]*)"/.exec(skills)?.[1] ?? "";
    // One sheet in the surface colour (a step in the fill): no frame, no rules between the rows.
    expect(list).toMatch(/^grid min-w-0 grid-cols-1 [^"]*rounded-creator-card bg-creator-surface [^"]*@prose:grid-cols-2/);
    expect(list).not.toMatch(/\bborder\b|\bgap-px\b|bg-creator-line/);
    const rows = [...skills.matchAll(/<li class="([^"]*)"[^>]*>([\s\S]*?)<\/li>/g)];
    const items = sevagDe.blocks.find((block): block is BlockOf<"tools"> => block.type === "tools")?.items ?? [];
    expect(rows.map(([, , inner]) => text(inner ?? ""))).toEqual(items);
    for (const [, classes, inner] of rows) {
      expect(inner).toMatch(/^<svg[^>]*class="lucide lucide-/);
      // A row of the list: no frame or rule of its own, no hover, at least 48 px.
      expect(classes).toMatch(/\bflex\b[^"]*\bmin-h-control-lg\b/);
      expect(classes).not.toMatch(/\bborder|hover:/);
    }
    // Whole words: no soft hyphens put in, no automatic hyphenation, never numbered.
    expect(skills).not.toContain("\u00AD");
    expect(skills).not.toContain("hyphens-auto");
    expect(skills).toContain("hyphens-manual");
    expect(skills).not.toMatch(/>0\d</);
  });

  it("sets '\u00DCber mich' as Werkbogen does: the lead, then a drawn placeholder portrait beside the facts, then the rest", () => {
    const about = /<section id="section-about"[\s\S]*?<\/section>/.exec(sevag)?.[0] ?? "";
    // The placeholder until his own photo: a drawn still of the library, never his header's own clip.
    const block = sevagDe.blocks.find((entry): entry is BlockOf<"about"> => entry.type === "about");
    const clip = MOTION_LIBRARY.find((entry) => entry.poster === block?.portrait?.src);
    expect(clip?.key).toBe("ware-scannen");
    expect(clip?.kind).toBe("illustration");
    expect(block?.portrait).toMatchObject({ alt: clip?.alt.de, w: clip?.w, h: clip?.h });
    expect(block?.portrait?.alt).toMatch(/^Illustration: /);
    expect(block?.portrait?.src).not.toBe(sevagDe.profile.hero?.src);
    expect(about).toContain(`alt="${clip?.alt.de ?? "?"}"`);
    // Lead, portrait row, rest: in this order.
    const lead = about.indexOf("In meiner aktuellen Position");
    const row = about.indexOf("data-about-portrait");
    const restAt = about.indexOf("Das sichere Ein- und Auslagern");
    expect(lead).toBeGreaterThan(0);
    expect(row).toBeGreaterThan(lead);
    expect(restAt).toBeGreaterThan(row);
    // The facts in the same row as the portrait, beside it (no breakpoint: phones too), each row under a hairline.
    expect(about).toMatch(/data-about-portrait="true" class="grid min-w-0 grid-cols-5 /);
    const facts = /<dl class="([^"]*)"[\s\S]*?<\/dl>/.exec(about);
    expect(facts?.[1]).toMatch(/^col-span-3 grid min-w-0 grid-cols-1/);
    expect(facts?.[1]).not.toContain("bg-creator-surface");
    expect(count(facts?.[0] ?? "", /border-t border-creator-line/g)).toBe(4);
    expect(facts?.[0]).not.toContain("\u00AD");
    expect(text(facts?.[0] ?? "")).toContain("vor allem Seitenschubstapler");
  });

  it("keeps the facts on one soft sheet without lines when '\u00DCber mich' has no portrait, and the timeline's licence on its node", () => {
    const bare: Page = { ...sevagDe, blocks: sevagDe.blocks.map((block) => (block.type === "about" ? { ...block, portrait: undefined } : block)) };
    const facts = /<dl class="([^"]*)"[\s\S]*?<\/dl>/.exec(/<section id="section-about"[\s\S]*?<\/section>/.exec(render(bare, sevagTheme))?.[0] ?? "");
    expect(facts?.[1]).toMatch(/^grid min-w-0 grid-cols-1 [^"]*rounded-creator-card bg-creator-surface [^"]*@prose:grid-cols-2/);
    expect(facts?.[0]).not.toMatch(/\bborder|\bgap-px\b|bg-creator-line/);
    expect(facts?.[0]).not.toContain("\u00AD");
    expect(text(facts?.[0] ?? "")).toContain("vor allem Seitenschubstapler");
    const timeline = /<section id="section-path"[\s\S]*?<\/section>/.exec(sevag)?.[0] ?? "";
    expect([...timeline.matchAll(/class="lucide lucide-([a-z-]+)/g)].map((match) => match[1])).toEqual(["id-card", "briefcase"]);
  });

  it("is flat and unlined: no shadow, no underline, no rule above the sections or between the hero's numbers", () => {
    expect(sevag).not.toMatch(/\b(?:shadow-(?!none)|drop-shadow|underline|decoration-)/);
    for (const section of sevag.match(/<section id="[^"]*"[^>]*class="[^"]*"/g) ?? []) expect(section).not.toMatch(/\bborder-t\b/);
    const numbers = /<header[\s\S]*?<\/header>/.exec(sevag)?.[0].match(/<dl class="[^"]*"[\s\S]*?<\/dl>/)?.[0] ?? "";
    expect(numbers).toContain("seit 2018");
    expect(numbers).not.toMatch(/\bborder/);
    // One soft sheet for the three numbers; no hyphen is ever put into a label.
    expect(numbers).toMatch(/^<dl class="[^"]*rounded-creator-card bg-creator-surface/);
    expect(numbers).not.toContain("hyphens-auto");
  });
});

describe("the same page once a contact block is added (fixture only)", () => {
  const withContact: Page = { ...sevagDe, blocks: [...sevagDe.blocks, contact] };
  const markup = render(withContact, sevagTheme);

  it("puts the contact block's primary action first in the hero, 'Teilen' beside it and the CV below, quietly", () => {
    const row = /<div data-hero-actions[\s\S]*?Lebenslauf \(PDF\)<\/span><\/a>/.exec(markup)?.[0] ?? "";
    expect(text(row)).toBe("Ab sofort verfügbarGespräch vereinbarenTeilenLebenslauf (PDF)");
    expect(row).toContain('href="mailto:bewerbung@example.com"');
    // The letter is no longer the first action: the contact block's is.
    expect(row).not.toContain('href="#section-letter-title"');
    // Exactly one filled button in the hero.
    const hero = /<header[\s\S]*?<\/header>/.exec(markup)?.[0] ?? "";
    expect(count(hero, /<a [^>]*bg-creator-accent/g)).toBe(1);
    // The compact bar says the same words; the band closes the page under its own heading.
    expect(text(/<a [^>]*data-bar-action[\s\S]*?<\/a>/.exec(markup)?.[0] ?? "")).toBe("Gespräch vereinbaren");
    expect(markup).toMatch(/<h2[^>]*>Lassen Sie uns sprechen<\/h2>/);
    // The band is no titled section: the index keeps its five entries.
    expect(count(/<nav aria-label="Abschnitte"[\s\S]*?<\/nav>/.exec(markup)?.[0] ?? "", /<li/g)).toBe(5);
  });
});

describe("without any picture", () => {
  const bare: Page = {
    ...sevagDe,
    profile: { ...sevagDe.profile, hero: undefined },
    blocks: sevagDe.blocks.map((block) => (block.type === "about" ? { ...block, portrait: undefined } : block)),
  };
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
    const titles = (markup: string) => headingsOf(markup).map((title) => title.replace(/^\d{2}/, ""));
    const laufbahn = render(page);
    expect(titles(laufbahn)).toEqual(titles(render(page, { template: "tiefdruck" })));
    // Projects keep their cards (each one the anchor the way back from its page lands on).
    for (const slug of ["hafenlicht", "stadtbad", "termine"]) expect(laufbahn).toContain(`id="${slug}"`);
  });

  it("changes nothing for any other template", () => {
    for (const template of ["nocturne", "werkbogen", "tiefdruck", "studio"] as const) {
      const markup = render(sevagDe, { template });
      expect(markup, template).not.toMatch(/lb-(?:plate|scrim|veil|name|ground|section|soft|more|step|reveal|zoom|sheet|bar|progress)/);
      expect(markup, template).not.toContain("<dialog");
      expect(markup, template).not.toContain('aria-label="Abschnitte"');
    }
  });
});

describe("Arabic pages", () => {
  const page = portfolioSample("ar");
  const markup = render(page);

  it("are right to left, with their contents in Arabic and the Arabic word for 'until now'", () => {
    expect(markup).toContain('<div lang="ar" dir="rtl"');
    const nav = /<nav aria-label="الأقسام"[\s\S]*?<\/nav>/.exec(markup)?.[0] ?? "";
    expect(count(nav, /<li/g)).toBe(6);
    expect(markup).toMatch(/<h2 id="[^"]+"[^>]*>المحتويات<\/h2>/);
    expect(markup).toContain('aria-label="إغلاق"');
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
  it("shows them before the first titled section, without a heading of their own", () => {
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
  it("nothing in the content moves as the page scrolls: no rising sections, rows or steps, no zooming picture", () => {
    const blocks: Block[] = [
      { ...base, id: "skills", type: "header", title: "Können" },
      { ...base, id: "note", type: "text", text: "Was ich am liebsten tue." },
      { ...base, id: "tools", type: "tools", items: ["Stapler", "SAP"] },
    ];
    for (const markup of [sevag, render({ ...sevagDe, blocks })]) {
      expect(markup).not.toMatch(/\blb-(?:reveal|zoom|progress)\b/);
      expect(markup).not.toMatch(/\bposter-reveal\b/);
    }
  });

  it("the header's picture and clip drift a little slower than the page, as an app's header does", () => {
    const plate = /<div data-hero-plate="true"[^>]*>([\s\S]*?)<\/div>/.exec(sevag)?.[1] ?? "";
    expect(plate).toMatch(/^<div class="lb-parallax absolute/);
    expect(plate).toContain("<video");
  });
});

describe("a portrait as the only picture (no separate hero picture)", () => {
  const markup = render(portfolioSample("en"));

  it("rides high in a square on phones and fades into an ink ground, so the words stand below the face", () => {
    expect(markup).toMatch(/data-hero-plate="true" class="[^"]*lb-ground @work:bg-creator-surface-2/);
    expect(markup).toContain("absolute inset-x-0 top-0 aspect-square mask-b-from-60% mask-b-to-100% @work:inset-0 @work:aspect-auto @work:mask-none");
    // The role line follows the name, with no portrait or initials beside it.
    expect(markup).toMatch(/<\/h1><\/div><p class="[^"]*text-body[^"]*"[^>]*><span dir="auto"/);
  });
});

describe("'About' with a portrait (fictional owner)", () => {
  const about = (portrait: BlockOf<"about">["portrait"], words: string, facts: [string, string][]): string =>
    renderToStaticMarkup(
      createElement(LaufbahnAbout, {
        block: { ...base, id: "about", type: "about", title: "Über mich", text: words, ...(portrait ? { portrait } : {}), facts: facts.map(([label, value]) => ({ label, value })) },
      }),
    );
  const lead = "Ich baue seit zwölf Jahren Bühnen für kleine Theater im Allgäu und in Oberschwaben.";
  const words = `${lead} Am liebsten mit Holz.\n\nIn der Werkstatt bin ich jeden Morgen um sieben.`;
  // A first paragraph longer than a lead: it leads with its first sentence, the rest opens the body.
  const more = "Am liebsten mit Holz, mit Stahl und mit Stoff, und am allerliebsten dann, wenn am Abend der Vorhang aufgeht und keiner mehr an die Bühne denkt.";
  const long = `${lead} ${more}\n\nIn der Werkstatt bin ich jeden Morgen um sieben.`;
  const facts: [string, string][] = [
    ["Wohnort", "Kempten"],
    ["Sprachen", "Deutsch, Englisch"],
  ];
  const german = about({ src: "sample:mila-hero", alt: "Ines Beispiel im Porträt", focal: [0.5, 0.3] }, long, facts);
  const arabic = about({ src: "sample:nour-hero", alt: "صورة شخصية لنور حداد" }, "أصمم المسارح الصغيرة منذ اثني عشر عاماً.\n\nأعمل في الورشة كل صباح.", [["المدينة", "بيروت"]]);

  it("leads with the first paragraph, then the portrait on two of five columns at the start, the facts on three beside it, then the rest", () => {
    const parts =
      /^<div class="grid min-w-0 gap-6 @prose:gap-8"><p[^>]*>([\s\S]*?)<\/p><div data-about-portrait="true" class="([^"]*)"><div class="([^"]*)">(<img[^>]*>)[\s\S]*?<\/div><dl class="([^"]*)">([\s\S]*?)<\/dl><\/div><div class="grid max-w-prose gap-4">([\s\S]*?)<\/div><\/div>$/.exec(
        german,
      );
    expect(parts).not.toBeNull();
    const [, first, row, frame, image, list, rows, rest] = parts ?? [];
    expect(first).toBe(lead);
    // Side by side at every width from 320 px up: the row has no breakpoint before its five columns.
    expect(row).toBe("grid min-w-0 grid-cols-5 items-start gap-x-4 @prose:gap-x-6");
    expect(frame).toBe("relative col-span-2 aspect-portrait overflow-hidden rounded-creator-card bg-creator-surface-2");
    expect(image).toContain('alt="Ines Beispiel im Porträt"');
    expect(list).toBe("col-span-3 grid min-w-0 grid-cols-1 content-start");
    // Each fact under a hairline: the label quiet over its value, in bold.
    const items = [...(rows ?? "").matchAll(/<div class="([^"]*)"><dt[^>]*class="([^"]*)"[^>]*>([^<]*)<\/dt><dd[^>]*class="([^"]*)"[^>]*>([^<]*)<\/dd><\/div>/g)];
    expect(items.map((item) => [item[3], item[5]])).toEqual(facts);
    for (const [, item, label, , value] of items) {
      expect(item).toContain("border-t border-creator-line");
      expect(label).toContain("text-creator-fg-muted");
      expect(value).toContain("font-semibold");
      expect(value).toContain("hyphens-manual");
    }
    expect(text(rest ?? "")).toBe(`${more}In der Werkstatt bin ich jeden Morgen um sieben.`);
  });

  it("mirrors in Arabic by the page's direction alone (logical order, no physical sides), flat and unlined", () => {
    // The portrait comes first in the reading order, so it stands at the start: on the right in Arabic.
    expect(arabic.indexOf("<img")).toBeGreaterThan(0);
    expect(arabic.indexOf("<img")).toBeLessThan(arabic.indexOf("<dl"));
    expect(arabic).toContain('alt="صورة شخصية لنور حداد"');
    for (const markup of [german, arabic]) {
      expect(markup).not.toMatch(/\b(?:left|right|ml|mr|pl|pr|text-left|text-right|float)-/);
      expect(markup).not.toMatch(/\b(?:shadow-(?!none)|drop-shadow|underline|decoration-)/);
      expect(markup).not.toMatch(/\banimate-|\blb-(?:reveal|zoom)\b/);
    }
  });

  it("keeps today's layout exactly without a portrait: the lead, the facts on one soft sheet, the rest", () => {
    const markup = about(undefined, words, facts);
    expect(markup).not.toContain("data-about-portrait");
    expect(markup).not.toContain("<img");
    // Recorded from the renderer before the portrait layout existed.
    expect(markup).toMatchInlineSnapshot(`"<div class="grid min-w-0 gap-6 @prose:gap-8"><div class="grid min-w-0 items-start gap-6"><p dir="auto" class="[text-align:-webkit-match-parent] supports-[text-align:match-parent]:[text-align:match-parent] max-w-prose text-title leading-normal font-medium text-pretty whitespace-pre-line text-creator-fg rtl:tracking-normal @prose:text-h3 @prose:leading-snug @work:text-h2 @prose:rtl:leading-normal">Ich baue seit zwölf Jahren Bühnen für kleine Theater im Allgäu und in Oberschwaben. Am liebsten mit Holz.</p></div><dl class="grid min-w-0 grid-cols-1 gap-x-6 gap-y-4 rounded-creator-card bg-creator-surface p-4 @prose:grid-cols-2 @prose:gap-y-5 @prose:p-6"><div class="grid min-w-0 grid-cols-1 content-start gap-1"><dt dir="auto" class="[text-align:-webkit-match-parent] supports-[text-align:match-parent]:[text-align:match-parent] text-small text-creator-fg-muted">Wohnort</dt><dd dir="auto" class="[text-align:-webkit-match-parent] supports-[text-align:match-parent]:[text-align:match-parent] text-body leading-snug font-semibold text-pretty hyphens-manual break-words">Kempten</dd></div><div class="grid min-w-0 grid-cols-1 content-start gap-1"><dt dir="auto" class="[text-align:-webkit-match-parent] supports-[text-align:match-parent]:[text-align:match-parent] text-small text-creator-fg-muted">Sprachen</dt><dd dir="auto" class="[text-align:-webkit-match-parent] supports-[text-align:match-parent]:[text-align:match-parent] text-body leading-snug font-semibold text-pretty hyphens-manual break-words">Deutsch, Englisch</dd></div></dl><div class="grid max-w-prose gap-4"><p dir="auto" class="[text-align:-webkit-match-parent] supports-[text-align:match-parent]:[text-align:match-parent] text-body text-pretty whitespace-pre-line text-creator-fg @prose:text-body-lg">In der Werkstatt bin ich jeden Morgen um sieben.</p></div></div>"`);
  });
});
