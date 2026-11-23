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

import { signposts } from "./laufbahn";
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
    expect(sevag).toMatch(/<h1 class="[^"]*\blb-name\b/);
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
    // The bar is solid, with the reading line along its foot.
    expect(bar).toMatch(/class="poster-bar [^"]*lb-bar bg-creator-bg"/);
    expect(sevag).toMatch(/<\/dialog>[\s\S]*?<span aria-hidden="true" class="lb-progress /);
  });

  it("without a contact block: the hero leads to his cover letter, with 'Teilen' beside it", () => {
    // Nothing is promoted in the compact bar (it has no contact action to repeat).
    expect(sevag).not.toContain("data-bar-action");
    const actions = /<div data-hero-actions[\s\S]*?<\/button>/.exec(sevag)?.[0] ?? "";
    const lead = /<a href="#section-letter-title"[^>]*>[\s\S]*?<\/a>/.exec(actions)?.[0] ?? "";
    expect(text(lead)).toBe("Anschreiben lesen");
    // One filled button (the first action) and the outlined share button, both 48 px with the page's button radius.
    expect(lead).toMatch(/bg-creator-accent[^"]*text-creator-accent-fg/);
    const share = /<button[^>]*>[\s\S]*?<\/button>/.exec(actions)?.[0] ?? "";
    // Its visible label is its name, and stays "Teilen" while the address is copied (WCAG 2.5.3).
    expect(share).not.toContain("aria-label");
    expect(text(share)).toBe("Teilen");
    expect(share).toContain("border-creator-line-strong");
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

  it("lists the skills like a settings screen: one a row on phones, an icon and the whole label, nothing that looks pressable", () => {
    const skills = /<section id="section-skills"[\s\S]*?<\/section>/.exec(sevag)?.[0] ?? "";
    const list = /<ul class="([^"]*)"/.exec(skills)?.[1] ?? "";
    expect(list).toMatch(/^grid min-w-0 grid-cols-1 gap-px [^"]*rounded-creator-card border border-creator-line bg-creator-line @prose:grid-cols-2/);
    const rows = [...skills.matchAll(/<li class="([^"]*)"[^>]*>([\s\S]*?)<\/li>/g)];
    const items = sevagDe.blocks.find((block): block is BlockOf<"tools"> => block.type === "tools")?.items ?? [];
    expect(rows.map(([, , inner]) => text(inner ?? ""))).toEqual(items);
    for (const [, classes, inner] of rows) {
      expect(inner).toMatch(/^<svg[^>]*class="lucide lucide-/);
      // A row of the list: no frame of its own, no hover, at least 48 px.
      expect(classes).toMatch(/\bflex\b[^"]*\bmin-h-control-lg\b[^"]*\bbg-creator-surface\b/);
      expect(classes).not.toMatch(/\bborder\b|hover:/);
    }
    // Whole words: no soft hyphens put in, no automatic hyphenation, never numbered.
    expect(skills).not.toContain("\u00AD");
    expect(skills).not.toContain("hyphens-auto");
    expect(skills).toContain("hyphens-manual");
    expect(skills).not.toMatch(/>0\d</);
  });

  it("sets the facts as a grouped list with whole words, and the timeline's licence on its node", () => {
    const facts = /<dl class="([^"]*)"[\s\S]*?<\/dl>/.exec(/<section id="section-about"[\s\S]*?<\/section>/.exec(sevag)?.[0] ?? "");
    expect(facts?.[1]).toMatch(/^grid min-w-0 grid-cols-1 gap-px [^"]*@prose:grid-cols-2/);
    expect(facts?.[0]).not.toContain("\u00AD");
    expect(text(facts?.[0] ?? "")).toContain("vor allem Seitenschubstapler");
    const timeline = /<section id="section-path"[\s\S]*?<\/section>/.exec(sevag)?.[0] ?? "";
    expect([...timeline.matchAll(/class="lucide lucide-([a-z-]+)/g)].map((match) => match[1])).toEqual(["id-card", "briefcase"]);
  });

  it("is flat and unlined: no shadow, no underline", () => {
    expect(sevag).not.toMatch(/\b(?:shadow-(?!none)|drop-shadow|underline|decoration-)/);
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
  const skillList = (markup: string) => /<ul class="(grid min-w-0 grid-cols-1 gap-px[^"]*)">([\s\S]*?)<\/ul>/.exec(markup);
  const rows = (markup: string) => [...(skillList(markup)?.[2] ?? "").matchAll(/<li class="([^"]*)"/g)].map((match) => match[1] ?? "");

  it("skills in a section of their own rise in once, as one list", () => {
    expect(rows(sevag)).toHaveLength(12);
    expect(skillList(sevag)?.[1]).toContain("lb-reveal");
    expect(rows(sevag).some((row) => row.includes("lb-reveal"))).toBe(false);
  });

  it("skills sharing a section with other blocks rise once with the section, never twice", () => {
    const blocks: Block[] = [
      { ...base, id: "skills", type: "header", title: "Können" },
      { ...base, id: "note", type: "text", text: "Was ich am liebsten tue." },
      { ...base, id: "tools", type: "tools", items: ["Stapler", "SAP"] },
    ];
    const markup = render({ ...sevagDe, blocks });
    expect(rows(markup)).toHaveLength(2);
    expect(skillList(markup)?.[1]).not.toContain("lb-reveal");
    expect(rows(markup).some((row) => row.includes("lb-reveal"))).toBe(false);
    expect(markup).toMatch(/<div class="grid min-w-0 grid-cols-1 gap-6 lb-reveal">/);
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
