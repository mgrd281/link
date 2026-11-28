import type { Block, Page } from "@linkyo/blocks";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cardPage, filterPublic, indexable, isOwnPicture, loadPublicPage, parseBlocks, parseLegal, parseTheme, searchTexts, toPublicPage, withoutThirdParties } from "./public-page";

const NOW = new Date("2026-11-22T12:00:00Z");
const link = (id: string, extra: Partial<Block> = {}): Block => ({ id, type: "link", title: id, url: `https://example.com/${id}`, visible: true, highlight: false, ...extra }) as Block;

const page = (blocks: Block[]): Page => ({
  profile: { username: "mila", displayName: "Mila", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale: "de" },
  blocks,
});

describe("what visitors see", () => {
  it("drops hidden, out-of-schedule and newsletter blocks and keeps the order", () => {
    const blocks: Block[] = [
      link("first"),
      link("hidden", { visible: false }),
      link("later", { schedule: { from: "2026-12-01T00:00:00Z" } }),
      link("over", { schedule: { until: "2026-11-01T00:00:00Z" } }),
      link("running", { schedule: { from: "2026-11-01T00:00:00Z", until: "2026-12-01T00:00:00Z" } }),
      { id: "news", type: "newsletter", title: "Newsletter", visible: true, highlight: false },
      link("last"),
    ];
    expect(filterPublic(page(blocks), NOW).blocks.map((block) => block.id)).toEqual(["first", "running", "last"]);
  });

  it("leaves out a block that does not parse, one by one", () => {
    const raw = [
      { id: "ok", type: "link", title: "Fine", url: "https://example.com" },
      { id: "bad-url", type: "link", title: "Broken", url: "javascript:alert(1)" },
      { id: "unknown", type: "hologram" },
      "not even an object",
      { id: "text", type: "text", text: "Hello" },
    ];
    expect(parseBlocks(raw).map((block) => block.id)).toEqual(["ok", "text"]);
    expect(parseBlocks(null)).toEqual([]);
  });

  it("reads the answer of public_page() and filters it again", () => {
    const answer = {
      page: {
        profile: { username: "mila", displayName: "Mila", bio: "Hi", avatar: { src: "none:", alt: "" }, verified: false, locale: "ar" },
        blocks: [link("a"), link("b", { visible: false }), { id: "x", type: "nope" }],
      },
      theme: { template: "nocturne", accent: "not-a-color", buttonShape: "pill", mode: "dark", pairing: "unknown" },
      legal: { name: "Mila", address: 42 },
      updatedAt: "2026-11-22T10:00:00Z",
    };
    const found = toPublicPage(answer, NOW);
    expect(found?.page.profile.locale).toBe("ar");
    expect(found?.page.blocks.map((block) => block.id)).toEqual(["a"]);
    expect(found?.theme).toEqual({ template: "nocturne", buttonShape: "pill", mode: "dark" });
    expect(found?.legal).toEqual({ name: "Mila", address: "", email: "", phone: "" });
    expect(found?.updatedAt).toBe("2026-11-22T10:00:00Z");
  });

  it("knows no page without a profile it can show", () => {
    expect(toPublicPage(null)).toBeNull();
    expect(toPublicPage({ page: { profile: { username: "x" }, blocks: [] } })).toBeNull();
    expect(toPublicPage({ page: "nope" })).toBeNull();
  });

  it("keeps only theme values the engine knows", () => {
    expect(parseTheme({ accent: "#00454c", tint: 0.4, background: "gradient" })).toEqual({ accent: "#00454c", tint: 0.4, background: "gradient" });
    expect(parseTheme({ tint: 7, background: "lava", preset: "nope" })).toEqual({});
    expect(parseTheme("nope")).toEqual({});
    expect(parseLegal(undefined)).toEqual({ name: "", address: "", email: "", phone: "" });
  });

  it("keeps the owner's work layout when the engine knows it", () => {
    for (const projects of ["auto", "bento", "list", "rail"] as const) expect(parseTheme({ template: "tiefdruck", projects })).toEqual({ template: "tiefdruck", projects });
    expect(parseTheme({ template: "werkbogen", projects: "masonry" })).toEqual({ template: "werkbogen" });
    expect(parseTheme({ projects: 3 })).toEqual({});
    expect(parseTheme({ projects: null, canvas: "wide", headings: "marker" })).toEqual({});
    expect(toPublicPage({ page: page([]), theme: { template: "werkbogen", projects: "rail", canvas: "column" } }, NOW)?.theme).toEqual({ template: "werkbogen", projects: "rail" });
  });

  it("never shows a confidential client's name", () => {
    const project = (extra: Partial<Extract<Block, { type: "project" }>>): Block => ({ id: "p", type: "project", slug: "kraftwerk", title: "Kraftwerk", summary: "A control room.", visible: true, highlight: false, ...extra });
    // A block that carries both cannot be saved through the schema; if one reaches the filter, the name goes.
    const [confidential, open, flagOnly] = filterPublic(page([project({ confidential: true, client: "Stadtwerke Beispiel" }), project({ id: "o", slug: "open", client: "Bäckerei Beispiel" }), project({ id: "f", slug: "flag", confidential: true })]), NOW).blocks;
    expect(confidential).toEqual(project({ confidential: true }));
    expect(confidential && "client" in confidential).toBe(false);
    expect(open?.type === "project" && open.client).toBe("Bäckerei Beispiel");
    expect(flagOnly).toEqual(project({ id: "f", slug: "flag", confidential: true }));
    // Read from the database, such a block does not parse at all: it fails closed.
    const answer = { page: { ...page([]), blocks: [project({ confidential: true, client: "Stadtwerke Beispiel" }), project({ id: "o", slug: "open", client: "Bäckerei Beispiel" })] } };
    const found = toPublicPage(answer, NOW);
    expect(found?.page.blocks.map((block) => block.id)).toEqual(["o"]);
    expect(JSON.stringify(found)).not.toContain("Stadtwerke");
  });

  it("finds nothing in a demo build (no database to ask)", async () => {
    await expect(loadPublicPage("mila")).resolves.toBeNull();
  });
});

describe("nothing from another origin (GDPR)", () => {
  const HOSTED = "https://abcd1234.supabase.co";
  const OWN = `${HOSTED}/storage/v1/object/public/media/uid/2026/a.webp`;
  const FOREIGN = "https://tracker.example/p.gif";
  afterEach(() => vi.unstubAllEnvs());

  it("knows which pictures a visitor's browser may load", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", HOSTED);
    for (const src of ["none:", "sample:mila-avatar", "data:image/webp;base64,AAAA", OWN, "https://i.ytimg.com/vi/x/hqdefault.jpg"]) expect(isOwnPicture(src), src).toBe(true);
    for (const src of [FOREIGN, "http://tracker.example/p.gif", "//tracker.example/p.gif", "HTTPS://tracker.example/p.gif", "/\\tracker.example/p.gif", "ftp://tracker.example/p.gif", "data:text/html,x", `${HOSTED}.evil.example/storage/v1/object/public/media/a.jpg`, "http://i.ytimg.com/vi/x/hqdefault.jpg", "https://i.ytimg.com/a.svg", "https://i.ytimg.com/a.svg?x", `${HOSTED}/storage/v1/object/public/media/u/a.svg`]) {
      expect(isOwnPicture(src), src).toBe(false);
    }
  });

  it("replaces every foreign picture, wherever it sits in the page, and keeps our own", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", HOSTED);
    const raw = {
      page: {
        profile: {
          username: "mila",
          displayName: "Mila",
          bio: "",
          avatar: { src: FOREIGN, alt: "Mila", focal: [0.5, 0.2] },
          hero: { src: OWN, alt: "" },
          logo: { src: "http://tracker.example/logo.png", alt: "" },
          verified: false,
          locale: "de",
        },
        blocks: [
          { id: "g", type: "gallery", images: [{ src: OWN, alt: "one" }, { src: FOREIGN, alt: "two" }, { src: "sample:gallery-1", alt: "three" }] },
          { id: "b", type: "brands", items: [{ name: "Werk 9", logo: { src: "//tracker.example/l.png", alt: "" } }] },
          { id: "v", type: "video", title: "Clip", provider: "youtube", url: "https://youtube.com/watch?v=x", poster: { src: "https://i.ytimg.com/vi/x/hqdefault.jpg", alt: "" } },
        ],
      },
    };
    const found = toPublicPage(raw, NOW);
    expect(found?.page.profile.avatar).toEqual({ src: "none:", alt: "Mila", focal: [0.5, 0.2] });
    expect(found?.page.profile.hero?.src).toBe(OWN);
    expect(found?.page.profile.logo?.src).toBe("none:");
    const [gallery, brands, video] = found?.page.blocks ?? [];
    expect(gallery?.type === "gallery" ? gallery.images.map((image) => image.src) : null).toEqual([OWN, "none:", "sample:gallery-1"]);
    expect(brands?.type === "brands" ? brands.items[0]?.logo?.src : null).toBe("none:");
    expect(video?.type === "video" ? video.poster.src : null).toBe("https://i.ytimg.com/vi/x/hqdefault.jpg");
    // Nothing a browser would fetch from another host is left anywhere in the page.
    expect(JSON.stringify(found?.page)).not.toContain("tracker.example");
  });

  it("drops a hero clip that is not one of ours (it would start by itself on a visitor's phone)", () => {
    const profile = { username: "mila", displayName: "Mila", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale: "de" as const };
    const withMotion = (src: string): Page => ({ profile: { ...profile, motion: { src } }, blocks: [] });
    for (const src of ["https://cdn.example.com/loop.mp4", "http://cdn.example.com/loop.mp4", "sample:motion-../../x", "/media/motion/lina.mp4"]) {
      expect(withoutThirdParties(withMotion(src)).profile.motion, src).toBeUndefined();
    }
    expect(withoutThirdParties(withMotion("sample:motion-lina")).profile.motion).toEqual({ src: "sample:motion-lina" });
    expect(toPublicPage({ page: withMotion("https://cdn.example.com/loop.mp4") }, NOW)?.page.profile).not.toHaveProperty("motion");
  });
});

/** D-09: Settings › Sichtbarkeit, as the public page reads it. */
describe("a paused page", () => {
  const answer = (visibility: Record<string, unknown> | undefined) => ({
    page: {
      profile: {
        username: "mila",
        displayName: "Mila Berg",
        bio: "Songs and shows.",
        tagline: "Singer · Köln",
        location: "Köln",
        stats: [{ value: "2M", label: "followers" }],
        avatar: { src: "sample:avatar-1", alt: "Mila" },
        hero: { src: "sample:hero-1", alt: "" },
        verified: false,
        locale: "ar",
        ...(visibility ? { visibility } : {}),
      },
      blocks: [link("a"), link("b")],
    },
    theme: { template: "nocturne" },
    legal: { name: "Mila Berg", address: "Straße 1", email: "mila@example.com", phone: "" },
    updatedAt: "2026-11-22T10:00:00Z",
  });

  it("keeps only the name, the photo and the language: no block, no line, no numbers, no hero", () => {
    const found = toPublicPage(answer({ paused: true }), NOW);
    expect(found?.paused).toBe(true);
    expect(found?.page.blocks).toEqual([]);
    expect(found?.page.profile).toEqual({ username: "mila", displayName: "Mila Berg", bio: "", avatar: { src: "sample:avatar-1", alt: "Mila" }, verified: false, locale: "ar", visibility: { paused: true } });
  });

  it("is a normal page again once the pause is off (or was never set)", () => {
    for (const visibility of [{ paused: false }, undefined, { paused: "garbage" }]) {
      const found = toPublicPage(answer(visibility), NOW);
      expect(found?.paused, JSON.stringify(visibility)).toBe(false);
      expect(found?.page.blocks.map((block) => block.id)).toEqual(["a", "b"]);
      expect(found?.page.profile.tagline).toBe("Singer · Köln");
    }
  });

  it("is never indexed, whatever the search switch says", () => {
    expect(indexable(toPublicPage(answer({ paused: true, search: true }), NOW)!)).toBe(false);
  });
});

describe("search engines and link cards", () => {
  const profile = (visibility?: Page["profile"]["visibility"], extra: Partial<Page["profile"]> = {}): Page["profile"] => ({
    username: "mila",
    displayName: "Mila Berg",
    bio: "Songs and shows.",
    avatar: { src: "none:", alt: "" },
    verified: false,
    locale: "de",
    ...extra,
    ...(visibility ? { visibility } : {}),
  });

  it("may index the page unless the owner switched search engines off", () => {
    expect(indexable({ page: { profile: profile(), blocks: [] }, paused: false })).toBe(true);
    expect(indexable({ page: { profile: profile({ search: true }), blocks: [] }, paused: false })).toBe(true);
    expect(indexable({ page: { profile: profile({ search: false }), blocks: [] }, paused: false })).toBe(false);
  });

  it("uses the owner's title and description, else the name and the tagline or bio", () => {
    expect(searchTexts(profile())).toEqual({ title: "Mila Berg", description: "Songs and shows." });
    expect(searchTexts(profile(undefined, { tagline: "Singer · Köln" }))).toEqual({ title: "Mila Berg", description: "Singer · Köln" });
    expect(searchTexts(profile({ title: "Mila Berg – Sängerin aus Köln", description: "Konzerte, Songs und Tickets." }))).toEqual({
      title: "Mila Berg – Sängerin aus Köln",
      description: "Konzerte, Songs und Tickets.",
    });
    // Empty or blank means today's default.
    expect(searchTexts(profile({ title: "  ", description: "" }))).toEqual({ title: "Mila Berg", description: "Songs and shows." });
  });

  it("cuts a long line to 160 characters, never in the middle of a character", () => {
    const { description } = searchTexts(profile(undefined, { bio: `${"a".repeat(158)}😀😀😀` }));
    expect(Array.from(description)).toHaveLength(160);
    expect(description.endsWith("😀…")).toBe(true);
  });

  it("names a paused page by its title only", () => {
    expect(searchTexts(profile({ paused: true, description: "Konzerte" }), true)).toEqual({ title: "Mila Berg", description: "" });
  });

  it("puts the search title and description on the link card in place of the name and line", () => {
    const own = { page: { profile: profile({ title: "Mila – Live", description: "Tickets und Songs" }, { tagline: "Singer" }), blocks: [] }, paused: false };
    expect(cardPage(own).profile).toMatchObject({ displayName: "Mila – Live", tagline: "Tickets und Songs" });
    const plain = { page: { profile: profile(), blocks: [] }, paused: false };
    expect(cardPage(plain)).toBe(plain.page);
    const paused = { page: { profile: profile({ paused: true, title: "Mila – Live", description: "Tickets" }), blocks: [] }, paused: true };
    expect(cardPage(paused).profile).toMatchObject({ displayName: "Mila – Live" });
    expect(cardPage(paused).profile.tagline).toBeUndefined();
  });
});
