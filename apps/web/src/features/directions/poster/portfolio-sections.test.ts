import { primaryAction, type Block, type BlockOf, type Page } from "@linkyo/blocks";
import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { NextIntlClientProvider } from "next-intl";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EXAMPLES } from "@/features/examples/catalog";
import { LOOKS, type Look } from "@/features/examples/looks";
import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { AboutSection, BrandNames, ContactBand, QuotesSection, TimelineSection, ToolsSection } from "./portfolio-sections";
import { PosterRenderer } from "./renderer";

// The portfolio's sections rendered to HTML in Node (no browser, no testing library): what each
// section promises is in the markup.

// The app's localized navigation needs Next's router, which Node alone does not have; links render plain.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: unknown }) => createElement("a", { href, ...rest }, children as never),
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  usePathname: () => "/",
}));

type Locale = "de" | "en" | "ar";
const MESSAGES = { de, en, ar };

/** Renders an element with the app's messages, as the layout's provider does. */
const html = (element: ReactNode, locale: Locale = "de"): string =>
  renderToStaticMarkup(createElement(NextIntlClientProvider, { locale, messages: MESSAGES[locale], timeZone: "Europe/Berlin", children: element }));

const count = (markup: string, pattern: RegExp): number => markup.match(pattern)?.length ?? 0;
/** The text a visitor reads, without tags. */
const text = (markup: string): string => markup.replace(/<[^>]+>/g, "");

const base = { visible: true, highlight: false } as const;
const NOW = new Date("2026-11-23T12:00:00Z");

const project = (id: string, slug: string, title: string): BlockOf<"project"> => ({ ...base, id, type: "project", slug, title, summary: "Ein Satz." });

const about: BlockOf<"about"> = {
  ...base,
  id: "about-1",
  type: "about",
  title: "Über mich",
  text: "Der erste Absatz führt ein.\n\nDer zweite Absatz erzählt weiter.\n\nUnd ein dritter.",
  portrait: { src: "sample:ex-pf-jorinde-01", alt: "Porträt in der Werkstatt", w: 1280, h: 1600 },
  facts: [
    { label: "Sitz", value: "Freiburg" },
    { label: "Sprachen", value: "Deutsch, Englisch" },
  ],
};

const timeline: BlockOf<"timeline"> = {
  ...base,
  id: "timeline-1",
  type: "timeline",
  title: "Erfahrung",
  items: [
    { role: "Eigene Werkstatt", years: { from: 2015, to: "now" }, note: "Möbel nach Maß" },
    { role: "Gesellin", org: "Eine Möbelwerkstatt", years: { from: 2006, to: 2011 }, url: "https://example.com/werkstatt" },
    { role: "Meisterschule", org: "Eine Schule", years: { from: 2012 } },
  ],
};

const quote = (name: string, extra: Partial<BlockOf<"quotes">["items"][number]> = {}): BlockOf<"quotes">["items"][number] => ({
  text: `Ein Satz von ${name}.`,
  name,
  role: "Kundin",
  consent: true,
  ...extra,
});

const quotes = (items: BlockOf<"quotes">["items"]): BlockOf<"quotes"> => ({ ...base, id: "quotes-1", type: "quotes", title: "Kundenstimmen", items });

const contact: BlockOf<"contact"> = {
  ...base,
  id: "contact-1",
  type: "contact",
  title: "Erzählen Sie mir von Ihrem Raum.",
  text: "Das erste Gespräch kostet nichts.",
  status: "Frei ab März 2027",
  statusUntil: "2027-02-28",
  primary: { label: "Projekt anfragen", url: "mailto:werkstatt@example.com", icon: "mail" },
  links: [
    { kind: "email", url: "mailto:hello@example.com" },
    { kind: "phone", url: "tel:+49300000000" },
    { kind: "cv", url: "https://example.com/jorinde/lebenslauf.pdf" },
  ],
  steps: ["Besuch mit Aufmaß", "Zeichnung und Festpreis", "Bau und Einbau"],
};

describe("about", () => {
  it("shows the facts as a definition list and the portrait with its description", () => {
    const markup = html(createElement(AboutSection, { block: about, wide: true }));
    expect(count(markup, /<dl\b/g)).toBe(1);
    expect(count(markup, /<dt\b/g)).toBe(2);
    expect(count(markup, /<dd\b/g)).toBe(2);
    expect(markup).toMatch(/<dt[^>]*>Sitz<\/dt><dd[^>]*>Freiburg<\/dd>/);
    expect(markup).toContain('alt="Porträt in der Werkstatt"');
    // Three paragraphs, split at the blank lines; the first is the lead.
    expect(count(markup, /<p\b/g)).toBe(3);
    expect(markup.indexOf("Der erste Absatz")).toBeLessThan(markup.indexOf("<dl"));
    expect(markup.indexOf("<dl")).toBeLessThan(markup.indexOf("Der zweite Absatz"));
  });

  it("sets the lead in the display face only where the template asks for it", () => {
    const lead = (markup: string) => /<p[^>]*class="([^"]*)"[^>]*>Der erste Absatz/.exec(markup)?.[1] ?? "";
    expect(lead(html(createElement(AboutSection, { block: about, wide: true, lead: "display" })))).toContain("font-creator-display");
    const body = lead(html(createElement(AboutSection, { block: about, wide: true })));
    expect(body).toContain("text-body-lg");
    expect(body).not.toContain("font-creator-display");
  });

  it("the page passes its template's lead face and the sample route's query on to the sections", () => {
    const quoteBlock = quotes([quote("M. R.", { project: "project-1" })]);
    const page: Page = {
      profile: { username: "jorinde", displayName: "Jorinde Ahlfeld", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale: "de" },
      blocks: [project("project-1", "kueche", "Küche in Nussbaum"), about, quoteBlock],
    };
    const render = (template: "werkbogen" | "tiefdruck") =>
      html(createElement(PosterRenderer, { page, theme: resolveCreatorTheme({ template }), projectBase: "/de/directions/poster/work", projectSuffix: `?chrome=0&template=${template}` }));
    const lead = (markup: string) => /<p[^>]*class="([^"]*)"[^>]*>Der erste Absatz/.exec(markup)?.[1] ?? "";
    expect(lead(render("werkbogen"))).toContain("font-creator-display");
    expect(lead(render("tiefdruck"))).not.toContain("font-creator-display");
    expect(lead(render("tiefdruck"))).toContain("text-body-lg");
    // The quote's project link keeps the query, like every card of the page.
    expect(render("tiefdruck")).toMatch(/<figcaption[^>]*>(?:(?!<\/figcaption>).)*href="\/de\/directions\/poster\/work\/kueche\?chrome=0&amp;template=tiefdruck"/);
  });

  it("keeps the phone layout at every width on templates with the narrow column", () => {
    const narrow = html(createElement(AboutSection, { block: about, wide: false }));
    const wide = html(createElement(AboutSection, { block: about, wide: true }));
    expect(narrow).not.toContain("@work:");
    expect(wide).toContain("@work:grid-cols-12");
    // The portrait asks for a file that fits its box: a third of the column, a third of the wide canvas.
    expect(narrow).toContain('sizes="(max-width: 640px) 33vw, 187px"');
    expect(wide).toContain('sizes="(min-width: 1120px) 373px, (max-width: 640px) 33vw, 187px"');
  });

  it("renders text alone when there is neither portrait nor facts", () => {
    const { portrait: _portrait, facts: _facts, ...plain } = about;
    const markup = html(createElement(AboutSection, { block: plain, wide: false }));
    expect(markup).not.toContain("<dl");
    expect(markup).not.toContain("<img");
    expect(text(markup)).toContain("Und ein dritter.");
  });
});

describe("tools", () => {
  it("is a list of plain chips: no links, no buttons", () => {
    const block: BlockOf<"tools"> = { ...base, id: "tools-1", type: "tools", title: "Werkstoffe", items: ["Nussbaum", "Eiche", "Birke Multiplex"] };
    const markup = html(createElement(ToolsSection, { block }));
    expect(count(markup, /<ul\b/g)).toBe(1);
    expect(count(markup, /<li\b/g)).toBe(3);
    expect(markup).not.toMatch(/<a\b|<button\b/);
    expect(text(markup)).toBe("NussbaumEicheBirke Multiplex");
  });
});

describe("timeline", () => {
  it("is an ordered list in the order entered, each range of years in one bdi", () => {
    const markup = html(createElement(TimelineSection, { block: timeline, locale: "de" }));
    expect(count(markup, /<ol\b/g)).toBe(1);
    expect(count(markup, /<li\b/g)).toBe(3);
    expect(markup.indexOf("Eigene Werkstatt")).toBeLessThan(markup.indexOf("Gesellin"));
    expect([...markup.matchAll(/<bdi[^>]*>([^<]*)<\/bdi>/g)].map((match) => match[1])).toEqual(["2015–heute", "2006–2011", "2012"]);
  });

  it("links an organisation that has an address and prints the others as text", () => {
    const markup = html(createElement(TimelineSection, { block: timeline, locale: "de" }));
    expect(count(markup, /<a\b/g)).toBe(1);
    expect(markup).toMatch(/<a href="https:\/\/example\.com\/werkstatt"[^>]*>.*Eine Möbelwerkstatt/);
    expect(markup).toMatch(/<p[^>]*>Eine Schule<\/p>/);
  });

  it("links an address without an organisation by its host", () => {
    const block: BlockOf<"timeline"> = { ...timeline, items: [{ role: "Freelance", years: { from: 2020 }, url: "https://www.example.com/studio" }] };
    const markup = html(createElement(TimelineSection, { block, locale: "de" }));
    expect([...markup.matchAll(/<a href="([^"]*)"/g)].map((match) => match[1])).toEqual(["https://www.example.com/studio"]);
    expect(markup).toMatch(/<a href="https:\/\/www\.example\.com\/studio"[^>]*><bdi dir="ltr"[^>]*>example\.com<\/bdi>/);
  });

  it("says “until now” in the page's language, with Latin digits", () => {
    const markup = html(createElement(TimelineSection, { block: timeline, locale: "ar" }), "ar");
    // Every range runs in the page's direction, so "2015–2021" and "2021–now" both start on the start side.
    expect([...markup.matchAll(/<bdi dir="([a-z]+)">/g)].map((match) => match[1])).toEqual(["rtl", "rtl", "rtl"]);
    expect(text(markup)).toContain("2015–الآن");
    expect(markup).not.toMatch(/[٠-٩]/);
  });
});

describe("quotes", () => {
  const projects = [project("project-1", "kueche", "Küche in Nussbaum"), project("project-2", "regal", "Regalwand")];

  it("each quote is a figure with a blockquote and a caption", () => {
    const markup = html(createElement(QuotesSection, { block: quotes([quote("M. R."), quote("T. K.")]), ownerName: "Jorinde Ahlfeld", projects, base: "/de/p/jorinde-ahlfeld", wide: true }));
    expect(count(markup, /<figure\b/g)).toBe(2);
    expect(count(markup, /<blockquote\b/g)).toBe(2);
    expect(count(markup, /<figcaption\b/g)).toBe(2);
    expect(markup).toMatch(/<figcaption[^>]*>.*M\. R\..*Kundin.*<\/figcaption>/);
    // The marks come from CSS by language, never typed into the text.
    expect(markup).toContain("before:content-[open-quote]");
    expect(text(markup)).not.toMatch(/[„“”«»]/);
  });

  it("always ends with one line that says who chose the quotes, in the page's language", () => {
    const block = quotes([quote("A"), quote("B"), quote("C"), quote("D")]);
    const german = html(createElement(QuotesSection, { block, ownerName: "Jorinde Ahlfeld", projects, wide: false }), "de");
    const note = "Von Jorinde Ahlfeld ausgewählt und mit Einverständnis veröffentlicht. Linkyo prüft diese Stimmen nicht.";
    expect(text(german).split(note)).toHaveLength(2);
    expect(text(german).endsWith(note)).toBe(true);
    const arabic = html(createElement(QuotesSection, { block, ownerName: "نايا الدباس", projects: [], wide: true }), "ar");
    expect(text(arabic).split("من اختيار نايا الدباس، ونُشرت بموافقة أصحابها. لا يتحقق Linkyo من صحتها.")).toHaveLength(2);
    const english = html(createElement(QuotesSection, { block, ownerName: "Tobin Achterberg", projects: [], wide: true }), "en");
    expect(text(english).split("Chosen by Tobin Achterberg and published with permission. Linkyo does not verify them.")).toHaveLength(2);
  });

  it("a quote about a project of the page links to that project", () => {
    const block = quotes([quote("M. R.", { project: "project-1" }), quote("T. K.", { project: "gone" }), quote("S. T.")]);
    const markup = html(createElement(QuotesSection, { block, ownerName: "Jorinde Ahlfeld", projects, base: "/de/p/jorinde-ahlfeld", wide: true }));
    expect([...markup.matchAll(/<a href="([^"]*)"/g)].map((match) => match[1])).toEqual(["/de/p/jorinde-ahlfeld/kueche"]);
    // The link says where it leads: the words on screen, then the project's title for those who cannot see the quote above.
    expect(text(/<a href="\/de\/p\/jorinde-ahlfeld\/kueche".*?<\/a>/.exec(markup)?.[0] ?? "")).toBe("Zum Projekt: Küche in Nussbaum");
    // A figure's caption is its first or last child (HTML): the link sits inside the caption, at its end.
    expect(count(markup, /<\/figcaption><\/figure>/g)).toBe(count(markup, /<figure\b/g));
    expect(markup).toMatch(/<figcaption[^>]*>(?:(?!<\/figcaption>).)*<a href="\/de\/p\/jorinde-ahlfeld\/kueche"/);
    // The sample route carries its query on every project address.
    const sample = html(createElement(QuotesSection, { block, ownerName: "J", projects, base: "/de/directions/poster/work", suffix: "?chrome=0&template=tiefdruck", wide: true }));
    expect(sample).toContain('href="/de/directions/poster/work/kueche?chrome=0&amp;template=tiefdruck"');
    // A preview has no addresses: the quote stands without a link.
    expect(html(createElement(QuotesSection, { block, ownerName: "J", projects, wide: true }))).not.toContain("<a ");
  });

  it("shows three quotes and keeps further ones in a details element, without script", () => {
    const four = html(createElement(QuotesSection, { block: quotes([quote("A"), quote("B"), quote("C"), quote("D")]), ownerName: "J", projects, wide: true }));
    expect(count(four, /<details\b/g)).toBe(1);
    expect(four).toMatch(/<summary[^>]*>Weitere Stimmen/);
    expect(four.indexOf("Ein Satz von C.")).toBeLessThan(four.indexOf("<details"));
    expect(four.indexOf("Ein Satz von D.")).toBeGreaterThan(four.indexOf("<summary"));
    expect(count(four, /<figure\b/g)).toBe(4);
    const three = html(createElement(QuotesSection, { block: quotes([quote("A"), quote("B"), quote("C")]), ownerName: "J", projects, wide: true }));
    expect(three).not.toContain("<details");
  });

  it("sets a single quote large in the display face and several on fill steps", () => {
    const one = html(createElement(QuotesSection, { block: quotes([quote("A")]), ownerName: "J", projects, wide: true }));
    expect(one).toMatch(/<p[^>]*class="[^"]*font-creator-display[^"]*text-h2[^"]*@work:text-h1/);
    expect(one).not.toContain("bg-creator-surface-2 p-6");
    const two = html(createElement(QuotesSection, { block: quotes([quote("A"), quote("B")]), ownerName: "J", projects, wide: true }));
    expect(two).not.toContain("font-creator-display");
    expect(count(two, /rounded-creator-card bg-creator-surface-2 p-6/g)).toBe(2);
    expect(two).toContain("@work:grid-cols-2");
  });
});

describe("clients", () => {
  const names: BlockOf<"brands"> = {
    ...base,
    id: "brands-1",
    type: "brands",
    title: "Kunden",
    columns: 3,
    items: [{ name: "Magazine" }, { name: "Stiftungen", url: "https://example.com/stiftungen" }, { name: "Museen" }],
  };
  const page = (blocks: Block[]): Page => ({
    profile: { username: "jorinde", displayName: "Jorinde Ahlfeld", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale: "de" },
    blocks,
  });
  const theme = resolveCreatorTheme({ template: "werkbogen" });
  /** The picture box of a partner tile (the grid with logos). */
  const TILE = "relative block aspect-square overflow-hidden rounded-creator-card";

  it("a list of names in the display face, a name with an address stays a link", () => {
    const markup = html(createElement(BrandNames, { block: names }));
    expect(count(markup, /<ul\b/g)).toBe(1);
    expect(count(markup, /<li\b/g)).toBe(3);
    expect(count(markup, /font-creator-display/g)).toBe(3);
    expect(markup).not.toContain("<img");
    expect([...markup.matchAll(/<a href="([^"]*)"/g)].map((match) => match[1])).toEqual(["https://example.com/stiftungen"]);
    // A 44 px target (the type alone is 24 px tall), pulled into the row's own padding.
    expect(markup).toMatch(/<li[^>]*text-h3 leading-tight[^>]*><a href="https:\/\/example\.com\/stiftungen" class="-my-2 [^"]*\bmin-h-touch-target\b/);
  });

  it("the page shows names when no client has a logo and tiles as soon as one has", () => {
    const withoutLogos = html(createElement(PosterRenderer, { page: page([names]), theme, preview: true }));
    expect(count(withoutLogos, /font-creator-display text-h3 leading-tight/g)).toBe(3);
    expect(withoutLogos).not.toContain(TILE);
    const first = names.items[0];
    const withLogo: BlockOf<"brands"> = { ...names, items: [{ name: first?.name ?? "", logo: { src: "sample:ex-pf-tobin-01", alt: "" } }, ...names.items.slice(1)] };
    const tiles = html(createElement(PosterRenderer, { page: page([withLogo]), theme, preview: true }));
    expect(tiles.split(TILE)).toHaveLength(3 + 1);
    // A client without a logo among them shows its initials on a fill step, never a "missing picture" sign.
    expect(count(tiles, /<img\b/g)).toBe(1);
    expect(tiles).not.toContain("lucide-image");
    expect([...tiles.matchAll(/<span aria-hidden="true" class="[^"]*bg-creator-surface-2 text-h2 text-creator-fg-muted">([^<]*)<\/span>/g)].map((match) => match[1])).toEqual(["S", "M"]);
  });

  it("a name runs in its own direction while its hairline stays on the page's start side", () => {
    const markup = html(createElement(BrandNames, { block: names }), "ar");
    // No `dir` on the items (that would turn their borders around): the text alone finds its direction.
    expect(markup).not.toMatch(/<li[^>]*\bdir=/);
    expect(count(markup, /<li[^>]*class="[^"]*border-s[^"]*\[unicode-bidi:plaintext\]/g)).toBe(3);
  });
});

describe("contact band", () => {
  const render = (block: BlockOf<"contact"> = contact, now = NOW, locale: Locale = "de") => html(createElement(ContactBand, { block, now, wide: true }), locale);

  it("the primary action is a plain link with the page's one primary label", () => {
    const markup = render();
    const action = primaryAction([contact], NOW);
    expect(action?.label).toBe("Projekt anfragen");
    const link = /<a href="mailto:werkstatt@example\.com"[^>]*>.*?<\/a>/.exec(markup)?.[0] ?? "";
    expect(text(link)).toBe(action?.label);
    expect(link).toContain("min-h-control-xl");
    expect(markup).not.toContain("<button");
    // A long label (the schema allows 40 characters) wraps; the page's one primary action is never cut.
    expect(link).not.toContain("truncate");
  });

  it("reads title, text, status, then the primary action", () => {
    const markup = render();
    const at = (needle: string) => markup.indexOf(needle);
    expect(at("<h2")).toBeGreaterThan(-1);
    expect(at("Das erste Gespräch kostet nichts.")).toBeGreaterThan(at("<h2"));
    expect(at("Frei ab März 2027")).toBeGreaterThan(at("Das erste Gespräch kostet nichts."));
    expect(at('<a href="mailto:werkstatt@example.com"')).toBeGreaterThan(at("Frei ab März 2027"));
  });

  it("puts the closing line in a heading and labels the band with it", () => {
    const markup = render();
    const id = /<section aria-labelledby="([^"]+)"/.exec(markup)?.[1];
    expect(id).toBeTruthy();
    expect(markup).toContain(`<h2 id="${id ?? ""}"`);
    expect(text(/<h2[^>]*>.*?<\/h2>/.exec(markup)?.[0] ?? "")).toBe("Erzählen Sie mir von Ihrem Raum.");
  });

  it("prints addresses left to right, each in its own bdi", () => {
    const markup = render();
    expect([...markup.matchAll(/<bdi dir="ltr"[^>]*>([^<]*)<\/bdi>/g)].map((match) => match[1])).toEqual(["hello@example.com", "+49300000000", "example.com"]);
    expect(text(markup)).toContain("E-Mail schreiben");
    expect(text(markup)).toContain("Anrufen");
    // Never cut off: a long address wraps under its label instead.
    for (const bdi of markup.match(/<bdi dir="ltr"[^>]*>/g) ?? []) expect(bdi).not.toContain("truncate");
    // Three other ways, each a link of its own.
    expect([...markup.matchAll(/<a href="([^"]*)"/g)].map((match) => match[1])).toEqual([
      "mailto:werkstatt@example.com",
      "mailto:hello@example.com",
      "tel:+49300000000",
      "https://example.com/jorinde/lebenslauf.pdf",
    ]);
  });

  it("prints only the address of an e-mail link that carries a subject", () => {
    const markup = render({ ...contact, links: [{ kind: "email", url: "mailto:hallo@example.com?subject=Anfrage%20Shooting" }] });
    expect([...markup.matchAll(/<bdi dir="ltr"[^>]*>([^<]*)<\/bdi>/g)].map((match) => match[1])).toEqual(["hallo@example.com"]);
  });

  it("says “(PDF)” only when the CV's address ends in .pdf, and keeps the owner's own label", () => {
    expect(text(render())).toContain("Lebenslauf (PDF)");
    const page = { ...contact, links: [{ kind: "cv" as const, url: "https://example.com/jorinde/lebenslauf" }] };
    expect(text(render(page))).toContain("Lebenslauf");
    expect(text(render(page))).not.toContain("(PDF)");
    const own = { ...contact, links: [{ kind: "cv" as const, url: "https://example.com/jorinde/vita.pdf", label: "Vita" }] };
    expect(text(render(own))).toContain("Vita");
    expect(text(render(own))).not.toContain("Lebenslauf");
  });

  it("shows the status until its last day and not after", () => {
    expect(text(render())).toContain("Frei ab März 2027");
    expect(text(render(contact, new Date("2027-02-28T12:00:00Z")))).toContain("Frei ab März 2027");
    expect(text(render(contact, new Date("2027-03-01T12:00:00Z")))).not.toContain("Frei ab März 2027");
  });

  it("lists the steps as an ordered list under their heading, in the page's language", () => {
    const markup = render();
    expect(markup).toMatch(/<h3[^>]*>So läuft es ab<\/h3>/);
    expect(count(markup, /<ol\b/g)).toBe(1);
    expect(count(/<ol.*<\/ol>/.exec(markup)?.[0] ?? "", /<li\b/g)).toBe(3);
    expect(render(contact, NOW, "ar")).toMatch(/<h3[^>]*>كيف نعمل معًا<\/h3>/);
    const { steps: _steps, ...plain } = contact;
    expect(render(plain)).not.toContain("<ol");
  });
});

/**
 * Classes that name a physical side (plan 1.4: none in new files). Every token of every class
 * attribute is read, its variants (`md:`, `@work:`) and a leading minus taken off.
 */
const PHYSICAL = /^(?:left-|right-|pl-|pr-|ml-|mr-|text-left$|text-right$)/;
const physicalClasses = (markup: string): string[] =>
  [...markup.matchAll(/class="([^"]*)"/g)]
    .flatMap((match) => (match[1] ?? "").split(/\s+/))
    .filter((token) => PHYSICAL.test(token.slice(token.lastIndexOf(":") + 1).replace(/^-/, "")));

describe("the physical-direction guard", () => {
  it("finds a physical class wherever it stands in the attribute", () => {
    expect(physicalClasses('<div class="pl-4 grid">')).toEqual(["pl-4"]);
    expect(physicalClasses('<ul class="-ml-5 flex">')).toEqual(["-ml-5"]);
    expect(physicalClasses('<ul class="flex -mr-5">')).toEqual(["-mr-5"]);
    expect(physicalClasses('<p class="text-left">')).toEqual(["text-left"]);
    expect(physicalClasses('<div class="grid md:pl-4">')).toEqual(["md:pl-4"]);
    expect(physicalClasses('<div class="ps-4 -ms-5 text-start start-0 text-left-ish">')).toEqual([]);
  });
});

describe("the four portfolio examples", () => {
  const SLUGS = ["ronja-feldkamp", "tobin-achterberg", "elena-novak", "jorinde-ahlfeld"] as const;

  it.each(SLUGS)("%s renders in its language: no form, no embed, no shadow, no line under a link", (slug) => {
    const page = EXAMPLES[slug];
    const look: Look = LOOKS[slug];
    if (!page) throw new Error(`no example page "${slug}"`);
    const theme = resolveCreatorTheme(look.theme, { rtlScript: look.locale === "ar" });
    const markup = html(createElement(PosterRenderer, { page, theme, projectBase: `/${look.locale}/p/${slug}` }), look.locale);
    expect(markup).not.toMatch(/<form\b|<iframe\b|<input\b|<textarea\b/);
    expect(markup).not.toMatch(/class="[^"]*\b(?:shadow-(?!none)|drop-shadow|underline|decoration-)/);
    // No physical-direction class in the portfolio's sections (Arabic mirrors by itself).
    const sections = page.blocks.flatMap((block): string[] => {
      switch (block.type) {
        case "about":
          return [html(createElement(AboutSection, { block, wide: true, lead: "display" }), look.locale)];
        case "tools":
          return [html(createElement(ToolsSection, { block }), look.locale)];
        case "timeline":
          return [html(createElement(TimelineSection, { block, locale: look.locale }), look.locale)];
        case "quotes":
          return [html(createElement(QuotesSection, { block, ownerName: page.profile.displayName, projects: [], wide: true }), look.locale)];
        case "contact":
          return [html(createElement(ContactBand, { block, now: NOW, wide: true }), look.locale)];
        case "brands":
          return [html(createElement(BrandNames, { block }), look.locale)];
        default:
          return [];
      }
    });
    expect(sections.length).toBeGreaterThanOrEqual(3);
    for (const section of sections) {
      expect(section).not.toMatch(/<form\b|<iframe\b/);
      expect(physicalClasses(section)).toEqual([]);
    }
    // One line about who chose the quotes per quotes section, and the page's primary action in the band.
    const quotesBlocks = page.blocks.filter((block) => block.type === "quotes").length;
    const note = MESSAGES[look.locale].creator.portfolio.quotesNote.replace("{name}", page.profile.displayName);
    expect(text(markup).split(note)).toHaveLength(quotesBlocks + 1);
    const action = primaryAction(page.blocks, NOW);
    expect(action).not.toBeNull();
    expect(markup).toContain(`href="${action?.url ?? ""}"`);
    expect(text(markup)).toContain(action?.label ?? "");
  });
});
