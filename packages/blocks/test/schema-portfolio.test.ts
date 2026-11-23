import { describe, expect, it } from "vitest";

import { MAX_PROJECTS, PROJECT_SLUG_MAX, RESERVED_PROJECT_SLUGS, isProjectSlug } from "../src/rules";
import { blockSchema, CODE_LANGS, pageSchema } from "../src/schema";

const profile = { username: "mats", displayName: "Mats Brandt", bio: "", avatar: { src: "none:", alt: "" }, locale: "de" as const };
const base = { visible: true, highlight: false };
const STORED = "https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/media/0f8fad5b-d9cb-469f-a165-70867728950e/2026/";

const project = (extra: Record<string, unknown> = {}) => ({ ...base, id: "p1", type: "project", slug: "tidewatch", title: "Tidewatch", summary: "A tide table sailors can read at a glance.", ...extra });
const picture = (name: string, extra: Record<string, unknown> = {}) => ({ image: { src: `${STORED}${name}.jpg`, alt: "The harbour at dawn", w: 2400, h: 1600 }, ...extra });

const full = project({
  was: ["tide-table", "tides"],
  client: "A regional sailing club",
  role: "Concept, design, frontend",
  year: { from: 2024, to: "now" },
  tags: ["Product design", "TypeScript", "Maps"],
  cover: { src: `${STORED}cover.jpg`, alt: "The tide table on a phone", focal: [0.5, 0.4], tone: "dark", w: 2400, h: 1600 },
  results: [
    { value: "9 → 3", label: "taps to a tide" },
    { value: "4.8", label: "store rating" },
  ],
  story: { about: "A calm tool for a nervous moment.", problem: "Tables were hard to read.", solution: "One line per day.", result: "People check before they leave." },
  pictures: [picture("a"), picture("b", { decorative: true, caption: "Sketches" }), { image: { src: `${STORED}c.jpg`, alt: "" } }],
  links: [{ url: "https://example.com/tidewatch", label: "Open the app" }, { url: "https://github.com/example/tidewatch" }],
  source: { owner: "example", repo: "tidewatch", stars: 412, language: "TypeScript", license: "MIT", install: "npm install tidewatch", readAt: "2026-11-23" },
  code: { text: "export const tide = (at: Date) => table.find(at);\n", lang: "ts", file: "src/tide.ts" },
  origin: "ai-edited",
});

const about = { ...base, id: "a1", type: "about", title: "Über mich", text: "Ich baue ruhige Werkzeuge.", portrait: { src: `${STORED}me.jpg`, alt: "Mats" }, facts: [{ label: "Sitz", value: "Kiel" }] };
const tools = { ...base, id: "t1", type: "tools", items: ["TypeScript", "Figma"] };
const timeline = { ...base, id: "tl1", type: "timeline", items: [{ role: "Frontend lead", org: "A regional utility", years: { from: 2021, to: 2024 }, note: "Design system", url: "https://example.com" }] };
const quote = { text: "He listens first.", name: "M. K.", role: "Managing director, bakery", consent: true };
const quotes = { ...base, id: "q1", type: "quotes", items: [{ ...quote, project: "p1" }] };
const contact = {
  ...base,
  id: "c1",
  type: "contact",
  title: "Ein Projekt im Kopf?",
  text: "Ich antworte innerhalb von zwei Tagen.",
  status: "Frei ab März 2027",
  statusUntil: "2027-03-31",
  primary: { label: "Erstgespräch buchen", url: "https://example.com/termin", icon: "calendar" },
  links: [
    { kind: "email", url: "mailto:hallo@example.com" },
    { kind: "cv", label: "Lebenslauf", url: "https://example.com/cv.pdf" },
  ],
  steps: ["Kurzes Gespräch", "Angebot", "Start"],
};

const ok = (block: unknown) => blockSchema.safeParse(block).success;
const pageOk = (blocks: unknown[]) => pageSchema.safeParse({ profile, blocks }).success;

describe("the project block", () => {
  it("parses a full project and the smallest one (a title and a sentence)", () => {
    const parsed = blockSchema.parse(full);
    expect(parsed.type === "project" && [parsed.slug, parsed.was, parsed.year, parsed.pictures?.length, parsed.source?.repo, parsed.code?.lang]).toEqual(["tidewatch", ["tide-table", "tides"], { from: 2024, to: "now" }, 3, "tidewatch", "ts"]);
    expect(ok(project())).toBe(true);
    expect(CODE_LANGS).toContain("text");
    for (const lang of CODE_LANGS) expect(ok(project({ code: { text: "x", lang } })), lang).toBe(true);
  });

  it.each([
    ["a 61-character title", { title: "x".repeat(61) }],
    ["an empty title", { title: "" }],
    ["an empty summary", { summary: "" }],
    ["a 141-character summary", { summary: "x".repeat(141) }],
    ["a slug with capitals", { slug: "Tidewatch" }],
    ["a slug with a space", { slug: "tide watch" }],
    ["a slug with a double dash", { slug: "tide--watch" }],
    ["a slug ending in a dash", { slug: "tidewatch-" }],
    ["a one-character slug", { slug: "t" }],
    ["a 49-character slug", { slug: "t".repeat(PROJECT_SLUG_MAX + 1) }],
    ["four earlier addresses", { was: ["aa", "bb", "cc", "dd"] }],
    ["a bad earlier address", { was: ["Tide Table"] }],
    ["six tags", { tags: ["a", "b", "c", "d", "e", "f"] }],
    ["a 25-character tag", { tags: ["x".repeat(25)] }],
    ["four figures", { results: Array.from({ length: 4 }, () => ({ value: "1", label: "one" })) }],
    ["a 13-character figure", { results: [{ value: "x".repeat(13), label: "one" }] }],
    ["21 pictures", { pictures: Array.from({ length: 21 }, (_, index) => picture(String(index))) }],
    ["a javascript: link", { links: [{ url: "javascript:alert(1)" }] }],
    ["three links", { links: [{ url: "https://example.com/1" }, { url: "https://example.com/2" }, { url: "https://example.com/3" }] }],
    ["a width without a height (cover)", { cover: { src: `${STORED}c.jpg`, alt: "", w: 2400 } }],
    ["a height without a width (picture)", { pictures: [{ image: { src: `${STORED}c.jpg`, alt: "", h: 1600 } }] }],
    ["an end before the start", { year: { from: 2025, to: 2023 } }],
    ["a year before 1950", { year: { from: 1949 } }],
    ["a confidential client with a name", { confidential: true, client: "A regional utility" }],
    ["a 601-character story part", { story: { problem: "x".repeat(601) } }],
    ["a code sample over 2400 characters", { code: { text: "x".repeat(2401) } }],
    ["an unknown code language", { code: { text: "x", lang: "cobol" } }],
  ])("refuses %s", (_, extra) => {
    expect(ok(project(extra))).toBe(false);
  });

  it("takes a confidential client without a name, a single year and an open end", () => {
    expect(ok(project({ confidential: true }))).toBe(true);
    expect(ok(project({ confidential: true, client: "" }))).toBe(true);
    expect(ok(project({ confidential: false, client: "A regional utility" }))).toBe(true);
    expect(ok(project({ year: { from: 2025 } }))).toBe(true);
    expect(ok(project({ year: { from: 2025, to: 2025 } }))).toBe(true);
    expect(ok(project({ year: { from: 2025, to: "now" } }))).toBe(true);
    // A picture without a description parses: it waits in the editor and never hides the project.
    expect(ok(project({ pictures: [{ image: { src: `${STORED}c.jpg`, alt: "" } }] }))).toBe(true);
  });
});

describe("the section blocks", () => {
  it("parse", () => {
    for (const block of [about, tools, timeline, quotes, contact]) expect(ok(block), block.type).toBe(true);
    expect(ok({ ...about, title: undefined, portrait: undefined, facts: undefined })).toBe(true);
  });

  it.each([
    ["an about block without text", { ...about, text: "" }],
    ["five facts", { ...about, facts: Array.from({ length: 5 }, () => ({ label: "a", value: "b" })) }],
    ["13 tools", { ...tools, items: Array.from({ length: 13 }, (_, index) => `Tool ${String(index)}`) }],
    ["no tools", { ...tools, items: [] }],
    ["a 33-character tool", { ...tools, items: ["x".repeat(33)] }],
    ["seven timeline entries", { ...timeline, items: Array.from({ length: 7 }, () => ({ role: "Lead", years: { from: 2020 } })) }],
    ["a timeline entry without a role", { ...timeline, items: [{ role: "", years: { from: 2020 } }] }],
    ["a timeline entry without a year", { ...timeline, items: [{ role: "Lead" }] }],
    ["a quote without consent", { ...quotes, items: [{ text: quote.text, name: quote.name, role: quote.role }] }],
    ["a quote with consent switched off", { ...quotes, items: [{ ...quote, consent: false }] }],
    ["a quote without a role", { ...quotes, items: [{ ...quote, role: "" }] }],
    ["a quote without a name", { ...quotes, items: [{ ...quote, name: "" }] }],
    ["seven quotes", { ...quotes, items: Array.from({ length: 7 }, () => quote) }],
    ["a contact block without a closing line", { ...contact, title: "" }],
    ["a contact block without a primary action", { ...contact, primary: undefined }],
    ["a primary action with a javascript: address", { ...contact, primary: { label: "Go", url: "javascript:alert(1)" } }],
    ["four other ways", { ...contact, links: Array.from({ length: 4 }, () => ({ kind: "link", url: "https://example.com" })) }],
    ["an unknown way", { ...contact, links: [{ kind: "fax", url: "https://example.com" }] }],
    ["four steps", { ...contact, steps: ["a", "b", "c", "d"] }],
    ["a status date that is no date", { ...contact, statusUntil: "March" }],
  ])("refuse %s", (_, block) => {
    expect(ok(block)).toBe(false);
  });

  it("clients are a brands block: the logo is optional now", () => {
    expect(ok({ ...base, id: "b1", type: "brands", title: "Kunden", items: [{ name: "A regional utility" }, { name: "A bakery", role: "Rebrand" }] })).toBe(true);
    expect(ok({ ...base, id: "b1", type: "brands", items: [{ name: "Studio", logo: { src: "sample:logo", alt: "" } }] })).toBe(true);
  });
});

describe("page rules", () => {
  const numbered = (count: number) => Array.from({ length: count }, (_, index) => project({ id: `p${String(index)}`, slug: `work-${String(index)}` }));

  it("a whole portfolio parses", () => {
    expect(pageOk([full, about, tools, timeline, quotes, contact])).toBe(true);
  });

  it(`hold ${String(MAX_PROJECTS)} projects and refuse the next one`, () => {
    expect(pageOk(numbered(MAX_PROJECTS))).toBe(true);
    expect(pageOk(numbered(MAX_PROJECTS + 1))).toBe(false);
  });

  it("refuse a second contact block", () => {
    expect(pageOk([contact])).toBe(true);
    expect(pageOk([contact, { ...contact, id: "c2" }])).toBe(false);
  });

  it("refuse an address used twice, also across slug and was", () => {
    expect(pageOk([project(), project({ id: "p2", slug: "harbour" })])).toBe(true);
    expect(pageOk([project(), project({ id: "p2" })])).toBe(false);
    expect(pageOk([project({ was: ["harbour"] }), project({ id: "p2", slug: "harbour" })])).toBe(false);
    expect(pageOk([project({ was: ["old"] }), project({ id: "p2", slug: "harbour", was: ["old"] })])).toBe(false);
    expect(pageOk([project({ was: ["tidewatch"] })])).toBe(false);
  });

  it("refuse a reserved address", () => {
    for (const slug of ["work", "cv", "opengraph-image", "kontakt"]) {
      expect(RESERVED_PROJECT_SLUGS.has(slug), slug).toBe(true);
      expect(isProjectSlug(slug), slug).toBe(false);
      expect(pageOk([project({ slug })]), slug).toBe(false);
    }
    expect(isProjectSlug("tidewatch")).toBe(true);
    expect(isProjectSlug("t")).toBe(false);
    expect(isProjectSlug("Tidewatch")).toBe(false);
  });

  it("a page stored before portfolios still parses: no new field, brands with logos", () => {
    const stored = {
      profile: { ...profile, verified: false, hero: { src: "sample:hero", alt: "", focal: [0.5, 0.2], tone: "dark" } },
      blocks: [
        { id: "s", type: "socials", visible: true, highlight: false, items: [{ platform: "instagram", url: "https://instagram.com/mats" }] },
        { id: "l", type: "link", visible: true, highlight: true, title: "Booking", url: "mailto:mats@example.com" },
        { id: "g", type: "gallery", visible: true, highlight: false, images: [{ src: "sample:a", alt: "" }] },
        { id: "b", type: "brands", visible: true, highlight: false, columns: 2, items: [{ name: "Studio Nord", role: "Partner", logo: { src: "sample:logo", alt: "" }, url: "https://example.com" }] },
        { id: "r", type: "repo", visible: true, highlight: false, title: "tidewatch", url: "https://github.com/example/tidewatch", owner: "example", repo: "tidewatch", kind: "repo" },
      ],
    };
    const parsed = pageSchema.parse(stored);
    expect(parsed.blocks).toHaveLength(5);
    const brands = parsed.blocks[3];
    expect(brands?.type === "brands" && brands.items[0]?.logo?.src).toBe("sample:logo");
  });
});

describe("size: the worst case stays under the page limit", () => {
  // Arabic at every limit (two bytes a letter in UTF-8), also in the code sample; every picture with
  // a stored address as Storage makes them (<project>/storage/v1/object/public/media/<uid>/<year>/<uuid>.webp).
  const ar = (length: number) => "م".repeat(length);
  const stored = (n: number) => `${STORED}3f2504e0-4f89-11d3-9a0c-0305e82c${String(n).padStart(4, "0")}.webp`;
  const worst = (index: number) => {
    const key = String(index).padStart(2, "0");
    const address = (name: string) => `${name}${key}-${"a".repeat(PROJECT_SLUG_MAX)}`.slice(0, PROJECT_SLUG_MAX);
    return project({
      id: `project-${"x".repeat(20)}-${key}`,
      slug: address("s"),
      was: [address("t"), address("u"), address("v")],
      title: ar(60),
      summary: ar(140),
      client: ar(60),
      role: ar(60),
      year: { from: 2019, to: "now" },
      tags: Array.from({ length: 5 }, () => ar(24)),
      cover: { src: stored(index * 100), alt: ar(300), focal: [0.123456, 0.654321], tone: "light", w: 2400, h: 1600 },
      results: Array.from({ length: 3 }, () => ({ value: ar(12), label: ar(24) })),
      story: { about: ar(600), problem: ar(600), solution: ar(600), result: ar(600) },
      pictures: Array.from({ length: 20 }, (_, n) => ({
        image: { src: stored(index * 100 + n + 1), alt: ar(300), focal: [0.123456, 0.654321], tone: "dark", w: 2400, h: 1600 },
        decorative: false,
        caption: ar(120),
      })),
      links: [
        { url: `https://example.com/${"a".repeat(180)}`, label: ar(30) },
        { url: `https://example.com/${"b".repeat(180)}`, label: ar(30) },
      ],
      source: { owner: "o".repeat(39), repo: "r".repeat(100), stars: 123456, language: ar(40), license: ar(40), install: "x".repeat(200), readAt: "2026-11-23" },
      code: { text: ar(2400), lang: "python", file: "f".repeat(80) },
      schedule: { from: "2026-01-01T00:00:00Z", until: "2030-01-01T00:00:00Z" },
      origin: "ai-edited",
    });
  };
  const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

  it("one project at every limit is under 40,000 bytes", () => {
    const one = blockSchema.parse(worst(0));
    // Measured: 35,850 bytes (20 pictures with 300-letter descriptions and captions are most of it).
    expect(bytes(one)).toBeLessThan(40_000);
    expect(bytes(one)).toBeGreaterThan(30_000);
  });

  it("24 of them, with the profile, are under 1,000,000 bytes", () => {
    const page = pageSchema.parse({ profile: { ...profile, bio: ar(160), tagline: ar(80) }, blocks: Array.from({ length: MAX_PROJECTS }, (_, index) => worst(index)) });
    expect(page.blocks).toHaveLength(MAX_PROJECTS);
    // Measured: 861,061 bytes. The database's limit on a page is 1 MB.
    expect(bytes(page)).toBeLessThan(1_000_000);
    expect(bytes(page)).toBeGreaterThan(800_000);
  });
});
