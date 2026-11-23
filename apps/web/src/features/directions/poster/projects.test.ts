import { pageSchema, type Block, type BlockOf, type Page } from "@linkyo/blocks";
import { chooseProjectsLayout, coverMode, projectTarget, shownPictures } from "@linkyo/blocks/project";
import { resolveCreatorTheme, type ProjectsStyle } from "@linkyo/tokens/creator";
import { NextIntlClientProvider } from "next-intl";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";

import { bentoTiles, ProjectsGroup } from "./projects";
import { PosterRenderer } from "./renderer";
import { portfolioSample, portfolioSampleLong } from "./sample";

// The portfolio's cards and layouts, rendered to HTML in Node (no browser, no testing library) and
// read as a tree: what a visitor's browser gets before any script runs.

type Project = BlockOf<"project">;

// ─── A small reader for the rendered HTML ─────────────────────────────────────────────────────

interface El {
  tag: string;
  attrs: Record<string, string>;
  children: (El | string)[];
  parent: El | null;
}

const VOID = new Set(["img", "input", "br", "hr", "link", "meta", "source"]);
const decode = (text: string): string =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

/** React's static markup is well formed and escapes `<`, `>` and `"` in text and attributes. */
function parse(html: string): El {
  const root: El = { tag: "#root", attrs: {}, children: [], parent: null };
  let current = root;
  const token = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=<>/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  for (const match of html.matchAll(token)) {
    const [whole, closing, tag, attributes, selfClosing, text] = match;
    if (text !== undefined) {
      current.children.push(decode(text));
    } else if (tag === undefined) {
      continue; // a comment
    } else if (closing) {
      if (current.tag !== tag) throw new Error(`Unbalanced markup: </${tag}> closes <${current.tag}> near ${whole}`);
      current = current.parent ?? root;
    } else {
      const attrs: Record<string, string> = {};
      for (const [, name, value] of (attributes ?? "").matchAll(/([^\s=<>/]+)(?:="([^"]*)")?/g)) if (name) attrs[name] = decode(value ?? "");
      const element: El = { tag, attrs, children: [], parent: current };
      current.children.push(element);
      if (!selfClosing && !VOID.has(tag)) current = element;
    }
  }
  if (current !== root) throw new Error(`Unclosed <${current.tag}>`);
  return root;
}

const elements = (node: El): El[] => node.children.flatMap((child) => (typeof child === "string" ? [] : [child, ...elements(child)]));
const all = (node: El, test: (element: El) => boolean): El[] => elements(node).filter(test);
const one = (node: El, test: (element: El) => boolean, what: string): El => {
  const hits = all(node, test);
  if (hits.length !== 1) throw new Error(`Expected one ${what}, found ${String(hits.length)}`);
  return hits[0]!;
};
const text = (node: El): string => node.children.map((child) => (typeof child === "string" ? child : text(child))).join("");
const byId = (node: El, id: string): El => one(node, (element) => element.attrs.id === id, `#${id}`);
const tagged = (tag: string) => (element: El) => element.tag === tag;
const kids = (node: El): El[] => node.children.filter((child): child is El => typeof child !== "string");
const classes = (element: El): string[] => (element.attrs.class ?? "").split(/\s+/);
/** What assistive technology reads of an element: its text without the parts hidden from it. */
const spoken = (node: El): string => node.children.map((child) => (typeof child === "string" ? child : child.attrs["aria-hidden"] === "true" ? "" : spoken(child))).join("");
const plateName = spoken;

// ─── Fixtures ─────────────────────────────────────────────────────────────────────────────────

const base = { visible: true, highlight: false } as const;
const project = (id: string, extra: Partial<Project> = {}): Project => ({ ...base, id, type: "project", slug: id, title: `Titel ${id}`, summary: `Ein Satz über ${id}.`, ...extra });
const picture = (id: string, extra: Partial<Project> = {}): Project => project(id, { cover: { src: "sample:ex-pf-ronja-06", alt: "Ein Kutter auf See", w: 2240, h: 1399 }, story: { about: "Mehr dazu." }, ...extra });
const figure = (id: string, extra: Partial<Project> = {}): Project => project(id, { results: [{ value: "9→3", label: "Wochen Wartezeit" }], ...extra });
const titled = (id: string, extra: Partial<Project> = {}): Project => project(id, { tags: ["Leitsystem"], story: { problem: "Niemand fand den Weg." }, ...extra });
const header = (id: string, title: string): Block => ({ ...base, id, type: "header", title });
const contact: Block = { ...base, id: "contact", type: "contact", title: "Ein Projekt im Kopf?", primary: { label: "Schreib mir", url: "mailto:mats@example.com" } };

const provided = (locale: "de" | "ar", children: ReactNode): El =>
  parse(renderToStaticMarkup(createElement(NextIntlClientProvider, { locale, messages: locale === "ar" ? ar : de, timeZone: "Europe/Berlin", children })));

type GroupProps = Parameters<typeof ProjectsGroup>[0];
const group = (blocks: Project[], layout: ProjectsStyle, props: Partial<GroupProps> = {}, template: "werkbogen" | "tiefdruck" | "atelier" = "werkbogen"): El =>
  provided(
    "de",
    createElement(ProjectsGroup, {
      blocks,
      groupIndex: 0,
      leadTaken: false,
      theme: resolveCreatorTheme({ template, projects: layout }),
      locale: "de",
      quotes: [],
      base: "/mats",
      numbered: true,
      ...props,
    }),
  );

const page = (locale: "de" | "ar", blocks: Block[], profile: Partial<Page["profile"]> = {}): Page => ({
  profile: { username: "mats", displayName: locale === "ar" ? "نايا الدباس" : "Mats Brandt", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale, ...profile },
  blocks,
});
const rendered = (locale: "de" | "ar", blocks: Block[], props: Partial<Parameters<typeof PosterRenderer>[0]> = {}, profile: Partial<Page["profile"]> = {}): El =>
  provided(locale, createElement(PosterRenderer, { page: page(locale, blocks, profile), theme: resolveCreatorTheme({ template: "werkbogen" }, { rtlScript: locale === "ar" }), projectBase: "/mats", ...props }));

const LAYOUTS = ["bento", "list", "rail"] as const;
/** Two pictures, a figure and a title: enough pictures for the grid, and every cover mode. */
const mixed = () => [picture("hafen"), figure("termine"), picture("bad"), titled("halle")];

// ─── Cards ────────────────────────────────────────────────────────────────────────────────────

describe("project cards", () => {
  it.each(LAYOUTS)("%s: the fixtures really get this layout", (layout) => {
    expect(chooseProjectsLayout(mixed(), 0, layout)).toBe(layout);
    expect(mixed().map(coverMode)).toEqual(["picture", "figure", "picture", "title"]);
  });

  it.each(LAYOUTS)("%s: every card, in each cover mode, prints its title and its sentence and has a cover that is not empty", (layout) => {
    const tree = group(mixed(), layout);
    for (const block of mixed()) {
      const card = byId(tree, block.slug);
      // Exactly one heading names the card, and the sentence is printed (never hover-only).
      expect(text(one(card, tagged("h3"), `h3 of ${block.slug}`)), block.slug).toBe(block.title);
      expect(text(card), block.slug).toContain(block.summary);
      const mode = coverMode(block);
      const covers = all(card, (element) => element.attrs["data-cover"] !== undefined);
      if (layout === "list") {
        // The row's end box: the thumbnail, a short figure, or the arrow in their place.
        const end = one(card, (element) => "data-row-end" in element.attrs, "end box");
        expect(kids(end).length, block.slug).toBeGreaterThan(0);
        if (mode === "picture") expect(all(end, tagged("img")), block.slug).toHaveLength(1);
        if (mode === "figure") expect(text(end), block.slug).toBe("9→3");
        if (mode === "title") expect(all(end, tagged("svg")), block.slug).toHaveLength(1);
        continue;
      }
      expect(covers.map((cover) => cover.attrs["data-cover"]), block.slug).toEqual([mode]);
      const cover = covers[0]!;
      if (mode === "picture") expect(all(cover, tagged("img")), block.slug).toHaveLength(1);
      if (mode === "figure") expect(text(cover), block.slug).toBe("9→3Wochen Wartezeit");
      // A title cover is the card's heading; its first tag is the caption above it.
      if (mode === "title") {
        expect(text(cover), block.slug).toBe(`Leitsystem${block.title}`);
        expect(all(cover, tagged("h3")), block.slug).toHaveLength(1);
      }
    }
  });

  it.each(LAYOUTS)("%s: no text sits on a picture, and a cover has no description on a card (the title stands beside it)", (layout) => {
    const tree = group(mixed(), layout);
    const boxes = all(tree, (element) => element.attrs["data-cover"] === "picture");
    expect(boxes).toHaveLength(2);
    for (const box of boxes) {
      expect(text(box)).toBe("");
      expect(kids(box).map((child) => child.tag)).toEqual(["img"]);
      expect(kids(box)[0]?.attrs.alt).toBe("");
    }
  });

  it.each(LAYOUTS)("%s: every card carries its address as its id, once, in page order", (layout) => {
    const tree = group(mixed(), layout);
    const ids = all(tree, (element) => element.attrs.id !== undefined).map((element) => element.attrs.id);
    expect(ids).toEqual(["hafen", "termine", "bad", "halle"]);
    for (const id of ids) expect(classes(byId(tree, id ?? ""))).toContain("scroll-mt-16");
  });

  it("the list is an ol of rows; the row is one link", () => {
    const tree = group(mixed(), "list");
    const list = one(tree, tagged("ol"), "ol");
    expect(kids(list).map((item) => [item.tag, item.attrs.id])).toEqual([
      ["li", "hafen"],
      ["li", "termine"],
      ["li", "bad"],
      ["li", "halle"],
    ]);
    for (const row of kids(list)) expect(kids(row).map((child) => child.tag)).toEqual(["a"]);
    // The numbers are decoration: Latin digits, hidden from assistive technology.
    const numbers = all(list, (element) => element.attrs["aria-hidden"] === "true" && /^\d{2}$/.test(text(element))).map(text);
    expect(numbers).toEqual(["01", "02", "03", "04"]);
  });

  it("the bento is one list whose items are its direct children, with nothing between", () => {
    const tree = group(mixed(), "bento");
    const list = one(tree, (element) => element.attrs.role === "list", "role=list");
    expect(list.tag).toBe("div");
    expect(kids(list).map((item) => [item.attrs.role, item.attrs.id])).toEqual([
      ["listitem", "hafen"],
      ["listitem", "termine"],
      ["listitem", "bad"],
      ["listitem", "halle"],
    ]);
    expect(all(tree, (element) => element.attrs.role === "listitem")).toHaveLength(4);
    // One grid: two columns on phones, six on the wide canvas.
    expect(classes(list)).toEqual(expect.arrayContaining(["grid", "grid-cols-2", "@work:grid-cols-6"]));
    // No tile is moved out of page order.
    expect(elements(list).flatMap(classes).filter((name) => /(^|:)order-|grid-flow-dense/.test(name))).toEqual([]);
  });

  it("the rail is a labelled region that scrolls, with one card per project", () => {
    const tree = group(mixed(), "rail");
    const region = one(tree, (element) => element.attrs.role === "region", "region");
    expect(region.attrs["aria-label"]).toBe("Arbeiten, scrollbare Reihe");
    expect(region.attrs.tabindex).toBe("0");
    const track = one(region, tagged("ol"), "ol");
    expect(classes(track)).toEqual(expect.arrayContaining(["snap-x", "overflow-x-auto"]));
    expect(kids(track).map((item) => item.attrs.id)).toEqual(["hafen", "termine", "bad", "halle"]);
    // In a rail every cover is upright, whatever it shows.
    for (const cover of all(track, (element) => element.attrs["data-cover"] !== undefined)) expect(classes(cover)).toContain("aspect-portrait");
  });

  it("a template without the wide canvas keeps the phone grid at every width", () => {
    const tree = group(mixed(), "bento", {}, "atelier");
    const names = elements(tree).flatMap(classes);
    expect(names.filter((name) => name.startsWith("@work:"))).toEqual([]);
    expect(names).toContain("grid-cols-2");
  });
});

describe("where a card leads", () => {
  const thin = project("vortrag", { links: [{ url: "https://www.example.com/vortrag" }] });
  const bare = project("skizze");
  const story = titled("halle");

  it.each(LAYOUTS)("%s: a link to the project's page, a link to the project's own address with its host printed, or a box that takes no focus", (layout) => {
    const blocks = [picture("hafen"), picture("bad"), story, thin, bare];
    expect(blocks.map((block) => projectTarget(block, "/mats").kind)).toEqual(["page", "page", "page", "link", "none"]);
    const tree = group(blocks, layout, { suffix: "?chrome=0" });
    // The whole card is one link to the page.
    const pageCard = byId(tree, "halle");
    expect(all(pageCard, tagged("a")).map((link) => link.attrs.href)).toEqual(["/mats/halle?chrome=0"]);
    expect(text(one(pageCard, tagged("a"), "link"))).toContain("Titel halle");
    // The project's own link: the host is printed, left to right, and the arrow points out.
    const linkCard = byId(tree, "vortrag");
    expect(all(linkCard, tagged("a")).map((link) => link.attrs.href)).toEqual(["https://www.example.com/vortrag"]);
    const host = one(linkCard, (element) => element.tag === "bdi" && element.attrs.dir === "ltr", "host");
    expect(text(host)).toBe("example.com");
    expect(all(linkCard, (element) => classes(element).includes("lucide-arrow-up-right"))).toHaveLength(1);
    // Nothing to open: no link, no button, nothing that takes focus.
    const plain = byId(tree, "skizze");
    expect(all(plain, (element) => element.tag === "a" || element.tag === "button" || "tabindex" in element.attrs)).toEqual([]);
    expect(text(plain)).toContain("Titel skizze");
  });

  it("a repository-only project is a complete card: it opens the repository and prints stars, language and licence", () => {
    const repo = project("rasterblick", { source: { owner: "mats", repo: "rasterblick", stars: 1280, language: "TypeScript", license: "MIT" } });
    expect(projectTarget(repo, "/mats")).toEqual({ kind: "link", href: "https://github.com/mats/rasterblick" });
    for (const layout of LAYOUTS) {
      const card = byId(group([repo, picture("a"), picture("b")], layout), "rasterblick");
      expect(all(card, tagged("a")).map((link) => link.attrs.href), layout).toEqual(["https://github.com/mats/rasterblick"]);
      const words = text(card);
      expect(words, layout).toContain("1.280 Sterne auf GitHub");
      expect(words, layout).toContain("TypeScript");
      expect(words, layout).toContain("Lizenz: MIT");
      expect(text(one(card, (element) => element.tag === "bdi" && element.attrs.dir === "ltr" && text(element).includes("github"), "host")), layout).toBe("github.com");
    }
    // Its title cover says where it lives, left to right.
    const cover = one(byId(group([repo, picture("a"), picture("b")], "bento"), "rasterblick"), (element) => element.attrs["data-cover"] === "title", "cover");
    expect(text(one(cover, (element) => element.tag === "bdi" && element.attrs.dir === "ltr", "owner/repo"))).toBe("mats/rasterblick");
    // An install command is more to read: then the card opens the project's page.
    expect(projectTarget({ ...repo, source: { ...repo.source, owner: "mats", repo: "rasterblick", install: "npm install https://example.com/x.tgz" } }, "/mats").kind).toBe("page");
  });

  it("a preview without addresses opens a project's page in place with a button; without that, the card is a box", () => {
    const blocks = [picture("hafen"), thin];
    const opened: string[] = [];
    const preview = group(blocks, "list", { base: undefined, onOpen: (id) => opened.push(id) });
    const card = byId(preview, "hafen");
    expect(all(card, tagged("a"))).toEqual([]);
    const button = one(card, tagged("button"), "button");
    expect(button.attrs).toMatchObject({ type: "button", "aria-label": "Titel hafen" });
    // The heading stays a heading: the button lies over the card, it does not wrap it.
    expect(all(button, tagged("h3"))).toEqual([]);
    expect(all(card, tagged("h3"))).toHaveLength(1);
    // The project's own link still leads out.
    expect(all(byId(preview, "vortrag"), tagged("a")).map((link) => link.attrs.href)).toEqual(["https://www.example.com/vortrag"]);
    // Neither an address nor a way to open in place (the homepage's phone): no link, no button.
    const still = byId(group(blocks, "list", { base: undefined }), "hafen");
    expect(all(still, (element) => element.tag === "a" || element.tag === "button")).toEqual([]);
  });

  it("prints role and year, a range of years as one figure that never breaks", () => {
    const card = byId(group([picture("hafen", { role: "Freie Serie", year: { from: 2023, to: "now" } }), picture("b")], "list"), "hafen");
    const years = one(card, (element) => element.tag === "bdi" && /\d{4}/.test(text(element)), "years");
    expect(text(years)).toBe("2023–heute");
    expect(classes(years)).toEqual(expect.arrayContaining(["whitespace-nowrap", "tabular-nums"]));
    expect(text(card)).toContain("Freie Serie");
  });
});

describe("more than six projects", () => {
  const many = () => Array.from({ length: 8 }, (_, index) => picture(`p${String(index + 1)}`));

  it.each(LAYOUTS)("%s: the first six show; the seventh and eighth wait in a details element, as numbered rows", (layout) => {
    // A row takes at most six: eight chosen as a rail become the list.
    expect(chooseProjectsLayout(many(), 0, layout)).toBe(layout === "rail" ? "list" : layout);
    const tree = group(many(), layout);
    const details = one(tree, tagged("details"), "details");
    expect(text(one(details, tagged("summary"), "summary"))).toBe("Alle 8 Projekte zeigen");
    expect(classes(one(details, tagged("summary"), "summary"))).toContain("min-h-touch-target");
    const hidden = all(details, (element) => element.attrs.id !== undefined).map((element) => element.attrs.id);
    expect(hidden).toEqual(["p7", "p8"]);
    const shown = all(tree, (element) => element.attrs.id !== undefined).map((element) => element.attrs.id);
    expect(shown).toEqual(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]);
    // The rows behind it keep counting, carry no thumbnail and are links like every card.
    const rest = one(details, tagged("ol"), "ol");
    expect(rest.attrs.start).toBe("7");
    expect(all(rest, tagged("img"))).toEqual([]);
    expect(all(rest, tagged("a")).map((link) => link.attrs.href)).toEqual(["/mats/p7", "/mats/p8"]);
    expect(all(rest, (element) => element.attrs["aria-hidden"] === "true" && /^\d{2}$/.test(text(element))).map(text)).toEqual(["07", "08"]);
  });

  it("six projects need no details", () => {
    expect(all(group(many().slice(0, 6), "bento"), tagged("details"))).toEqual([]);
  });
});

describe("the grid's places", () => {
  const spec = (count: number, leadTaken: boolean) => {
    const tiles = bentoTiles(
      Array.from({ length: count }, (_, index) => ({ project: picture(`p${String(index + 1)}`) })),
      leadTaken,
    );
    return { order: tiles.map((tile) => tile.entry.project.id), lead: tiles.map((tile) => tile.lead), phone: tiles.map((tile) => tile.phoneSpan), wide: tiles.map((tile) => tile.wideSpan), rows: tiles.map((tile) => tile.wideRows) };
  };

  it.each([
    [1, [2], [6], [1]],
    [2, [2, 2], [4, 2], [1, 1]],
    [3, [2, 1, 1], [4, 2, 2], [2, 1, 1]],
    [4, [2, 1, 1, 2], [4, 2, 2, 6], [2, 1, 1, 1]],
    [5, [2, 1, 1, 1, 1], [4, 2, 2, 3, 3], [2, 1, 1, 1, 1]],
    [6, [2, 1, 1, 1, 1, 2], [4, 2, 2, 2, 2, 2], [2, 1, 1, 1, 1, 1]],
  ])("%i tiles with a lead: phone columns %j, wide columns %j", (count, phone, wide, rows) => {
    const tiles = spec(count, false);
    expect(tiles.order).toEqual(Array.from({ length: count }, (_, index) => `p${String(index + 1)}`));
    expect(tiles.lead).toEqual(Array.from({ length: count }, (_, index) => index === 0));
    expect(tiles.phone).toEqual(phone);
    expect(tiles.wide).toEqual(wide);
    expect(tiles.rows).toEqual(rows);
  });

  it.each([
    [1, [2], [6]],
    [2, [1, 1], [3, 3]],
    [3, [1, 1, 2], [2, 2, 2]],
    [4, [1, 1, 1, 1], [3, 3, 3, 3]],
    [5, [1, 1, 1, 1, 2], [2, 2, 2, 3, 3]],
  ])("%i tiles after the hero plate took the lead: phone columns %j, wide columns %j", (count, phone, wide) => {
    const tiles = spec(count, true);
    expect(tiles.lead).toEqual(Array.from({ length: count }, () => false));
    expect(tiles.phone).toEqual(phone);
    expect(tiles.wide).toEqual(wide);
  });

  it("a pair of upright covers stands upright on phones; any other pair is square; one left over is wide", () => {
    const upright = (id: string) => ({ project: picture(id, { cover: { src: "sample:ex-pf-ronja-03", alt: "", w: 1067, h: 1600 } }) });
    const level = (id: string) => ({ project: picture(id) });
    const ratios = (entries: { project: Project }[]) => bentoTiles(entries, true).map((tile) => tile.cover.phone);
    expect(ratios([upright("a"), upright("b"), upright("c"), level("d"), figureEntry("e")])).toEqual(["aspect-portrait", "aspect-portrait", "aspect-square", "aspect-square", "aspect-video"]);
    // The lead keeps the nearest ratio of its own picture.
    expect(bentoTiles([upright("a"), level("b"), level("c")], false)[0]?.cover.phone).toBe("aspect-portrait");
    expect(bentoTiles([level("a"), level("b"), level("c")], false)[0]?.cover.phone).toBe("aspect-photo");
  });
  const figureEntry = (id: string) => ({ project: figure(id) });
});

// ─── On the page ──────────────────────────────────────────────────────────────────────────────

describe("the work on the page", () => {
  const work = () => [picture("hafen", { title: "Hafenlicht", role: "Freie Serie", year: { from: 2025 } }), picture("bad"), figure("termine"), titled("halle")];

  it("a run of projects under no header gets a heading of its own, hidden from sight", () => {
    const tree = rendered("de", work(), {}, { hero: { src: "sample:mila-hero", alt: "" } });
    const headings = all(tree, tagged("h2"));
    expect(headings.map(text)).toEqual(["Arbeiten"]);
    expect(classes(headings[0]!)).toContain("sr-only");
    // Under a header the header is the heading: no second one.
    const titledRun = rendered("de", [header("h", "Ausgewählte Arbeiten"), ...work()]);
    expect(all(titledRun, tagged("h2")).map(text)).toEqual(["01Ausgewählte Arbeiten"]);
    expect(text(titledRun)).not.toContain("scrollbare");
  });

  it("the plate is the first project: a link named with its place and the run's total, and the run below starts at 02", () => {
    const tree = rendered("de", [header("h", "Ausgewählte Arbeiten"), ...work(), contact]);
    const plate = byId(tree, "hafen");
    const link = one(plate, tagged("a"), "plate link");
    expect(link.attrs.href).toBe("/mats/hafen");
    // Named by what it holds (no aria-label): the place and the title first, then role and year. The
    // title printed under the picture is hidden from assistive technology, so it is not read twice.
    expect(link.attrs["aria-label"]).toBeUndefined();
    expect(plateName(link)).toBe("Projekt 1 von 4: HafenlichtFreie Serie\u00A0 2025");
    expect(all(link, (element) => element.attrs["aria-hidden"] === "true" && text(element) === "Hafenlicht")).toHaveLength(1);
    // It stands in the hero, before the sections, and is the page's one preloaded picture.
    expect(all(one(tree, tagged("header"), "header"), (element) => element.attrs.id === "hafen")).toHaveLength(1);
    expect(all(tree, (element) => element.tag === "img" && element.attrs.loading === "eager")).toHaveLength(1);
    expect(all(plate, (element) => element.tag === "img" && element.attrs.loading === "eager")).toHaveLength(1);
    expect(text(plate)).toContain("01");
    expect(text(plate)).toContain("Freie Serie");
    // Every project is on the page once; the section counts all four and numbers the rest from 02.
    const ids = all(tree, (element) => ["hafen", "bad", "termine", "halle"].includes(element.attrs.id ?? "")).map((element) => element.attrs.id);
    expect(ids).toEqual(["hafen", "bad", "termine", "halle"]);
    const main = one(tree, tagged("main"), "main");
    expect(text(main)).toContain("4 Projekte");
    expect(all(main, (element) => element.attrs["aria-hidden"] === "true" && /^\d{2}$/.test(text(element))).map(text)).toEqual(["01", "02", "03", "04"]);
    expect(text(byId(tree, "bad"))).toContain("02");
  });

  it("the owner's own hero picture is the plate instead: it leads nowhere and the run starts at 01", () => {
    const tree = rendered("de", [header("h", "Arbeiten"), ...work()], {}, { hero: { src: "sample:mila-hero", alt: "Mats im Atelier" } });
    const hero = one(tree, tagged("header"), "header");
    expect(all(hero, tagged("a"))).toEqual([]);
    expect(all(hero, (element) => element.tag === "img" && element.attrs.alt === "Mats im Atelier")).toHaveLength(1);
    expect(text(byId(one(tree, tagged("main"), "main"), "hafen"))).toContain("01");
  });

  it("without a picture the hero is text only and nothing is taken out of the run", () => {
    const tree = rendered("de", [figure("termine"), titled("halle"), picture("hafen")]);
    expect(all(one(tree, tagged("header"), "header"), tagged("img"))).toEqual([]);
    expect(all(one(tree, tagged("main"), "main"), (element) => element.tag === "li" && element.attrs.id !== undefined).map((row) => row.attrs.id)).toEqual(["termine", "halle", "hafen"]);
  });

  it("a page whose only project is the plate has no empty section of work", () => {
    const tree = rendered("de", [header("h", "Arbeiten"), picture("hafen", { title: "Hafenlicht" }), header("l", "Links"), { ...base, id: "x", type: "link", title: "Website", url: "https://example.com" }]);
    expect(plateName(one(byId(tree, "hafen"), tagged("a"), "plate"))).toBe("Projekt 1 von 1: Hafenlicht");
    expect(all(tree, tagged("h2")).map(text)).toEqual(["01Links"]);
  });

  it("another template shows the same run inside its column, with every card and no plate", () => {
    const tree = provided("de", createElement(PosterRenderer, { page: page("de", [header("h", "Arbeiten"), ...work()]), theme: resolveCreatorTheme({ template: "folio" }), projectBase: "/mats" }));
    const main = one(tree, tagged("main"), "main");
    expect(all(main, (element) => ["hafen", "bad", "termine", "halle"].includes(element.attrs.id ?? ""))).toHaveLength(4);
    expect(elements(tree).flatMap(classes).filter((name) => name.startsWith("@work:"))).toEqual([]);
  });

  it("in Arabic the page runs right to left and the arrows turn", () => {
    const tree = rendered("ar", [header("h", "أعمال مختارة"), ...work()]);
    expect(one(tree, (element) => element.attrs.dir === "rtl" && element.attrs.lang === "ar", "root").tag).toBe("div");
    expect(plateName(one(byId(tree, "hafen"), tagged("a"), "plate"))).toContain("المشروع 1 من 4: Hafenlicht");
    expect(text(tree)).toContain("4 مشاريع");
    for (const arrow of all(tree, (element) => element.tag === "svg" && classes(element).some((name) => /^lucide-(arrow|chevron)-(right|up-right)$/.test(name)))) {
      expect(classes(arrow)).toContain("rtl:-scale-x-100");
    }
  });

  it("with a project open the renderer shows that project's page in place of the portfolio", () => {
    const tree = rendered("de", [header("h", "Arbeiten"), ...work()], { openProject: { id: "bad", onBack: () => undefined }, preview: true });
    expect(all(tree, tagged("h1")).map(text)).toEqual(["Titel bad"]);
    expect(text(one(tree, tagged("button"), "back"))).toBe("Zurück zu Mats Brandt");
    expect(text(tree)).not.toContain("Hafenlicht");
  });
});

// ─── The sample ───────────────────────────────────────────────────────────────────────────────

describe("the portfolio sample", () => {
  const LOCALES = ["de", "en", "ar"] as const;

  it.each(LOCALES)("%s: validates against the schema and shows one card of every kind", (locale) => {
    const sample = portfolioSample(locale);
    const result = pageSchema.safeParse(sample);
    expect(result.success, JSON.stringify(result.error?.issues.slice(0, 3))).toBe(true);
    expect(sample.profile.locale).toBe(locale);
    // No hero picture: the plate shows the first project.
    expect(sample.profile.hero).toBeUndefined();
    const projects = sample.blocks.filter((block): block is Project => block.type === "project");
    expect(projects.map(coverMode)).toEqual(["picture", "picture", "figure", "picture", "title", "picture"]);
    const [harbour, , booking, charts, , thin] = projects;
    // Twelve pictures (the cover and eleven more), each described.
    expect(shownPictures(harbour!)).toHaveLength(11);
    // A figure of twelve characters.
    expect(Array.from(booking?.results?.[0]?.value ?? "")).toHaveLength(12);
    // Repository facts, an install command that installs nobody's real code, and twelve lines of code.
    expect(charts?.source?.install).toContain("example.com");
    expect(charts?.code?.text.split("\n")).toHaveLength(12);
    // A thin project opens its link; the others have a page.
    expect(projects.map((block) => projectTarget(block, "/x", sample.blocks.filter((item): item is BlockOf<"quotes"> => item.type === "quotes")).kind)).toEqual(["page", "page", "page", "page", "page", "link"]);
    expect(projectTarget(thin!, "/x")).toEqual({ kind: "link", href: "https://example.com/schneiderinnen" });
    // Werkbogen chooses the grid for it, Tiefdruck the list; a rail can be chosen.
    expect(chooseProjectsLayout(projects, 0, resolveCreatorTheme({ template: "werkbogen" }).layout.projects)).toBe("bento");
    expect(chooseProjectsLayout(projects, 0, resolveCreatorTheme({ template: "tiefdruck" }).layout.projects)).toBe("list");
    expect(chooseProjectsLayout(projects, 0, "rail")).toBe("rail");
    expect(sample.blocks.map((block) => block.type).filter((type) => type !== "project")).toEqual(["socials", "header", "about", "brands", "quotes", "tools", "timeline", "contact"]);
  });

  it.each(LOCALES)("%s: the long variant holds the longest texts the schema takes, and eight projects", (locale) => {
    const sample = portfolioSampleLong(locale);
    const result = pageSchema.safeParse(sample);
    expect(result.success, JSON.stringify(result.error?.issues.slice(0, 3))).toBe(true);
    const projects = sample.blocks.filter((block): block is Project => block.type === "project");
    expect(projects).toHaveLength(8);
    expect(sample.profile.displayName.length).toBeGreaterThanOrEqual(58);
    expect((sample.profile.tagline ?? "").length).toBeGreaterThanOrEqual(78);
    expect(Math.max(...projects.map((block) => block.title.length))).toBe(60);
    // One word of at least forty characters without a place to break.
    expect(projects.some((block) => block.title.split(/[\s–-]+/).some((word) => word.length >= 40))).toBe(true);
    expect(projects[0]?.tags).toHaveLength(5);
    expect(projects[0]?.tags?.every((tag) => tag.length === 24 || tag.length === 23)).toBe(true);
    expect(projects.flatMap((block) => block.results ?? []).every((item) => Array.from(item.value).length === 12 && !/\s/.test(item.value))).toBe(true);
  });
});
