import type { Block, Page } from "@linkyo/blocks";
import { suggestBlockOrder } from "@linkyo/blocks/project";
import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { NextIntlClientProvider } from "next-intl";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";

import { PosterRenderer } from "./renderer";
import { featuredApp, groupSections, linkDestination } from "./sections";

const base = { visible: true, highlight: false } as const;
const header = (id: string, title: string): Block => ({ ...base, id, type: "header", title });
const link = (id: string): Block => ({ ...base, id, type: "link", title: id, url: `https://example.com/${id}` });
const video = (id: string): Block => ({
  ...base,
  id,
  type: "video",
  title: id,
  provider: "youtube",
  url: `https://youtube.com/watch?v=${id}`,
  poster: { src: "sample:video-live", alt: "" },
});
const product = (id: string): Block => ({
  ...base,
  id,
  type: "product",
  title: id,
  price: 10,
  currency: "EUR",
  url: `https://shop.example.com/${id}`,
  image: { src: "sample:merch-vinyl", alt: "" },
});

describe("groupSections", () => {
  it("puts blocks before the first header in an untitled top section and skips socials", () => {
    const sections = groupSections([{ ...base, id: "s", type: "socials", items: [] }, link("a"), header("h", "Music"), link("b")]);
    expect(sections.map((s) => [s.id, s.title, s.items.length])).toEqual([
      ["top", null, 1],
      ["h", "Music", 1],
    ]);
  });

  it("groups consecutive videos into one row and consecutive products into one grid", () => {
    const [top] = groupSections([video("v1"), video("v2"), link("x"), product("p1"), product("p2"), product("p3"), video("v3")]);
    expect(top?.items.map((item) => (item.kind === "block" ? item.block.id : `${item.kind}:${item.blocks.map((b) => b.id).join(",")}`))).toEqual([
      "videos:v1,v2",
      "x",
      "products:p1,p2,p3",
      "videos:v3",
    ]);
  });

  it("lets titled list blocks open their own section", () => {
    const events: Block = {
      ...base,
      id: "tour",
      type: "events",
      title: "Tour",
      items: [{ date: "2027-01-01", city: "Berlin", venue: "Club", url: "https://tickets.example.com", status: "onsale" }],
    };
    const sections = groupSections([header("h", "Videos"), video("v1"), events, link("after")]);
    expect(sections.map((s) => [s.title, s.items.length])).toEqual([
      ["Videos", 1],
      ["Tour", 2],
    ]);
  });

  it("keeps an empty titled section (a freshly added header) but drops an empty top", () => {
    expect(groupSections([header("h", "New section")])).toEqual([{ id: "h", title: "New section", items: [], span: "text" }]);
    expect(groupSections([])).toEqual([]);
  });
});

describe("portfolio blocks", () => {
  const project = (id: string): Block => ({ ...base, id, type: "project", slug: id, title: id, summary: "One sentence." });
  const about = (title?: string): Block => ({ ...base, id: "about", type: "about", text: "Hello.", ...(title ? { title } : {}) });
  const tools = (title?: string): Block => ({ ...base, id: "tools", type: "tools", items: ["Figma"], ...(title ? { title } : {}) });
  const timeline: Block = { ...base, id: "timeline", type: "timeline", title: "Experience", items: [{ role: "Lead", years: { from: 2021 } }] };
  const quotes: Block = { ...base, id: "quotes", type: "quotes", title: "What clients say", items: [{ text: "Great.", name: "M. K.", role: "Client", consent: true }] };
  const contact: Block = { ...base, id: "contact", type: "contact", title: "A project in mind?", primary: { label: "Write to me", url: "mailto:mats@example.com" } };
  const shape = (blocks: Block[]) => groupSections(blocks).map((section) => [section.title, section.items.map((item) => (item.kind === "block" ? item.block.id : `${item.kind}:${item.blocks.map((b) => b.id).join(",")}`))]);

  it("gathers consecutive projects into one run; anything between them starts a new run", () => {
    expect(shape([project("a"), project("b"), project("c")])).toEqual([[null, ["projects:a,b,c"]]]);
    expect(shape([project("a"), project("b"), link("x"), project("c")])).toEqual([[null, ["projects:a,b", "x", "projects:c"]]]);
    expect(shape([link("x"), project("a")])).toEqual([[null, ["x", "projects:a"]]]);
  });

  it("puts a run under the header before it, and a second header starts a second run", () => {
    expect(shape([header("h1", "Work"), project("a"), project("b"), header("h2", "Earlier work"), project("c")])).toEqual([
      ["Work", ["projects:a,b"]],
      ["Earlier work", ["projects:c"]],
    ]);
  });

  it("lets a titled about, tools, timeline or quotes block open its own section", () => {
    expect(shape([header("h", "Work"), project("a"), about("About me"), tools("Tech stack"), timeline, quotes, contact])).toEqual([
      ["Work", ["projects:a"]],
      ["About me", ["about"]],
      ["Tech stack", ["tools"]],
      ["Experience", ["timeline"]],
      ["What clients say", ["quotes"]],
      [null, ["contact"]],
    ]);
    // Without a title of their own they stay in the section they stand in.
    expect(shape([header("h", "Work"), project("a"), about(), tools()])).toEqual([["Work", ["projects:a", "about", "tools"]]]);
  });

  it("gives the contact band a section of its own, without a title, wherever it stands", () => {
    // Never an item under the title before it: the band runs across the canvas under its own line.
    expect(shape([header("h", "Work"), project("a"), contact])).toEqual([
      ["Work", ["projects:a"]],
      [null, ["contact"]],
    ]);
    expect(shape([quotes, contact])).toEqual([
      ["What clients say", ["quotes"]],
      [null, ["contact"]],
    ]);
    // At the top of a page, and with plain blocks around it: what follows starts a run of its own.
    expect(shape([link("x"), contact, link("y"), link("z")])).toEqual([
      [null, ["x"]],
      [null, ["contact"]],
      [null, ["y", "z"]],
    ]);
    expect(shape([contact, project("a")])).toEqual([
      [null, ["contact"]],
      [null, ["projects:a"]],
    ]);
    // A header straight before it keeps its (empty) section; the band still stands alone.
    expect(shape([header("h", "Contact"), contact, header("h2", "More"), link("x")])).toEqual([
      ["Contact", []],
      [null, ["contact"]],
      ["More", ["x"]],
    ]);
    const ids = groupSections([link("x"), contact, link("y")]).map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps a project that follows a self-titled block in that block's section, as a run", () => {
    expect(shape([about("About me"), project("a"), project("b")])).toEqual([["About me", ["about", "projects:a,b"]]]);
  });

  it("the suggested order reads sections as the page does: a link stays under the heading it stood under", () => {
    // The page is already in a designer's order; the CV link belongs to "About me", not to "Tech stack".
    const designer = [header("h", "Work"), project("a"), project("b"), about("About me"), link("cv-pdf"), tools("Tech stack"), contact];
    expect(shape(suggestBlockOrder(designer, "designer"))).toEqual(shape(designer));
    // For a coach the sections move, each with what stood under it.
    const coach = [header("h", "Work"), project("a"), about("About me"), link("cv-pdf"), quotes, link("review-site"), contact];
    expect(shape(suggestBlockOrder(coach, "coach"))).toEqual([
      ["About me", ["about", "cv-pdf"]],
      ["Work", ["projects:a"]],
      ["What clients say", ["quotes", "review-site"]],
      [null, ["contact"]],
    ]);
  });

  it("spans the wide canvas with work, pictures, about, quotes, clients and contact; everything else reads beside its title", () => {
    const gallery: Block = { ...base, id: "gallery", type: "gallery", title: "Pictures", images: [{ src: "sample:gallery-1", alt: "" }] };
    const brands: Block = { ...base, id: "clients", type: "brands", title: "Clients", columns: 3, items: [{ name: "A bakery" }] };
    const span = (blocks: Block[]) => groupSections(blocks).map((section) => [section.title, section.span]);
    expect(span([link("x"), header("h", "Work"), project("a"), about("About me"), tools("Tech stack"), timeline, quotes, brands, gallery, header("l", "Links"), link("y"), video("v"), contact])).toEqual([
      [null, "text"],
      ["Work", "wide"],
      ["About me", "wide"],
      ["Tech stack", "text"],
      ["Experience", "text"],
      ["What clients say", "wide"],
      ["Clients", "wide"],
      ["Pictures", "wide"],
      ["Links", "text"],
      [null, "wide"],
    ]);
    // Any wide item makes its section wide: a link under the same title does not change that.
    expect(span([header("h", "Work"), link("x"), project("a"), link("y")])).toEqual([["Work", "wide"]]);
    expect(span([link("x"), project("a")])).toEqual([[null, "wide"]]);
    // A freshly added title without blocks is a text section.
    expect(span([header("h", "New")])).toEqual([["New", "text"]]);
  });
});

describe("media rows", () => {
  const release = (id: string, highlight = false): Block => ({
    ...base,
    highlight,
    id,
    type: "music",
    title: id,
    artist: "A",
    kind: "single",
    cover: { src: "sample:cover-daw", alt: "" },
    links: [{ platform: "spotify", url: `https://open.spotify.com/track/${id}` }],
  });

  it("groups consecutive releases, cards and image links; a featured release stands alone", () => {
    const [top] = groupSections([release("hero", true), release("a"), release("b"), link("plain"), release("c")]);
    expect(top?.items.map((item) => (item.kind === "block" ? item.block.id : `${item.kind}:${item.blocks.map((b) => b.id).join(",")}`))).toEqual([
      "hero",
      "rows:a,b",
      "plain",
      "rows:c",
    ]);
  });
});

describe("linkDestination", () => {
  it("shows host, email or phone", () => {
    expect(linkDestination("https://www.milaaurel.com/samples")).toBe("milaaurel.com");
    expect(linkDestination("mailto:booking@milaaurel.com")).toBe("booking@milaaurel.com");
    expect(linkDestination("tel:+4930123")).toBe("+4930123");
  });
});

describe("featuredApp", () => {
  const app = (id: string, stores: ("appstore" | "googleplay" | "web")[], highlight = false) =>
    ({ ...base, id, highlight, type: "app", title: id, icon: { src: "sample:x", alt: "" }, stores: stores.map((store) => ({ store, url: `https://example.com/${id}/${store}` })) }) as const;

  it("is the first highlighted app, or the only one; web apps have no badges", () => {
    expect(featuredApp([app("a", ["appstore"]), app("b", ["googleplay"], true), app("c", ["appstore"], true)])).toBe("b");
    expect(featuredApp([app("a", ["appstore", "googleplay"])])).toBe("a");
    expect(featuredApp([app("a", ["appstore"]), app("b", ["googleplay"])])).toBeUndefined();
    expect(featuredApp([app("w", ["web"], true)])).toBeUndefined();
  });

  it("stands alone, the other apps stay one list", () => {
    const blocks = [app("a", ["appstore"]), app("b", ["appstore"], true), app("c", ["appstore"]), app("d", ["googleplay"])];
    const items = groupSections(blocks, featuredApp(blocks))[0]?.items ?? [];
    expect(items.map((item) => (item.kind === "block" ? `block:${item.block.id}` : `${item.kind}:${item.blocks.map((block) => block.id).join("")}`))).toEqual(["apps:a", "block:b", "apps:cd"]);
  });
});

// The renderer's contract for the portfolio blocks, rendered to HTML in Node: what the page shows
// while the layouts are still to come, and the project a preview opens in place.
describe("the renderer and the portfolio blocks", () => {
  const project = (id: string, title: string): Block => ({ ...base, id, type: "project", slug: id, title, summary: "One sentence." });
  const contact: Block = { ...base, id: "contact", type: "contact", title: "A project in mind?", primary: { label: "Write to me", url: "mailto:mats@example.com" } };
  const page = (locale: "de" | "ar", blocks: Block[]): Page => ({
    profile: { username: "mats", displayName: locale === "ar" ? "نايا الدباس" : "Mats Brandt", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale },
    blocks,
  });
  /** Renders an element with the app's messages, as the layout's provider does. */
  const provided = (locale: "de" | "ar", children: ReactNode): string =>
    renderToStaticMarkup(createElement(NextIntlClientProvider, { locale, messages: locale === "ar" ? ar : de, timeZone: "Europe/Berlin", children }));
  const html = (locale: "de" | "ar", props: Partial<Parameters<typeof PosterRenderer>[0]> & { blocks: Block[] }) => {
    const { blocks, ...rest } = props;
    return provided(locale, createElement(PosterRenderer, { page: page(locale, blocks), theme: resolveCreatorTheme({ template: "werkbogen" }, { rtlScript: locale === "ar" }), preview: true, ...rest }));
  };
  const work = [header("h", "Arbeiten"), project("hafenlicht", "Hafenlicht"), project("werft", "Werft bei Nacht"), link("shop"), contact];

  it("prints every project of a run, each under its address, and keeps the rest of the page", () => {
    const markup = html("de", { blocks: work });
    expect(markup).toContain('<li id="hafenlicht"');
    expect(markup).toContain('<li id="werft"');
    expect(markup.indexOf("Hafenlicht")).toBeLessThan(markup.indexOf("Werft bei Nacht"));
    expect(markup).toContain("Arbeiten");
    expect(markup).toContain("https://example.com/shop");
    expect(markup.match(/<h1/g)).toHaveLength(1);
  });

  it("shows the project in place of the portfolio when one is open, with the way back as a button", () => {
    const markup = html("de", { blocks: work, openProject: { id: "werft", onBack: () => undefined } });
    expect(markup).toMatch(/<h1[^>]*>Werft bei Nacht<\/h1>/);
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toMatch(/<button type="button"[^>]*>.*Zurück zu Mats Brandt.*<\/button>/);
    // The portfolio is not on the page: no other project, no link, no section title.
    expect(markup).not.toContain("Hafenlicht");
    expect(markup).not.toContain("https://example.com/shop");
    expect(markup).not.toContain("Arbeiten");
    expect(markup).toContain('lang="de"');
    expect(markup).toContain('dir="ltr"');
  });

  it("opens in Arabic from right to left, with the page's name in the button", () => {
    const markup = html("ar", { blocks: [project("masar", "تطبيق Masar للتوصيل")], openProject: { id: "masar", onBack: () => undefined } });
    expect(markup).toContain('dir="rtl"');
    expect(markup).toContain("العودة إلى نايا الدباس");
    expect(markup).toMatch(/<h1[^>]*>تطبيق Masar للتوصيل<\/h1>/);
    // The arrow points the other way.
    expect(markup).toContain("rtl:-scale-x-100");
  });

  it("stays on the portfolio when the opened project is unknown, hidden or no project", () => {
    const hidden: Block = { ...project("geheim", "Geheim"), visible: false };
    for (const id of ["nope", "geheim", "shop"]) {
      const markup = html("de", { blocks: [...work, hidden], openProject: { id, onBack: () => undefined } });
      expect(markup, id).toContain('<li id="hafenlicht"');
      expect(markup, id).not.toContain("Zurück zu");
      expect(markup, id).not.toContain("Geheim");
    }
  });

  it("without a way back (a routed page) the stub shows no button", async () => {
    const { ProjectPage } = await import("./project-page");
    const block = project("werft", "Werft bei Nacht");
    if (block.type !== "project") throw new Error("fixture");
    const markup = provided("de", createElement(ProjectPage, { page: page("de", [block]), theme: resolveCreatorTheme({ template: "tiefdruck" }), project: block }));
    expect(markup).toMatch(/<h1[^>]*>Werft bei Nacht<\/h1>/);
    expect(markup).not.toContain("<button");
    expect(markup).toContain("<main");
  });

  it("a brands block without any logo is a list of names (not tiles); one logo keeps the tiles", () => {
    const names: Block = {
      ...base,
      id: "kunden",
      type: "brands",
      title: "Kunden",
      columns: 3,
      items: [{ name: "Stadtwerk Beispiel" }, { name: "Bäckerei Beispiel", logo: { src: "none:", alt: "" } }, { name: "Kiez Radio", url: "https://example.com/kiez-radio", logo: { src: "none:", alt: "" } }],
    };
    const tiles: Block = { ...base, id: "partner", type: "brands", title: "Partner", columns: 3, items: [{ name: "Studio Nord", logo: { src: "sample:brand-audio", alt: "" } }, { name: "Ohne Logo" }] };
    const TILE = "block aspect-square overflow-hidden rounded-creator-card";
    // The designed names list comes with the sections. Until then the names are a plain list: a
    // partner block made today without logos (the editor allows it) never loses its content.
    const plain = html("de", { blocks: [names] });
    expect(plain).toContain("Kunden");
    expect(plain).not.toContain(TILE);
    expect(plain).toMatch(/<li[^>]*>Stadtwerk Beispiel<\/li>/);
    expect(plain).toMatch(/<li[^>]*>Bäckerei Beispiel<\/li>/);
    // A name that led somewhere still does.
    expect(plain).toMatch(/<li[^>]*><a href="https:\/\/example\.com\/kiez-radio"[^>]*>Kiez Radio<\/a><\/li>/);
    // Without a title the block is still on the page.
    const untitled = html("de", { blocks: [{ ...names, title: undefined }] });
    expect(untitled).toContain("Stadtwerk Beispiel");
    const grid = html("de", { blocks: [tiles] });
    expect(grid).toContain("Studio Nord");
    expect(grid).toContain("Ohne Logo");
    expect(grid.split(TILE)).toHaveLength(3);
  });
});
