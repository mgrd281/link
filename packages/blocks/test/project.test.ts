import { describe, expect, it } from "vitest";

import { KINDS } from "../src/kinds";
import {
  bentoRows,
  chooseProjectsLayout,
  contactStatus,
  coverImage,
  coverMode,
  FALLBACK_SLUG,
  figureSize,
  formatYears,
  hasDetail,
  linkLabelKey,
  nearestRatio,
  nextPageStep,
  nextStep,
  plateRows,
  primaryAction,
  projectTarget,
  sectionKindOf,
  sectionOrder,
  shownPictures,
  slugFor,
  slugWord,
  suggestBlockOrder,
  suggestOrder,
  tintCode,
  type Project,
  type ProjectStep,
  type SectionKind,
} from "../src/project";
import { FEATURED_PROJECTS, isProjectSlug, PROJECT_SLUG_MAX } from "../src/rules";
import { blockSchema, CODE_LANGS, isBlockActive, pageSchema, type Block, type BlockOf } from "../src/schema";

const base = { visible: true, highlight: false } as const;
const img = (name: string, alt = "", w?: number, h?: number) => ({ src: `https://cdn.example.com/${name}.jpg`, alt, ...(w && h ? { w, h } : {}) });
const project = (extra: Partial<Project> = {}): Project => ({ ...base, id: "p1", type: "project", slug: "tidewatch", title: "Tidewatch", summary: "A tide table sailors can read at a glance.", ...extra });
const withPicture = (id: string): Project => project({ id, slug: id, cover: img(id, "A picture") });
const plain = (id: string): Project => project({ id, slug: id });
const quotesAbout = (id: string): BlockOf<"quotes"> => ({ ...base, id: "q1", type: "quotes", items: [{ text: "He listens first.", name: "M. K.", role: "Managing director", consent: true, project: id }] });
const contact = (extra: Partial<BlockOf<"contact">> = {}): BlockOf<"contact"> => ({ ...base, id: "c1", type: "contact", title: "A project in mind?", primary: { label: "Book an intro call", url: "https://example.com/call" }, ...extra });
const link = (id: string, highlight = false): Block => ({ ...base, highlight, id, type: "link", title: id, url: `https://example.com/${id}` });
const header = (id: string): Block => ({ ...base, id, type: "header", title: id });

describe("slugFor", () => {
  it.each([
    ["Größe & Maß – Küche für Familie Öztürk", "de", "groesse-mass-kueche-fuer-familie-oeztuerk"],
    ["Tidewatch", "en", "tidewatch"],
    ["  Hafen — Licht!  ", "de", "hafen-licht"],
    ["Smørrebrød på Ærø, Århus", "en", "smorrebrod-pa-aero-arhus"],
    ["Crème brûlée, façade & niño", "en", "creme-brulee-facade-nino"],
    ["مشروع التخرج", "ar", "project-1"],
    ["مشروع التخرج", "de", "projekt-1"],
    ["تطبيق Masar للتوصيل", "ar", "masar"],
    ["Work", "de", "projekt-1"],
    ["CV", "en", "project-1"],
    ["2024", "en", "project-1"],
    ["X", "en", "project-1"],
    ["", "en", "project-1"],
    ["C++ & C#", "en", "c-c"],
    ["+++", "en", "project-1"],
    ["Version 2.0", "en", "version-2-0"],
  ])("%s (%s) → %s", (title, locale, expected) => {
    const slug = slugFor(title, [], slugWord(locale));
    expect(slug).toBe(expected);
    expect(isProjectSlug(slug)).toBe(true);
  });

  it("writes a decomposed umlaut out like a composed one", () => {
    expect(slugFor("Küche", [], "projekt")).toBe("kueche");
  });

  it("cuts a long title to 48 characters; its duplicate keeps 45 and gets -2", () => {
    const title = "abcdefghij".repeat(6);
    const first = slugFor(title, [], "project");
    expect(first).toBe(title.slice(0, 48));
    expect(first).toHaveLength(PROJECT_SLUG_MAX);
    const second = slugFor(title, [first], "project");
    expect(second).toBe(`${title.slice(0, 45)}-2`);
    expect(slugFor(title, [first, second], "project")).toBe(`${title.slice(0, 45)}-3`);
    // Never a dash at the cut.
    expect(slugFor(`${"a".repeat(47)} b c`, [], "project")).toBe("a".repeat(47));
    expect(slugFor(`${"a".repeat(44)} b c`, ["a".repeat(44) + "-b-c"], "project")).toBe(`${"a".repeat(44)}-2`);
  });

  it("counts past a taken address, and a taken `was` value counts as taken", () => {
    expect(slugFor("Tidewatch", ["tidewatch"], "project")).toBe("tidewatch-2");
    expect(slugFor("Tidewatch", ["tidewatch", "tidewatch-2"], "project")).toBe("tidewatch-3");
    const page: Project[] = [project({ slug: "harbour", was: ["tidewatch"] })];
    const taken = page.flatMap((item) => [item.slug, ...(item.was ?? [])]);
    expect(slugFor("Tidewatch", taken, "project")).toBe("tidewatch-2");
    expect(slugFor("مشروع", ["project-1", "project-3"], "project")).toBe("project-2");
    expect(slugFor("مشروع", new Set(["projekt-1", "projekt-2"]), "projekt")).toBe("projekt-3");
  });

  it("tries the repository's name before the fallback word", () => {
    expect(slugFor("أداة المد والجزر", [], "project", "tide-table.js")).toBe("tide-table-js");
    expect(slugFor("Tidewatch", [], "project", "tw")).toBe("tidewatch");
    expect(slugFor("أداة", ["tw"], "project", "tw")).toBe("tw-2");
    expect(slugFor("أداة", [], "project", "api")).toBe("project-1");
    expect(FALLBACK_SLUG.test("project-12")).toBe(true);
    expect(FALLBACK_SLUG.test("projekt-1")).toBe(true);
    expect(FALLBACK_SLUG.test("project-one")).toBe(false);
  });
});

describe("covers and pictures", () => {
  it.each([
    ["a cover", project({ cover: img("c") }), "picture"],
    ["no cover, a first picture", project({ pictures: [{ image: img("a") }] }), "picture"],
    ["a result and no picture", project({ results: [{ value: "9 → 3", label: "taps" }] }), "figure"],
    ["a picture beats a result", project({ cover: img("c"), results: [{ value: "8", label: "months" }] }), "picture"],
    ["nothing", project(), "title"],
    ["an empty cover (no picture yet) and a result", project({ cover: { src: "none:", alt: "" }, results: [{ value: "8", label: "months" }] }), "figure"],
    ["an empty results list", project({ results: [] }), "title"],
  ] as const)("coverMode with %s is %s", (_, value, expected) => {
    expect(coverMode(value)).toBe(expected);
  });

  it("coverImage is the cover, else the first picture", () => {
    expect(coverImage(project({ cover: img("c"), pictures: [{ image: img("a") }] }))?.src).toContain("/c.jpg");
    expect(coverImage(project({ pictures: [{ image: img("a") }, { image: img("b") }] }))?.src).toContain("/a.jpg");
    expect(coverImage(project())).toBeUndefined();
  });

  it("shownPictures drops exactly the pictures with neither a description nor the decorative mark", () => {
    const pictures = [
      { image: img("described", "The quay at dawn") },
      { image: img("waiting") },
      { image: img("decorative"), decorative: true },
      { image: img("blank", "   ") },
      { image: img("not-decorative"), decorative: false },
      { image: img("both", "Nets"), decorative: true, caption: "Nets drying" },
    ];
    expect(shownPictures(project({ pictures })).map((picture) => picture.image.src.split("/").at(-1))).toEqual(["described.jpg", "decorative.jpg", "both.jpg"]);
    expect(shownPictures(project())).toEqual([]);
  });
});

describe("hasDetail and projectTarget", () => {
  const source = { owner: "example", repo: "tidewatch", stars: 412, language: "TypeScript", license: "MIT" };

  it.each([
    ["a title and a sentence", project(), false],
    ["a link only", project({ links: [{ url: "https://example.com" }] }), false],
    ["repository facts only", project({ source, links: [{ url: "https://github.com/example/tidewatch" }] }), false],
    ["a repository with an install command", project({ source: { ...source, install: "npm install tidewatch" } }), true],
    ["a repository with a code sample", project({ source, code: { text: "tide(at)" } }), true],
    ["a repository with a story part", project({ source, story: { solution: "One line per day." } }), true],
    ["a story part of spaces", project({ story: { problem: "   " } }), false],
    ["a result figure", project({ results: [{ value: "8", label: "months" }] }), true],
    ["a result in words", project({ story: { result: "People check before they leave." } }), true],
    ["a cover only", project({ cover: img("c", "Cover") }), false],
    ["one shown picture and no cover", project({ pictures: [{ image: img("a", "A") }] }), false],
    ["a cover and one shown picture", project({ cover: img("c"), pictures: [{ image: img("a", "A") }] }), true],
    ["a cover and one picture that waits for its description", project({ cover: img("c"), pictures: [{ image: img("a") }] }), false],
    ["two shown pictures", project({ pictures: [{ image: img("a", "A") }, { image: img("b"), decorative: true }] }), true],
    ["tags, role, year and client", project({ tags: ["Maps"], role: "Design", year: { from: 2024 }, client: "A sailing club" }), false],
  ] as const)("%s → %s", (_, value, expected) => {
    expect(hasDetail(value, [])).toBe(expected);
  });

  it("a quote about the project is more to read; a quote about another one is not", () => {
    expect(hasDetail(project(), [quotesAbout("p1")])).toBe(true);
    expect(hasDetail(project(), [quotesAbout("other")])).toBe(false);
  });

  it("a card leads to the page, to the link, or nowhere", () => {
    const story = project({ story: { problem: "Tables were hard to read." }, links: [{ url: "https://example.com/app" }] });
    expect(projectTarget(story, "/mats", [])).toEqual({ kind: "page", href: "/mats/tidewatch" });
    expect(projectTarget(story, "/de/p/ronja-feldkamp", [])).toEqual({ kind: "page", href: "/de/p/ronja-feldkamp/tidewatch" });
    expect(projectTarget(story, "/de/directions/poster/work", [], "?chrome=0&template=werkbogen")).toEqual({ kind: "page", href: "/de/directions/poster/work/tidewatch?chrome=0&template=werkbogen" });
    expect(projectTarget(project({ links: [{ url: "https://example.com/talk" }, { url: "https://example.com/2" }] }), "/mats", [])).toEqual({ kind: "link", href: "https://example.com/talk" });
    expect(projectTarget(project(), "/mats", [quotesAbout("p1")])).toEqual({ kind: "page", href: "/mats/tidewatch" });
    expect(projectTarget(project(), "/mats", [])).toEqual({ kind: "none" });
    // A repository-only project opens the repository, with or without the stored link.
    expect(projectTarget(project({ source, links: [{ url: "https://github.com/example/tidewatch" }] }), "/mats", [])).toEqual({ kind: "link", href: "https://github.com/example/tidewatch" });
    expect(projectTarget(project({ source }), "/mats", [])).toEqual({ kind: "link", href: "https://github.com/example/tidewatch" });
  });

  it.each([
    ["https://github.com/example/tidewatch", "linkViewCode"],
    ["https://www.gitlab.com/example/tidewatch", "linkViewCode"],
    ["https://codeberg.org/example/tidewatch", "linkViewCode"],
    ["https://gist.github.com/example/1", "linkViewCode"],
    ["https://www.youtube.com/watch?v=abc", "linkWatch"],
    ["https://youtu.be/abc", "linkWatch"],
    ["https://player.vimeo.com/video/1", "linkWatch"],
    ["https://open.spotify.com/episode/1", "linkListen"],
    ["https://podcasts.apple.com/de/podcast/x/id1", "linkListen"],
    ["https://soundcloud.com/example/set", "linkListen"],
    ["https://example.com/files/Case-Study.PDF", "linkOpenPdf"],
    ["https://example.com/cv.pdf?download=1", "linkOpenPdf"],
    ["https://example.com/pdf", "linkView"],
    ["https://notgithub.com/x", "linkView"],
    ["https://example.com/github.com", "linkView"],
    ["mailto:hello@example.com", "linkView"],
    ["not an address", "linkView"],
  ] as const)("linkLabelKey(%s) is %s", (url, expected) => {
    expect(linkLabelKey(url)).toBe(expected);
  });
});

describe("chooseProjectsLayout", () => {
  const mix = (pictures: number, total: number) => [...Array.from({ length: pictures }, (_, index) => withPicture(`pic-${String(index)}`)), ...Array.from({ length: total - pictures }, (_, index) => plain(`text-${String(index)}`))];

  it.each([
    ["3 of 4 with pictures", mix(3, 4), 0, "auto", "bento"],
    ["1 of 4 with pictures", mix(1, 4), 0, "auto", "list"],
    ["2 of 4 with pictures (under 60 %)", mix(2, 4), 0, "auto", "list"],
    ["3 of 5 with pictures (60 %)", mix(3, 5), 0, "auto", "bento"],
    ["2 in the first group, both pictures", mix(2, 2), 0, "auto", "list"],
    ["2 picture projects in a later group", mix(2, 2), 1, "auto", "rail"],
    ["6 picture projects in a later group", mix(6, 6), 2, "auto", "rail"],
    ["7 picture projects in a later group", mix(7, 7), 1, "auto", "bento"],
    ["a later group with one text project", mix(3, 4), 1, "auto", "bento"],
    ["a later group of two with one text project", mix(1, 2), 1, "auto", "list"],
    ["one project", mix(1, 1), 0, "auto", "list"],
    ["no project", [], 0, "auto", "list"],
    ["7 chosen as rail", mix(7, 7), 0, "rail", "list"],
    ["1 chosen as rail", mix(1, 1), 0, "rail", "list"],
    ["2 text projects chosen as rail", mix(0, 2), 0, "rail", "rail"],
    ["6 chosen as rail", mix(3, 6), 0, "rail", "rail"],
    ["2 chosen as bento", mix(2, 2), 0, "bento", "list"],
    ["3 chosen as bento, 1 picture (under half)", mix(1, 3), 0, "bento", "list"],
    ["4 chosen as bento, 2 pictures (half)", mix(2, 4), 0, "bento", "bento"],
    ["4 picture projects chosen as list", mix(4, 4), 0, "list", "list"],
  ] as const)("%s → %s", (_, group, groupIndex, wanted, expected) => {
    expect(chooseProjectsLayout(group, groupIndex, wanted)).toBe(expected);
  });

  it("counts shares on the six projects the run shows", () => {
    // Six pictures first, then four text projects: the shown six decide.
    expect(chooseProjectsLayout([...mix(6, 6), ...mix(0, 4)], 0, "auto")).toBe("bento");
    expect(chooseProjectsLayout([...mix(0, 6), ...mix(4, 4)], 0, "bento")).toBe("list");
    expect(FEATURED_PROJECTS).toBe(6);
  });
});

describe("bentoRows", () => {
  it.each([
    [1, [{ lead: true, tiles: 1 }]],
    [2, [{ lead: true, tiles: 2 }]],
    [3, [{ lead: true, tiles: 3 }]],
    [4, [{ lead: true, tiles: 3 }, { lead: false, tiles: 1 }]],
    [5, [{ lead: true, tiles: 3 }, { lead: false, tiles: 2 }]],
    [6, [{ lead: true, tiles: 3 }, { lead: false, tiles: 3 }]],
  ])("%i tiles", (count, rows) => {
    expect(bentoRows(count)).toEqual(rows);
    expect(bentoRows(count, false)).toEqual(rows);
  });

  it.each([
    [1, [{ lead: false, tiles: 1 }]],
    [2, [{ lead: false, tiles: 2 }]],
    [3, [{ lead: false, tiles: 3 }]],
    [4, [{ lead: false, tiles: 2 }, { lead: false, tiles: 2 }]],
    [5, [{ lead: false, tiles: 3 }, { lead: false, tiles: 2 }]],
    [6, [{ lead: false, tiles: 3 }, { lead: false, tiles: 3 }]],
  ])("%i tiles after the hero took the first project", (count, rows) => {
    expect(bentoRows(count, true)).toEqual(rows);
  });

  it("keeps page order, fills every tile once, and leaves a tile alone only for 1 and for 4", () => {
    for (const leadTaken of [false, true]) {
      for (let count = 1; count <= 6; count += 1) {
        const rows = bentoRows(count, leadTaken);
        expect(rows.reduce((sum, row) => sum + row.tiles, 0), `${String(count)} ${String(leadTaken)}`).toBe(count);
        expect(rows.filter((row) => row.lead)).toHaveLength(leadTaken ? 0 : 1);
        expect(rows[0]?.lead).toBe(!leadTaken);
        for (const row of rows) expect(row.tiles).toBeLessThanOrEqual(3);
        const alone = rows.some((row) => row.tiles === 1);
        expect(alone, `${String(count)} ${String(leadTaken)}`).toBe(count === 1 || (count === 4 && !leadTaken));
      }
    }
    expect(bentoRows(0)).toEqual([]);
    expect(bentoRows(9)).toEqual(bentoRows(6));
  });
});

describe("plateRows and nearestRatio", () => {
  const sized = (w?: number, h?: number) => ({ image: { src: "x", alt: "", ...(w && h ? { w, h } : {}) } });

  it("gives a landscape picture its own row and pairs upright ones", () => {
    const rows = plateRows([sized(2400, 1600), sized(1600, 2400), sized(1600, 2000), sized(2000, 2000), sized(2400, 1350), sized(1600, 2400), sized()]);
    expect(rows.map((row) => [row.kind, row.items.map((item) => item.index), row.kind === "pair" ? row.phone : null])).toEqual([
      ["full", [0], null],
      ["pair", [1, 2], "pair"],
      ["narrow", [3], null],
      ["full", [4], null],
      ["narrow", [5], null],
      ["full", [6], null],
    ]);
    expect(rows[0]?.items[0]?.ratio).toBeCloseTo(1.5);
    // A picture of unknown size is laid out at 3:2.
    expect(rows.at(-1)?.items[0]?.ratio).toBe(1.5);
  });

  it("stacks a pair on phones unless both are true portraits", () => {
    const phone = (a: [number, number], b: [number, number]) => {
      const [row] = plateRows([sized(...a), sized(...b)]);
      return row?.kind === "pair" ? row.phone : row?.kind;
    };
    expect(phone([1600, 2000], [1600, 2400])).toBe("pair");
    expect(phone([2000, 2000], [1600, 2400])).toBe("stack");
    expect(phone([1600, 2400], [2000, 1800])).toBe("stack");
    expect(phone([1600, 2400], [2400, 1600])).toBe("narrow");
    expect(plateRows([])).toEqual([]);
  });

  it.each([
    [1600, 2000, "portrait"],
    [1600, 2400, "portrait"],
    [2000, 2000, "square"],
    [2100, 2000, "square"],
    [2400, 1600, "photo"],
    [2400, 1800, "photo"],
    [2400, 1350, "video"],
    [3000, 1000, "video"],
    [undefined, undefined, "photo"],
    [2400, undefined, "photo"],
  ] as const)("nearestRatio(%s, %s) is %s", (w, h, expected) => {
    expect(nearestRatio(w, h)).toBe(expected);
  });
});

describe("the primary action", () => {
  const NOW = new Date("2026-11-23T12:00:00Z");

  it("comes from the contact block and from nothing else", () => {
    expect(primaryAction([link("a", true), link("b")], NOW)).toBeNull();
    expect(primaryAction([], NOW)).toBeNull();
    expect(primaryAction([link("a", true), contact()], NOW)).toEqual({ label: "Book an intro call", url: "https://example.com/call" });
    expect(primaryAction([contact({ id: "c1", primary: { label: "First", url: "https://example.com/1" } }), contact({ id: "c2", primary: { label: "Second", url: "https://example.com/2" } })], NOW)?.label).toBe("First");
  });

  it("ignores a contact block that is hidden or outside its schedule, as isBlockActive does", () => {
    const cases: BlockOf<"contact">[] = [
      contact({ visible: false }),
      contact({ schedule: { from: "2026-12-01T00:00:00Z" } }),
      contact({ schedule: { until: "2026-11-01T00:00:00Z" } }),
      contact({ schedule: { from: "2026-11-01T00:00:00Z", until: "2026-12-01T00:00:00Z" } }),
      contact(),
    ];
    for (const block of cases) expect(primaryAction([block], NOW) !== null, JSON.stringify(block.schedule ?? block.visible)).toBe(isBlockActive(block, NOW));
    expect(cases.map((block) => isBlockActive(block, NOW))).toEqual([false, false, false, true, true]);
  });

  it.each([
    ["a status without an end", { status: "Free from March 2027" }, "Free from March 2027"],
    ["its last day", { status: "Free in November", statusUntil: "2026-11-23" }, "Free in November"],
    ["a later last day", { status: "Free in November", statusUntil: "2026-11-30" }, "Free in November"],
    ["the day after", { status: "Free in November", statusUntil: "2026-11-22" }, null],
    ["an empty status", { status: "  " }, null],
    ["no status", {}, null],
    ["a date without a status", { statusUntil: "2027-01-01" }, null],
  ])("contactStatus with %s", (_, value, expected) => {
    expect(contactStatus(value, NOW)).toBe(expected);
  });
});

describe("section order", () => {
  const all: SectionKind[] = ["other", "contact", "timeline", "tools", "quotes", "clients", "about", "repositories", "work"];
  const ordered = (kind: Parameters<typeof suggestOrder>[1]) => suggestOrder(all, kind).map((index) => all[index]);

  it.each([
    ["designer", ["work", "about", "clients", "quotes", "tools", "timeline", "other", "repositories", "contact"]],
    ["photographer", ["work", "about", "clients", "quotes", "tools", "timeline", "other", "repositories", "contact"]],
    ["developer", ["work", "tools", "timeline", "repositories", "about", "quotes", "other", "clients", "contact"]],
    ["engineer", ["work", "tools", "timeline", "repositories", "about", "quotes", "other", "clients", "contact"]],
    ["coach", ["about", "work", "quotes", "timeline", "tools", "clients", "other", "repositories", "contact"]],
    ["lawyer", ["about", "work", "quotes", "timeline", "tools", "clients", "other", "repositories", "contact"]],
    ["writer", ["work", "about", "clients", "quotes", "timeline", "tools", "other", "repositories", "contact"]],
    ["journalist", ["work", "about", "clients", "quotes", "timeline", "tools", "other", "repositories", "contact"]],
    ["freelancer", ["work", "about", "quotes", "clients", "tools", "timeline", "other", "repositories", "contact"]],
    ["music", ["work", "about", "quotes", "clients", "tools", "timeline", "other", "repositories", "contact"]],
    [undefined, ["work", "about", "quotes", "clients", "tools", "timeline", "other", "repositories", "contact"]],
  ] as const)("%s", (kind, expected) => {
    expect(ordered(kind)).toEqual(expected);
  });

  it("every kind has an order that ends with contact, and sections of one kind keep their order", () => {
    for (const kind of KINDS) expect(sectionOrder(kind).at(-1), kind).toBe("contact");
    expect(suggestOrder(["work", "other", "work", "contact", "other", "about"], "designer")).toEqual([0, 2, 5, 1, 4, 3]);
    expect(suggestOrder([], "designer")).toEqual([]);
  });

  it("maps blocks to their sections", () => {
    expect(sectionKindOf(project())).toBe("work");
    expect(sectionKindOf(contact())).toBe("contact");
    expect(sectionKindOf({ ...base, id: "b", type: "brands", columns: 3, items: [{ name: "A bakery" }] })).toBe("clients");
    expect(sectionKindOf({ ...base, id: "r", type: "repo", title: "x", url: "https://github.com/a/b", owner: "a", repo: "b", kind: "repo" })).toBe("repositories");
    expect(sectionKindOf(link("a"))).toBe("other");
    expect(sectionKindOf(header("h"))).toBe("other");
  });

  it("reorders a page: a header travels with its blocks, a run of projects moves as one, socials stay on top", () => {
    const about: Block = { ...base, id: "about", type: "about", text: "Hello." };
    const tools: Block = { ...base, id: "tools", type: "tools", items: ["Figma"] };
    const socials: Block = { ...base, id: "socials", type: "socials", items: [] };
    const blocks: Block[] = [contact(), tools, link("shop"), socials, header("h-about"), about, header("h-work"), plain("one"), plain("two"), link("more-work"), plain("three")];
    const ids = (kind: Parameters<typeof suggestBlockOrder>[1]) => suggestBlockOrder(blocks, kind).map((block) => block.id);
    expect(ids("designer")).toEqual(["socials", "h-work", "one", "two", "more-work", "three", "h-about", "about", "tools", "shop", "c1"]);
    expect(ids("coach")).toEqual(["socials", "h-about", "about", "h-work", "one", "two", "more-work", "three", "tools", "shop", "c1"]);
    expect(ids("developer")).toEqual(["socials", "h-work", "one", "two", "more-work", "three", "tools", "h-about", "about", "shop", "c1"]);
    // Nothing is lost, nothing is changed.
    expect(suggestBlockOrder(blocks, "designer").slice().sort((a, b) => a.id.localeCompare(b.id))).toEqual(blocks.slice().sort((a, b) => a.id.localeCompare(b.id)));
    expect(suggestBlockOrder([], "designer")).toEqual([]);
  });
});

describe("what is missing", () => {
  const complete = project({ cover: img("c", "The table on a phone"), results: [{ value: "9 → 3", label: "taps" }], story: { problem: "Hard to read." }, year: { from: 2025 } });

  it.each<[string, Project, ProjectStep | null]>([
    ["a fallback address", project({ slug: "project-1" }), "address"],
    ["a German fallback address, whatever else is there", { ...complete, slug: "projekt-12" }, "address"],
    ["a cover without a description", { ...complete, cover: img("c") }, "alt"],
    ["a picture without a description", { ...complete, pictures: [{ image: img("a") }] }, "alt"],
    ["a repository-only project", project({ source: { owner: "example", repo: "tidewatch" }, links: [{ url: "https://github.com/example/tidewatch" }] }), "codeOrStory"],
    ["a title and a sentence", project(), "resultOrPicture"],
    ["a result and nothing to read or open", project({ results: [{ value: "8", label: "months" }] }), "storyOrLink"],
    ["a described picture and nothing to read or open", project({ cover: img("c", "Cover") }), "storyOrLink"],
    ["a result and a link, no year", project({ results: [{ value: "8", label: "months" }], links: [{ url: "https://example.com" }] }), "year"],
    ["everything", complete, null],
    ["a decorative picture needs no description", { ...complete, pictures: [{ image: img("a"), decorative: true }] }, null],
    ["a repository with a code sample, a picture and a year", project({ source: { owner: "example", repo: "tidewatch" }, code: { text: "tide(at)" }, links: [{ url: "https://github.com/example/tidewatch" }], cover: img("c", "Cover"), year: { from: 2025 } }), null],
  ])("%s → %s", (_, value, expected) => {
    expect(nextStep(value)).toBe(expected);
  });

  it("nextPageStep: contact, then three projects, then a quote, then something recent", () => {
    const NOW = new Date("2026-11-23T12:00:00Z");
    const three = [project({ id: "a", slug: "aa", year: { from: 2020 } }), project({ id: "b", slug: "bb", year: { from: 2019, to: 2022 } }), project({ id: "c", slug: "cc" })];
    expect(nextPageStep({ blocks: [project()] }, NOW)).toBe("contact");
    expect(nextPageStep({ blocks: [project(), contact()] }, NOW)).toBe("secondProject");
    expect(nextPageStep({ blocks: [...three, contact()] }, NOW)).toBe("quote");
    expect(nextPageStep({ blocks: [...three, contact(), quotesAbout("a")] }, NOW)).toBe("recent");
    expect(nextPageStep({ blocks: [...three, project({ id: "d", slug: "dd", year: { from: 2023 } }), contact(), quotesAbout("a")] }, NOW)).toBeNull();
    expect(nextPageStep({ blocks: [...three, project({ id: "d", slug: "dd", year: { from: 2015, to: "now" } }), contact(), quotesAbout("a")] }, NOW)).toBeNull();
    // Without any year there is nothing to call old.
    expect(nextPageStep({ blocks: [plain("aa"), plain("bb"), plain("cc"), contact(), quotesAbout("a")] }, NOW)).toBeNull();
  });
});

describe("figureSize", () => {
  it.each([
    ["8", "lg"],
    ["+42%", "lg"],
    ["9 → 3", "md"],
    ["12.400 €", "md"],
    ["3,5 Mio. ", "sm"],
    ["1.250.000 kg", "sm"],
    ["٨", "lg"],
    ["٤٢٪+", "lg"],
    ["أشهر٨", "md"],
    ["٨ أشهر ف", "md"],
    ["تسعة أشهر", "sm"],
    ["اثنا عشر شهر", "sm"],
  ] as const)("%s is %s", (value, expected) => {
    expect(figureSize(value)).toBe(expected);
  });

  it("counts what a reader sees: 1, 4, 5, 8, 9 and 12 characters, Latin and Arabic", () => {
    const sizes = (letter: string) => [1, 4, 5, 8, 9, 12].map((length) => figureSize(letter.repeat(length)));
    expect(sizes("x")).toEqual(["lg", "lg", "md", "md", "sm", "sm"]);
    expect(sizes("م")).toEqual(["lg", "lg", "md", "md", "sm", "sm"]);
    // Four Arabic letters with their vowel marks are still four (eight code units).
    expect("كَتَبَتْ").toHaveLength(8);
    expect(figureSize("كَتَبَتْ")).toBe("lg");
    expect(figureSize("👩‍💻👩‍💻👩‍💻👩‍💻")).toBe("lg");
  });
});

describe("tintCode", () => {
  const tones = (text: string, lang?: string) => tintCode(text, lang).map((token) => [token.tone, token.text]);

  it("keeps #fff inside a Python string and tones the comment after it", () => {
    expect(tones('color = "#fff"  # white\n', "python")).toEqual([
      ["plain", "color = "],
      ["string", '"#fff"'],
      ["plain", "  "],
      ["comment", "# white"],
      ["plain", "\n"],
    ]);
  });

  it("keeps // inside a URL string and tones the comment after it", () => {
    expect(tones('const url = "https://example.com"; // home', "ts")).toEqual([
      ["plain", "const url = "],
      ["string", '"https://example.com"'],
      ["plain", "; "],
      ["comment", "// home"],
    ]);
    // An address outside a string is no comment either.
    expect(tones("fetch(https://example.com)", "js")).toEqual([["plain", "fetch(https://example.com)"]]);
  });

  it("tones block comments, template strings over lines and escaped quotes", () => {
    expect(tones("/* a\n b */ let x = `one\ntwo`;", "js")).toEqual([
      ["comment", "/* a\n b */"],
      ["plain", " let x = "],
      ["string", "`one\ntwo`"],
      ["plain", ";"],
    ]);
    expect(tones('say("a \\" b") // c', "java")).toEqual([
      ["plain", "say("],
      ["string", '"a \\" b"'],
      ["plain", ") "],
      ["comment", "// c"],
    ]);
  });

  it("ends an unclosed string at the end of its line", () => {
    expect(tones('x = "open\ny = 1', "python")).toEqual([
      ["plain", "x = "],
      ["string", '"open'],
      ["plain", "\ny = 1"],
    ]);
    expect(tones('"""doc\nstring""" # c', "python")).toEqual([
      ["string", '"""doc\nstring"""'],
      ["plain", " "],
      ["comment", "# c"],
    ]);
  });

  it("knows SQL, HTML and shell comments", () => {
    expect(tones("SELECT 'a--b' -- note\nFROM t", "sql")).toEqual([
      ["plain", "SELECT "],
      ["string", "'a--b'"],
      ["plain", " "],
      ["comment", "-- note"],
      ["plain", "\nFROM t"],
    ]);
    expect(tones("<p>don't</p><!-- hidden -->", "html")).toEqual([
      ["plain", "<p>don't</p>"],
      ["comment", "<!-- hidden -->"],
    ]);
    expect(tones("count=$# # args\necho don't", "shell")).toEqual([
      ["plain", "count=$# "],
      ["comment", "# args"],
      ["plain", "\necho don't"],
    ]);
  });

  it("tones JSON strings and leaves text, an unknown language and no language as one plain token", () => {
    expect(tones('{"a": "b // c"}', "json")).toEqual([
      ["plain", "{"],
      ["string", '"a"'],
      ["plain", ": "],
      ["string", '"b // c"'],
      ["plain", "}"],
    ]);
    const sample = 'x = "1" # y // z';
    for (const lang of ["text", "cobol", "constructor", undefined]) expect(tones(sample, lang), String(lang)).toEqual([["plain", sample]]);
    expect(tintCode("", "ts")).toEqual([]);
    expect(tintCode("", undefined)).toEqual([]);
  });

  it("a Rust lifetime is no string", () => {
    expect(tones("fn pick<'a>(x: &'a str) -> &'a str { x } // ok", "rust")).toEqual([
      ["plain", "fn pick<'a>(x: &'a str) -> &'a str { x } "],
      ["comment", "// ok"],
    ]);
  });

  it("joined tokens equal the input, for 200 random strings in every language", () => {
    let seed = 20261123;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      return (seed >>> 0) / 4294967296;
    };
    const pieces = ['"', "'", "`", "#", "//", "/*", "*/", "--", "<!--", "-->", "\\", "\n", " ", ":", "a", "ب", "é", "0", '"""', "'''", "$", "{", "}", "👩‍💻"];
    const pick = () => pieces[Math.floor(random() * pieces.length)] ?? "";
    for (let round = 0; round < 200; round += 1) {
      const text = Array.from({ length: Math.floor(random() * 60) }, pick).join("");
      for (const lang of [...CODE_LANGS, "unknown", undefined]) {
        const tokens = tintCode(text, lang);
        expect(tokens.map((token) => token.text).join(""), `${String(lang)}: ${JSON.stringify(text)}`).toBe(text);
        expect(tokens.every((token) => token.text.length > 0)).toBe(true);
        // Neighbours never share a tone: the list is as short as it can be.
        expect(tokens.every((token, index) => index === 0 || tokens[index - 1]?.tone !== token.tone)).toBe(true);
      }
    }
  });
});

describe("formatYears", () => {
  it.each([
    [{ from: 2025 }, "2025"],
    [{ from: 2025, to: 2025 }, "2025"],
    [{ from: 2023, to: 2025 }, "2023–2025"],
    [{ from: 2024, to: "now" as const }, "2024–heute"],
  ])("%o → %s", (years, expected) => {
    expect(formatYears(years, "heute")).toBe(expected);
  });

  it("uses an en dash and Latin digits with an Arabic word too", () => {
    expect(formatYears({ from: 2024, to: "now" }, "الآن")).toBe("2024–الآن");
  });
});

describe("the helpers work on what the schema parses", () => {
  it("a parsed page goes through every helper", () => {
    const page = pageSchema.parse({
      profile: { username: "mats", displayName: "Mats", bio: "", avatar: { src: "none:", alt: "" }, locale: "de" },
      blocks: [project({ story: { problem: "Hard to read." } }), contact()],
    });
    const first = page.blocks[0];
    expect(first?.type === "project" && projectTarget(first, "/mats", []).kind).toBe("page");
    expect(primaryAction(page.blocks)?.label).toBe("Book an intro call");
    expect(nextPageStep(page)).toBe("secondProject");
    expect(blockSchema.safeParse(project({ slug: slugFor("Tidewatch", [], "project") })).success).toBe(true);
  });
});
