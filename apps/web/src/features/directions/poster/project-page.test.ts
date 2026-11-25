import { pageSchema, type Block, type BlockOf, type Page } from "@linkyo/blocks";
import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { NextIntlClientProvider } from "next-intl";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";

import { codeLines } from "./code-box";
import { findProject, ProjectPage, structuredData } from "./project-page";
import { PosterRenderer } from "./renderer";
import { portfolioSample } from "./sample";

// A project's own page, rendered to HTML in Node (no browser, no testing library) and read as a
// tree: what a visitor's browser gets before any script runs.

type Project = BlockOf<"project">;

// ─── A small reader for the rendered HTML ─────────────────────────────────────────────────────

interface El {
  tag: string;
  attrs: Record<string, string>;
  children: (El | string)[];
  parent: El | null;
}

const VOID = new Set(["img", "input", "br", "hr", "link", "meta", "source"]);
const RAW = new Set(["script", "style"]);
const decode = (value: string): string =>
  value
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
    const [whole, closing, tag, attributes, selfClosing, raw] = match;
    if (raw !== undefined) {
      // Script and style contents are not markup: kept as they are.
      current.children.push(RAW.has(current.tag) ? raw : decode(raw));
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
const tagged = (tag: string) => (element: El) => element.tag === tag;
const has = (name: string) => (element: El) => element.attrs[name] !== undefined;
/** The element and every element around it. */
const ancestors = (node: El): El[] => (node.parent ? [node, ...ancestors(node.parent)] : [node]);
/** Document order of two elements: negative when `a` comes first. */
function order(root: El, a: El, b: El): number {
  const list = elements(root);
  return list.indexOf(a) - list.indexOf(b);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────────────────────

const base = { visible: true, highlight: false } as const;
const HOSTILE = "</script><script>alert(1)</script>";

const full = (extra: Partial<Project> = {}): Project => ({
  ...base,
  id: "hafen",
  type: "project",
  slug: "hafenlicht",
  title: "Hafenlicht",
  summary: "Eine Woche mit Nordseefischern.",
  client: "Hafenbetrieb Nord",
  role: "Fotografie",
  year: { from: 2023, to: 2025 },
  tags: ["Reportage", "Porträt"],
  cover: { src: "sample:ex-pf-ronja-06", alt: "Ein Kutter im Morgenlicht", w: 2240, h: 1399 },
  results: [
    { value: "9 → 3", label: "Wochen Wartezeit" },
    { value: "12", label: "Bilder" },
  ],
  story: { about: "Vom Auslaufen bis zur Auktion.", problem: "Niemand sah die Arbeit.", result: "Eine Ausstellung im Hafen." },
  pictures: [
    { image: { src: "sample:ex-pf-ronja-07", alt: "Netze an Deck", w: 1600, h: 1067 }, caption: "Netze an Deck" },
    { image: { src: "sample:ex-pf-ronja-08", alt: "Ein Fischer", w: 1067, h: 1600 } },
    { image: { src: "sample:ex-pf-ronja-09", alt: "", w: 1067, h: 1600 }, decorative: true },
    { image: { src: "sample:ex-pf-ronja-10", alt: "", w: 1600, h: 1600 } },
  ],
  ...extra,
});

const code: Project = {
  ...base,
  id: "chart",
  type: "project",
  slug: "rasterblick",
  title: "rasterblick",
  summary: "Diagramme für dichte Zeitreihen.",
  year: { from: 2024, to: "now" },
  tags: ["TypeScript"],
  source: { owner: "mats", repo: "rasterblick", stars: 1280, language: "TypeScript", license: "MIT", install: "npm install rasterblick" },
  code: { text: 'const a = "b"; // eins\n\n/* zwei\n   drei */\nrun(a);', lang: "ts", file: "orders.ts" },
};

const figureOnly: Project = { ...base, id: "termine", type: "project", slug: "termine", title: "Termine", summary: "Online buchen.", results: [{ value: "3", label: "Klicks" }], story: { solution: "Ein Formular." } };

const contact: Block = { ...base, id: "contact", type: "contact", title: "Ein Projekt im Kopf?", primary: { label: "Schreib mir", url: "mailto:mats@example.com" } };

const page = (locale: "de" | "ar", blocks: Block[]): Page => ({
  profile: { username: "mats", displayName: locale === "ar" ? "نايا الدباس" : "Mats Brandt", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale },
  blocks,
});

const render = (locale: "de" | "ar", project: Project, blocks: Block[] = [project], props: Partial<Parameters<typeof ProjectPage>[0]> = {}): El =>
  parse(
    renderToStaticMarkup(
      createElement(NextIntlClientProvider, {
        locale,
        messages: locale === "ar" ? ar : de,
        timeZone: "Europe/Berlin",
        children: createElement(ProjectPage, {
          page: page(locale, blocks),
          theme: resolveCreatorTheme({ template: "werkbogen" }, { rtlScript: locale === "ar" }),
          project,
          base: "/mats",
          backHref: `/mats#${project.slug}`,
          ...props,
        }) as ReactNode,
      }),
    ),
  );

const html = (locale: "de" | "ar", project: Project, blocks: Block[] = [project], props: Partial<Parameters<typeof ProjectPage>[0]> = {}): string =>
  renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale,
      messages: locale === "ar" ? ar : de,
      timeZone: "Europe/Berlin",
      children: createElement(ProjectPage, { page: page(locale, blocks), theme: resolveCreatorTheme({ template: "tiefdruck" }), project, base: "/mats", ...props }) as ReactNode,
    }),
  );

const article = (tree: El): El => one(tree, tagged("article"), "article");
const jsonLdOf = (tree: El): Record<string, unknown> => JSON.parse(text(one(tree, (element) => element.tag === "script" && element.attrs.type === "application/ld+json", "JSON-LD"))) as Record<string, unknown>;

// ─── Tests ────────────────────────────────────────────────────────────────────────────────────

describe("the project page's structure", () => {
  it("the fixtures are valid pages", () => {
    expect(pageSchema.safeParse(page("de", [full(), code, figureOnly, contact])).success).toBe(true);
  });

  it("has one h1, the title, and h2s only for the filled story parts, in their fixed order", () => {
    const tree = render("de", full());
    expect(all(tree, tagged("h1")).map(text)).toEqual(["Hafenlicht"]);
    expect(all(article(tree), tagged("h2")).map(text)).toEqual(["Ausgangslage", "Ergebnis"]);
    expect(all(article(render("de", figureOnly)), tagged("h2")).map(text)).toEqual(["Vorgehen"]);
    expect(all(article(render("de", { ...figureOnly, story: {} })), tagged("h2"))).toEqual([]);
  });

  it("prints the result figures directly under the title block, before the facts", () => {
    const tree = render("de", full());
    const figures = one(tree, (element) => element.attrs.role === "group" && element.attrs["aria-label"] === "Ergebnis in Zahlen", "figures");
    expect(one(figures, tagged("dl"), "figures list")).toBeDefined();
    const facts = one(tree, (element) => element.tag === "dl" && text(element).includes("Rolle"), "facts");
    const title = one(tree, tagged("h1"), "title");
    expect(order(tree, title, figures)).toBeLessThan(0);
    expect(order(tree, figures, facts)).toBeLessThan(0);
    expect(text(facts)).toContain("Hafenbetrieb Nord");
    expect(text(facts)).toContain("2023–2025");
  });

  it("puts a year range and each figure in one <bdi>", () => {
    const tree = render("de", full());
    const bdis = all(tree, tagged("bdi")).map(text);
    expect(bdis).toContain("2023–2025");
    expect(bdis).toContain("9 → 3");
    expect(bdis).toContain("12");
    expect(all(render("de", code), tagged("bdi")).map(text)).toContain("2024–heute");
  });

  it("marks an AI-written project on its root, and nothing else", () => {
    expect(article(render("de", full({ origin: "ai" }))).attrs["data-ai-generated"]).toBe("true");
    expect(article(render("de", full({ origin: "ai-edited" }))).attrs["data-ai-generated"]).toBe("true");
    expect(all(render("de", full()), has("data-ai-generated"))).toEqual([]);
  });
});

describe("pictures", () => {
  it("every picture box carries its stored ratio (3:2 when unknown)", () => {
    const tree = render("de", full({ pictures: [...(full().pictures ?? []), { image: { src: "sample:ex-pf-ronja-11", alt: "Ohne Maße" } }] }));
    const boxes = all(tree, (element) => element.attrs["data-picture-box"] !== undefined || element.attrs["data-cover"] !== undefined);
    // The cover, three shown pictures and the one without a stored size (the undescribed one waits).
    expect(boxes.length).toBe(5);
    expect(boxes.filter((box) => box.attrs["data-w"] === undefined)).toHaveLength(1);
    for (const box of boxes) {
      const { w, h } = { w: box.attrs["data-w"], h: box.attrs["data-h"] };
      expect(box.attrs.style, `${String(w)}x${String(h)}`).toContain(w && h ? `aspect-ratio:${w} / ${h}` : "aspect-ratio:3 / 2");
    }
  });

  it("preloads exactly one picture in picture mode (the cover) and none otherwise", () => {
    const eager = (tree: El) => all(tree, (element) => element.tag === "img" && element.attrs.loading === "eager");
    const tree = render("de", full());
    expect(eager(tree)).toHaveLength(1);
    expect(eager(tree)[0]?.attrs.alt).toBe("Ein Kutter im Morgenlicht");
    expect(eager(render("de", figureOnly))).toHaveLength(0);
    expect(eager(render("de", code))).toHaveLength(0);
    // In a preview nothing is preloaded.
    expect(eager(render("de", full(), [full()], { preview: true }))).toHaveLength(0);
  });

  it("names a picture link by its description and the enlarge words, without aria-label", () => {
    const tree = render("de", full());
    const links = all(tree, has("data-viewer"));
    // The fourth picture has no description and is not decorative: it waits in the editor.
    expect(links).toHaveLength(3);
    for (const link of links) expect(link.attrs["aria-label"]).toBeUndefined();
    expect(text(links[0]!)).toBe("Vergrößern, Bild 1 von 3");
    // The description is the image's alt, which is the first part of the link's name.
    expect(one(links[0]!, tagged("img"), "img").attrs.alt).toBe("Netze an Deck");
    expect(one(links[1]!, tagged("img"), "img").attrs.alt).toBe("Ein Fischer");
    // A decorative picture is named by the hidden words alone.
    expect(one(links[2]!, tagged("img"), "img").attrs.alt).toBe("");
    expect(text(links[2]!)).toBe("Vergrößern, Bild 3 von 3");
    expect(html("de", full())).not.toContain("ex-pf-ronja-10");
    // A link opens the large file from our own image optimizer.
    for (const link of links) expect(link.attrs.href).toMatch(/^\/_next\/image\?url=/);
  });

  it("shows the first described picture as the cover when the project has none", () => {
    const tree = render("de", full({ cover: undefined }));
    const cover = one(tree, has("data-cover"), "cover");
    expect(one(cover, tagged("img"), "cover img").attrs.alt).toBe("Netze an Deck");
    expect(all(tree, has("data-viewer"))).toHaveLength(2);
  });
});

describe("code and repository", () => {
  it("keeps the code box left to right, a named focusable region, with exactly the sample's text", () => {
    for (const locale of ["de", "ar"] as const) {
      const tree = render(locale, code);
      const box = one(tree, has("data-code-box"), "code box");
      expect(box.attrs.dir).toBe("ltr");
      const region = one(box, (element) => element.attrs.role === "region", "region");
      expect(region.attrs.tabindex).toBe("0");
      expect(region.attrs["aria-label"]).toContain("orders.ts");
      expect(one(box, tagged("pre"), "pre").attrs.dir).toBe("ltr");
      expect(text(one(box, has("data-code"), "code"))).toBe(code.code?.text);
    }
  });

  it("splits toned tokens at line ends and joins back to the sample", () => {
    const lines = codeLines(code.code?.text ?? "", "ts");
    expect(lines.map((line) => line.map((token) => token.text).join("")).join("\n")).toBe(code.code?.text);
    expect(lines).toHaveLength(5);
    expect(lines[2]?.[0]?.tone).toBe("comment");
    expect(lines[3]?.[0]?.tone).toBe("comment");
  });

  it("on an Arabic page keeps code, file name, owner/repo and the install command left to right", () => {
    const tree = render("ar", code);
    const ltr = (value: string) => all(tree, (element) => text(element).includes(value)).some((element) => ancestors(element).some((up) => up.attrs.dir === "ltr"));
    for (const value of ["orders.ts", "mats/rasterblick", "npm install rasterblick", 'const a = "b";']) expect(ltr(value), value).toBe(true);
    expect(one(tree, tagged("h1"), "title").attrs.dir).toBe("auto");
  });

  it("chooses the JSON-LD type by the repository", () => {
    expect(jsonLdOf(render("de", code))["@type"]).toBe("SoftwareSourceCode");
    expect(jsonLdOf(render("de", code)).codeRepository).toBe("https://github.com/mats/rasterblick");
    expect(jsonLdOf(render("de", full()))["@type"]).toBe("CreativeWork");
    expect(structuredData(page("de", [full()]), full())).not.toHaveProperty("client");
  });
});

describe("what must not reach the page", () => {
  it("hostile text renders exactly one </script>: the one closing the JSON-LD", () => {
    const hostile = full({
      title: `T${HOSTILE}`.slice(0, 60),
      summary: `S ${HOSTILE}`,
      tags: [HOSTILE.slice(0, 24), "x</script>"],
      results: [{ value: "</script>", label: "y</script>" }],
      code: { text: `a = 1; ${HOSTILE}`, lang: "js" },
    });
    const out = html("de", hostile, [hostile]);
    expect(out.match(/<\/script>/g)).toHaveLength(1);
    expect(out.match(/<script/g)).toHaveLength(1);
    const tree = parse(out);
    expect(jsonLdOf(tree).name).toBe(hostile.title);
  });

  it("a confidential project shows the word for it and no client, in the HTML and the JSON-LD", () => {
    // The block deliberately carries both fields, which the schema refuses and filterPublic strips:
    // this checks the renderer's own guard, the only one where a page is shown unfiltered (previews).
    const forged = full({ confidential: true });
    expect(forged.client).toBe("Hafenbetrieb Nord");
    const tree = render("de", forged);
    expect(text(tree)).toContain("Vertraulich");
    expect(text(tree)).not.toContain("Hafenbetrieb");
    expect(JSON.stringify(jsonLdOf(tree))).not.toContain("Hafenbetrieb");
    // As the editor stores it: "Confidential" switched on clears the name.
    const saved = full({ confidential: true, client: undefined });
    expect(text(render("de", saved))).toContain("Vertraulich");
    expect(text(render("ar", saved))).toContain("عميل لم يُذكر اسمه");
  });
});

describe("the bar, Linkyo's chrome and the way on", () => {
  it("leads back to the card it came from, named 'Back to …'", () => {
    const tree = render("de", full());
    const bar = one(tree, has("data-project-bar"), "bar");
    const back = one(bar, (element) => element.tag === "a" && element.attrs.href === "/mats#hafenlicht", "back link");
    // Named once with the whole words, which are also its text; a phone shows the name alone.
    expect(back.attrs["aria-label"]).toBe("Zurück zu Mats Brandt");
    expect(text(back)).toBe("Zurück zu Mats Brandt");
    expect(one(back, has("data-name"), "visible name").attrs["data-name"]).toBe("Mats Brandt");
    // Without a contact block there is no primary action anywhere.
    expect(all(tree, has("data-bar-action"))).toEqual([]);
    const withContact = render("de", full(), [full(), contact]);
    expect(text(one(withContact, has("data-bar-action"), "bar action"))).toBe("Schreib mir");
  });

  it("shows the primary action as one 44 px icon button on a phone, named by its whole label", () => {
    const withContact = render("de", full(), [full(), contact]);
    const action = one(withContact, has("data-bar-action"), "bar action");
    const classes = action.attrs.class ?? "";
    // One 44 px touch target below the column width (the owner's name gets the rest of the bar), the label's own width from there.
    expect(classes).toMatch(/(^|\s)w-touch-target(\s|$)/);
    expect(classes).toMatch(/(^|\s)@prose:w-auto(\s|$)/);
    // The glyph for phones: one icon, hidden from the column width up.
    expect(all(action, (element) => element.tag === "svg" && (element.attrs.class ?? "").includes("@prose:hidden"))).toHaveLength(1);
    // The label is in the control (it names the link), visually hidden on phones, the text itself from the column width up.
    const label = one(action, (element) => element.tag === "span" && (element.attrs.class ?? "").includes("@max-prose:sr-only"), "label");
    expect(text(label)).toBe("Schreib mir");
    expect(label.attrs.class).toContain("@prose:truncate");
    // The old rule let the button take half the bar and cut the name; the name keeps its own flexible box.
    expect(classes).not.toMatch(/(^|\s)max-w-1\/2(\s|$)/);
  });

  it("with an overlay, the badge follows the bar in the DOM and is not absolutely placed", () => {
    const badge = createElement("aside", { "data-test-badge": "" }, "Beispiel");
    const tree = render("de", full(), [full()], { overlay: badge });
    const bar = one(tree, has("data-project-bar"), "bar");
    const placed = one(tree, has("data-test-badge"), "badge");
    expect(order(tree, bar, placed)).toBeLessThan(0);
    for (const up of ancestors(placed)) expect(up.attrs.class ?? "", up.tag).not.toMatch(/(^|\s)(absolute|fixed)(\s|$)/);
  });

  it("links on to the next project that has a page, wrapping to the first; none when no other has one", () => {
    const thin: Project = { ...base, id: "thin", type: "project", slug: "thin", title: "Dünn", summary: "Nur ein Link.", links: [{ url: "https://example.com" }] };
    const blocks = [figureOnly, thin, full()];
    const nav = (tree: El) => all(tree, (element) => element.tag === "nav" && element.attrs["aria-label"] === "Nächstes Projekt");
    expect(one(nav(render("de", full(), blocks))[0]!, tagged("a"), "next").attrs.href).toBe("/mats/termine");
    expect(one(nav(render("de", figureOnly, blocks))[0]!, tagged("a"), "next").attrs.href).toBe("/mats/hafenlicht");
    expect(nav(render("de", full(), [full(), thin]))).toEqual([]);
  });

  it("closes with the page's contact band under 'Planning something similar?'", () => {
    const tree = render("de", full(), [full(), contact]);
    expect(text(tree)).toContain("Ähnliches vor?");
    expect(text(tree)).toContain("Ein Projekt im Kopf?");
    expect(text(render("de", full()))).not.toContain("Ähnliches vor?");
  });

  it("opened in place in a preview, the way back is a button with the same name", () => {
    const sample = portfolioSample("de");
    const tree = parse(
      renderToStaticMarkup(
        createElement(NextIntlClientProvider, {
          locale: "de",
          messages: de,
          timeZone: "Europe/Berlin",
          children: createElement(PosterRenderer, { page: sample, theme: resolveCreatorTheme({ template: "werkbogen" }), preview: true, openProject: { id: "harbour", onBack: () => undefined } }) as ReactNode,
        }),
      ),
    );
    expect(all(tree, tagged("h1")).map(text)).toEqual([sample.blocks.find((block): block is Project => block.type === "project" && block.id === "harbour")?.title]);
    expect(text(one(tree, tagged("button"), "back button"))).toBe("Zurück zu Mila Aurel");
    // A preview sits inside the dashboard's <main>, writes no JSON-LD and preloads nothing.
    expect(all(tree, tagged("main"))).toEqual([]);
    expect(all(tree, tagged("script"))).toEqual([]);
  });
});

describe("findProject", () => {
  it("finds an active project, the first of a slug stored twice, and an earlier address", () => {
    const twice = { ...figureOnly, id: "zwei", slug: "hafenlicht", title: "Doppelt" };
    const moved = full({ was: ["alt-1", "alt-2"] });
    expect(findProject(page("de", [moved, twice]), "hafenlicht")).toEqual({ kind: "found", project: moved });
    expect(findProject(page("de", [moved]), "alt-2")).toEqual({ kind: "moved", slug: "hafenlicht" });
    expect(findProject(page("de", [full({ visible: false })]), "hafenlicht")).toBeNull();
    expect(findProject(page("de", [full({ schedule: { from: "2999-01-01T00:00:00Z" } })]), "hafenlicht")).toBeNull();
    expect(findProject(page("de", [full()]), "unbekannt")).toBeNull();
  });
});
